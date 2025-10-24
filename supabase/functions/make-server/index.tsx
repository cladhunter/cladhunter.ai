import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Types
interface User {
  id: string;
  energy: number;
  boost_level: number;
  last_watch_at: string | null;
  boost_expires_at: string | null;
  created_at: string;
}

interface Ad {
  id: string;
  url: string;
  reward: number;
  type: 'short' | 'long' | 'promo';
  active: boolean;
}

interface Order {
  id: string;
  user_id: string;
  boost_level: number;
  ton_amount: number;
  status: 'pending' | 'paid' | 'failed';
  payload: string;
  tx_hash: string | null;
  created_at: string;
}

// Economy config (duplicated from frontend)
const BOOSTS = [
  { level: 0, name: "Base", multiplier: 1, costTon: 0 },
  { level: 1, name: "Bronze", multiplier: 1.25, costTon: 0.5, durationDays: 7 },
  { level: 2, name: "Silver", multiplier: 1.5, costTon: 1.2, durationDays: 14 },
  { level: 3, name: "Gold", multiplier: 2, costTon: 2.8, durationDays: 30 },
  { level: 4, name: "Diamond", multiplier: 3, costTon: 6, durationDays: 60 },
];

const AD_COOLDOWN_SECONDS = 30;
const DAILY_VIEW_LIMIT = 200;

function boostMultiplier(level: number): number {
  return BOOSTS.find((b) => b.level === level)?.multiplier || 1;
}

// Base reward for ad views (will be multiplied by user's boost level)
const BASE_AD_REWARD = 10;

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to get user from auth token
async function getUserFromAuth(authHeader: string | null, userIdHeader: string | null): Promise<{ id: string } | null> {
  if (!authHeader) return null;
  
  const token = authHeader.replace('Bearer ', '');
  
  // Check if it's the public anon key (for anonymous users)
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (token === supabaseAnonKey) {
    // For anonymous users, use the user ID from custom header
    if (userIdHeader && userIdHeader.startsWith('anon_')) {
      return { id: userIdHeader };
    }
    return null;
  }
  
  // For authenticated users, verify the token
  const { data, error } = await supabase.auth.getUser(token);
  
  if (error || !data.user) return null;
  return { id: data.user.id };
}

// Helper to get or create user
async function getOrCreateUser(userId: string): Promise<User> {
  const userKey = `user:${userId}`;
  const existing = await kv.get(userKey);
  
  if (existing) {
    return JSON.parse(existing) as User;
  }
  
  // Create new user
  const newUser: User = {
    id: userId,
    energy: 0,
    boost_level: 0,
    last_watch_at: null,
    boost_expires_at: null,
    created_at: new Date().toISOString(),
  };
  
  await kv.set(userKey, JSON.stringify(newUser));
  return newUser;
}

// Helper to update user
async function updateUser(user: User): Promise<void> {
  const userKey = `user:${user.id}`;
  await kv.set(userKey, JSON.stringify(user));
}

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-User-ID"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-0f597298/health", (c) => {
  return c.json({ status: "ok" });
});

// Initialize user (called on app load)
app.post("/make-server-0f597298/user/init", async (c) => {
  try {
    const authUser = await getUserFromAuth(c.req.header('Authorization'), c.req.header('X-User-ID'));
    
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const user = await getOrCreateUser(authUser.id);
    
    // Check if boost has expired
    if (user.boost_expires_at && new Date(user.boost_expires_at) < new Date()) {
      user.boost_level = 0;
      user.boost_expires_at = null;
      await updateUser(user);
    }
    
    // Track session
    const sessionKey = `session:${authUser.id}:${Date.now()}`;
    const sessionData = {
      user_id: authUser.id,
      timestamp: new Date().toISOString(),
    };
    await kv.set(sessionKey, JSON.stringify(sessionData));
    
    return c.json({
      user: {
        id: user.id,
        energy: user.energy,
        boost_level: user.boost_level,
        boost_expires_at: user.boost_expires_at,
      }
    });
  } catch (error) {
    console.log('Error initializing user:', error);
    return c.json({ error: 'Failed to initialize user' }, 500);
  }
});

// Get user balance
app.get("/make-server-0f597298/user/balance", async (c) => {
  try {
    const authUser = await getUserFromAuth(c.req.header('Authorization'), c.req.header('X-User-ID'));
    
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const user = await getOrCreateUser(authUser.id);
    
    return c.json({
      energy: user.energy,
      boost_level: user.boost_level,
      multiplier: boostMultiplier(user.boost_level),
      boost_expires_at: user.boost_expires_at,
    });
  } catch (error) {
    console.log('Error fetching balance:', error);
    return c.json({ error: 'Failed to fetch balance' }, 500);
  }
});

// This endpoint is deprecated - ads are now managed client-side from config/ads.ts
// Kept for backward compatibility
app.get("/make-server-0f597298/ads/next", async (c) => {
  try {
    const authUser = await getUserFromAuth(c.req.header('Authorization'), c.req.header('X-User-ID'));
    
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    return c.json({
      id: 'default_ad',
      url: '',
      reward: BASE_AD_REWARD,
      type: 'partner',
    });
  } catch (error) {
    console.log('Error fetching next ad:', error);
    return c.json({ error: 'Failed to fetch ad' }, 500);
  }
});

// Complete ad watch
app.post("/make-server-0f597298/ads/complete", async (c) => {
  try {
    const authUser = await getUserFromAuth(c.req.header('Authorization'), c.req.header('X-User-ID'));
    
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const body = await c.req.json();
    const { ad_id } = body;
    
    if (!ad_id) {
      return c.json({ error: 'Missing ad_id' }, 400);
    }
    
    // Get user
    const user = await getOrCreateUser(authUser.id);
    
    // Check cooldown
    if (user.last_watch_at) {
      const lastWatch = new Date(user.last_watch_at);
      const now = new Date();
      const secondsSinceLastWatch = (now.getTime() - lastWatch.getTime()) / 1000;
      
      if (secondsSinceLastWatch < AD_COOLDOWN_SECONDS) {
        const remainingCooldown = Math.ceil(AD_COOLDOWN_SECONDS - secondsSinceLastWatch);
        return c.json({ 
          error: 'Cooldown active', 
          cooldown_remaining: remainingCooldown 
        }, 429);
      }
    }
    
    // Check daily limit
    const today = new Date().toISOString().split('T')[0];
    const dailyCountKey = `watch_count:${authUser.id}:${today}`;
    const dailyCountStr = await kv.get(dailyCountKey);
    const dailyCount = dailyCountStr ? parseInt(dailyCountStr) : 0;
    
    if (dailyCount >= DAILY_VIEW_LIMIT) {
      return c.json({ error: 'Daily limit reached' }, 429);
    }
    
    // Calculate reward with boost multiplier
    const multiplier = boostMultiplier(user.boost_level);
    const energyReward = Math.floor(BASE_AD_REWARD * multiplier);
    
    // Update user
    user.energy += energyReward;
    user.last_watch_at = new Date().toISOString();
    await updateUser(user);
    
    // Update daily count
    await kv.set(dailyCountKey, String(dailyCount + 1));
    
    // Log watch for analytics
    const watchLogKey = `watch:${authUser.id}:${Date.now()}`;
    const watchLog = {
      user_id: authUser.id,
      ad_id: ad_id,
      reward: energyReward,
      base_reward: BASE_AD_REWARD,
      multiplier: multiplier,
      created_at: new Date().toISOString(),
    };
    await kv.set(watchLogKey, JSON.stringify(watchLog));
    
    return c.json({
      success: true,
      reward: energyReward,
      new_balance: user.energy,
      multiplier: multiplier,
      daily_watches_remaining: DAILY_VIEW_LIMIT - dailyCount - 1,
    });
  } catch (error) {
    console.log('Error completing ad watch:', error);
    return c.json({ error: 'Failed to complete ad watch' }, 500);
  }
});

// Create boost order
app.post("/make-server-0f597298/orders/create", async (c) => {
  try {
    const authUser = await getUserFromAuth(c.req.header('Authorization'), c.req.header('X-User-ID'));
    
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const body = await c.req.json();
    const { boost_level } = body;
    
    if (typeof boost_level !== 'number' || boost_level < 1 || boost_level > 4) {
      return c.json({ error: 'Invalid boost_level' }, 400);
    }
    
    const boost = BOOSTS.find(b => b.level === boost_level);
    if (!boost) {
      return c.json({ error: 'Boost not found' }, 404);
    }
    
    // Generate unique order ID and payload
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const payload = `boost_${boost_level}_${authUser.id}_${Date.now()}`;
    
    // Create order
    const order: Order = {
      id: orderId,
      user_id: authUser.id,
      boost_level: boost_level,
      ton_amount: boost.costTon,
      status: 'pending',
      payload: payload,
      tx_hash: null,
      created_at: new Date().toISOString(),
    };
    
    await kv.set(`order:${orderId}`, JSON.stringify(order));
    
    // Get merchant address from env
    const merchantAddress = Deno.env.get('VITE_TON_MERCHANT_ADDRESS') || 'UQD_merchant_address_placeholder';
    
    return c.json({
      order_id: orderId,
      address: merchantAddress,
      amount: boost.costTon,
      payload: payload,
      boost_name: boost.name,
      duration_days: boost.durationDays,
    });
  } catch (error) {
    console.log('Error creating order:', error);
    return c.json({ error: 'Failed to create order' }, 500);
  }
});

// Check order status
app.get("/make-server-0f597298/orders/:orderId", async (c) => {
  try {
    const authUser = await getUserFromAuth(c.req.header('Authorization'), c.req.header('X-User-ID'));
    
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const orderId = c.req.param('orderId');
    const orderData = await kv.get(`order:${orderId}`);
    
    if (!orderData) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    const order: Order = JSON.parse(orderData);
    
    if (order.user_id !== authUser.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    return c.json({
      order_id: order.id,
      status: order.status,
      boost_level: order.boost_level,
      ton_amount: order.ton_amount,
      tx_hash: order.tx_hash,
      created_at: order.created_at,
    });
  } catch (error) {
    console.log('Error checking order status:', error);
    return c.json({ error: 'Failed to check order status' }, 500);
  }
});

// Manually confirm order (for demo purposes - in production, use TON API webhook)
app.post("/make-server-0f597298/orders/:orderId/confirm", async (c) => {
  try {
    const authUser = await getUserFromAuth(c.req.header('Authorization'), c.req.header('X-User-ID'));
    
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const orderId = c.req.param('orderId');
    const orderData = await kv.get(`order:${orderId}`);
    
    if (!orderData) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    const order: Order = JSON.parse(orderData);
    
    if (order.user_id !== authUser.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    if (order.status !== 'pending') {
      return c.json({ error: 'Order already processed' }, 400);
    }

    // Get tx_hash from request body if provided
    const body = await c.req.json().catch(() => ({}));
    const txHash = body.tx_hash || 'demo_tx_' + Date.now();
    
    // TODO: In production, verify the transaction on TON blockchain
    // using TON API or TON Center API
    // const isValid = await verifyTonTransaction(txHash, order.ton_amount, merchantAddress);
    // if (!isValid) {
    //   return c.json({ error: 'Transaction verification failed' }, 400);
    // }
    
    // Update order status
    order.status = 'paid';
    order.tx_hash = txHash;
    await kv.set(`order:${orderId}`, JSON.stringify(order));
    
    // Update user boost
    const user = await getOrCreateUser(authUser.id);
    user.boost_level = order.boost_level;
    
    const boost = BOOSTS.find(b => b.level === order.boost_level);
    if (boost && boost.durationDays) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + boost.durationDays);
      user.boost_expires_at = expiresAt.toISOString();
    }
    
    await updateUser(user);
    
    return c.json({
      success: true,
      boost_level: user.boost_level,
      boost_expires_at: user.boost_expires_at,
      multiplier: boostMultiplier(user.boost_level),
    });
  } catch (error) {
    console.log('Error confirming order:', error);
    return c.json({ error: 'Failed to confirm order' }, 500);
  }
});

// Get user stats
app.get("/make-server-0f597298/stats", async (c) => {
  try {
    const authUser = await getUserFromAuth(c.req.header('Authorization'), c.req.header('X-User-ID'));
    
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const user = await getOrCreateUser(authUser.id);
    
    // Get watch logs
    const watchLogsPrefix = `watch:${authUser.id}:`;
    const watchLogs = await kv.getByPrefix(watchLogsPrefix);
    
    const totalWatches = watchLogs.length;
    const totalEarned = watchLogs.reduce((sum, log) => {
      const logData = JSON.parse(log);
      return sum + (logData.reward || 0);
    }, 0);
    
    // Parse and sort watch logs by timestamp (most recent first)
    const parsedWatchLogs = watchLogs
      .map(log => JSON.parse(log))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20); // Return last 20 sessions
    
    // Get session count
    const sessionPrefix = `session:${authUser.id}:`;
    const sessions = await kv.getByPrefix(sessionPrefix);
    const totalSessions = sessions.length;
    
    // Get today's watch count
    const today = new Date().toISOString().split('T')[0];
    const dailyCountKey = `watch_count:${authUser.id}:${today}`;
    const dailyCountStr = await kv.get(dailyCountKey);
    const todayWatches = dailyCountStr ? parseInt(dailyCountStr) : 0;
    
    return c.json({
      total_energy: user.energy,
      total_watches: totalWatches,
      total_earned: totalEarned,
      total_sessions: totalSessions,
      today_watches: todayWatches,
      daily_limit: DAILY_VIEW_LIMIT,
      boost_level: user.boost_level,
      multiplier: boostMultiplier(user.boost_level),
      boost_expires_at: user.boost_expires_at,
      watch_history: parsedWatchLogs,
    });
  } catch (error) {
    console.log('Error fetching stats:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

// Get reward claim status
app.get("/make-server-0f597298/rewards/status", async (c) => {
  try {
    const authUser = await getUserFromAuth(c.req.header('Authorization'), c.req.header('X-User-ID'));
    
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // Get all claimed rewards for this user
    const claimedPrefix = `reward_claim:${authUser.id}:`;
    const claimedRewards = await kv.getByPrefix(claimedPrefix);
    
    // Extract partner IDs from keys
    const claimedPartners = claimedRewards.map(value => {
      const claim = JSON.parse(value);
      return claim.partner_id;
    });
    
    return c.json({
      claimed_partners: claimedPartners,
      available_rewards: 0, // Could calculate based on partners.ts in future
    });
  } catch (error) {
    console.log('Error fetching reward status:', error);
    return c.json({ error: 'Failed to fetch reward status' }, 500);
  }
});

// Claim partner reward
app.post("/make-server-0f597298/rewards/claim", async (c) => {
  try {
    const authUser = await getUserFromAuth(c.req.header('Authorization'), c.req.header('X-User-ID'));
    
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const body = await c.req.json();
    const { partner_id } = body;
    
    if (!partner_id || typeof partner_id !== 'string') {
      return c.json({ error: 'Missing or invalid partner_id' }, 400);
    }
    
    // Check if already claimed
    const claimKey = `reward_claim:${authUser.id}:${partner_id}`;
    const existingClaim = await kv.get(claimKey);
    
    if (existingClaim) {
      return c.json({ error: 'Reward already claimed' }, 400);
    }
    
    // Get partner config from body (frontend will send it)
    const { partner_name, reward_amount } = body;
    
    if (!reward_amount || typeof reward_amount !== 'number') {
      return c.json({ error: 'Invalid reward amount' }, 400);
    }
    
    // Get user
    const user = await getOrCreateUser(authUser.id);
    
    // Add reward to user balance
    user.energy += reward_amount;
    await updateUser(user);
    
    // Record claim
    const claim = {
      partner_id: partner_id,
      user_id: authUser.id,
      reward: reward_amount,
      claimed_at: new Date().toISOString(),
    };
    await kv.set(claimKey, JSON.stringify(claim));
    
    // Log for analytics
    const rewardLogKey = `reward_log:${authUser.id}:${Date.now()}`;
    await kv.set(rewardLogKey, JSON.stringify(claim));
    
    return c.json({
      success: true,
      reward: reward_amount,
      new_balance: user.energy,
      partner_name: partner_name || 'Partner',
    });
  } catch (error) {
    console.log('Error claiming reward:', error);
    return c.json({ error: 'Failed to claim reward' }, 500);
  }
});

Deno.serve(app.fetch);
