import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
  { level: 1, name: "Bronze", multiplier: 1.25, costTon: 0.3, durationDays: 7 },
  { level: 2, name: "Silver", multiplier: 1.5, costTon: 0.7, durationDays: 14 },
  { level: 3, name: "Gold", multiplier: 2, costTon: 1.5, durationDays: 30 },
  { level: 4, name: "Diamond", multiplier: 3, costTon: 3.5, durationDays: 60 },
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

function mapProfile(record: any): User {
  return {
    id: record.id,
    energy: record.energy,
    boost_level: record.boost_level,
    last_watch_at: record.last_watch_at,
    boost_expires_at: record.boost_expires_at,
    created_at: record.created_at,
  };
}

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
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load user: ${error.message}`);
  }

  if (data) {
    return mapProfile(data);
  }

  const { data: created, error: createError } = await supabase
    .from('profiles')
    .insert({ id: userId })
    .select()
    .single();

  if (createError) {
    throw new Error(`Failed to create user: ${createError.message}`);
  }

  return mapProfile(created);
}

// Helper to update user
async function updateUser(user: User): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      energy: user.energy,
      boost_level: user.boost_level,
      last_watch_at: user.last_watch_at,
      boost_expires_at: user.boost_expires_at,
    })
    .eq('id', user.id);

  if (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }
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
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: authUser.id,
      });

    if (sessionError) {
      console.log('Error saving session:', sessionError);
    }
    
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
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const { count: dailyCount, error: dailyCountError } = await supabase
      .from('ad_watches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', authUser.id)
      .gte('created_at', startOfDay.toISOString())
      .lt('created_at', endOfDay.toISOString());

    if (dailyCountError) {
      console.log('Error counting daily watches:', dailyCountError);
      return c.json({ error: 'Failed to process ad watch' }, 500);
    }

    const watchesToday = dailyCount ?? 0;

    if (watchesToday >= DAILY_VIEW_LIMIT) {
      return c.json({ error: 'Daily limit reached' }, 429);
    }
    
    // Calculate reward with boost multiplier
    const multiplier = boostMultiplier(user.boost_level);
    const energyReward = Math.floor(BASE_AD_REWARD * multiplier);
    
    // Update user
    const watchTimestamp = new Date().toISOString();
    user.energy += energyReward;
    user.last_watch_at = watchTimestamp;
    await updateUser(user);

    const { error: watchInsertError } = await supabase
      .from('ad_watches')
      .insert({
        user_id: authUser.id,
        ad_id: ad_id,
        reward: energyReward,
        base_reward: BASE_AD_REWARD,
        multiplier: multiplier,
        created_at: watchTimestamp,
      });

    if (watchInsertError) {
      console.log('Error logging ad watch:', watchInsertError);
    }

    return c.json({
      success: true,
      reward: energyReward,
      new_balance: user.energy,
      multiplier: multiplier,
      daily_watches_remaining: DAILY_VIEW_LIMIT - watchesToday - 1,
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
    
    const orderCreatedAt = new Date().toISOString();
    const { error: orderInsertError } = await supabase
      .from('orders')
      .insert({
        id: orderId,
        user_id: authUser.id,
        boost_level: boost_level,
        ton_amount: boost.costTon,
        status: 'pending',
        payload: payload,
        tx_hash: null,
        created_at: orderCreatedAt,
        updated_at: orderCreatedAt,
      });

    if (orderInsertError) {
      console.log('Error creating order:', orderInsertError);
      return c.json({ error: 'Failed to create order' }, 500);
    }
    
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
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      console.log('Error fetching order:', orderError);
      return c.json({ error: 'Failed to fetch order' }, 500);
    }

    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    if (order.user_id !== authUser.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    return c.json({
      order_id: order.id,
      status: order.status,
      boost_level: order.boost_level,
      ton_amount: Number(order.ton_amount),
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
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      console.log('Error fetching order for confirmation:', orderError);
      return c.json({ error: 'Failed to confirm order' }, 500);
    }

    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

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
    
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        tx_hash: txHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (orderUpdateError) {
      console.log('Error updating order status:', orderUpdateError);
      return c.json({ error: 'Failed to confirm order' }, 500);
    }
    
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
    
    const { data: watchStats, error: watchStatsError } = await supabase
      .from('v_user_watch_stats')
      .select('total_watches, total_reward')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (watchStatsError) {
      console.log('Error fetching watch stats:', watchStatsError);
    }

    const totalWatches = watchStats?.total_watches ? Number(watchStats.total_watches) : 0;
    const totalEarned = watchStats?.total_reward ? Number(watchStats.total_reward) : 0;

    const { data: watchHistoryData, error: watchHistoryError } = await supabase
      .from('ad_watches')
      .select('user_id, ad_id, reward, base_reward, multiplier, created_at')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (watchHistoryError) {
      console.log('Error fetching watch history:', watchHistoryError);
    }

    const parsedWatchLogs = (watchHistoryData ?? []).map((log) => ({
      user_id: log.user_id,
      ad_id: log.ad_id,
      reward: log.reward,
      base_reward: log.base_reward,
      multiplier: Number(log.multiplier),
      created_at: log.created_at,
    }));

    const { count: sessionCount, error: sessionCountError } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', authUser.id);

    if (sessionCountError) {
      console.log('Error counting sessions:', sessionCountError);
    }

    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const { count: todayCount, error: todayCountError } = await supabase
      .from('ad_watches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', authUser.id)
      .gte('created_at', startOfDay.toISOString())
      .lt('created_at', endOfDay.toISOString());

    if (todayCountError) {
      console.log('Error counting today watches:', todayCountError);
    }

    const totalSessions = sessionCount ?? 0;
    const todayWatches = todayCount ?? 0;

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
    
    const { data: claimedRewards, error: claimedError } = await supabase
      .from('reward_claims')
      .select('partner_id')
      .eq('user_id', authUser.id);

    if (claimedError) {
      console.log('Error fetching claimed rewards:', claimedError);
    }

    const claimedPartners = (claimedRewards ?? []).map((claim) => claim.partner_id);

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
    const { data: existingClaim, error: existingClaimError } = await supabase
      .from('reward_claims')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('partner_id', partner_id)
      .maybeSingle();

    if (existingClaimError) {
      console.log('Error checking existing reward claim:', existingClaimError);
      return c.json({ error: 'Failed to claim reward' }, 500);
    }

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
    const claimedAt = new Date().toISOString();
    const { error: claimInsertError } = await supabase
      .from('reward_claims')
      .insert({
        user_id: authUser.id,
        partner_id: partner_id,
        reward: reward_amount,
        claimed_at: claimedAt,
      });

    if (claimInsertError) {
      console.log('Error saving reward claim:', claimInsertError);
      return c.json({ error: 'Failed to claim reward' }, 500);
    }

    const { error: rewardLogError } = await supabase
      .from('reward_logs')
      .insert({
        user_id: authUser.id,
        partner_id: partner_id,
        reward: reward_amount,
        created_at: claimedAt,
      });

    if (rewardLogError) {
      console.log('Error logging reward claim:', rewardLogError);
    }
    
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