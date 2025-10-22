import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createClient } from '@supabase/supabase-js';
import type { D1Database } from '@cloudflare/workers-types';

interface Bindings {
  DB: D1Database;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_TON_MERCHANT_ADDRESS?: string;
}

interface User {
  id: string;
  energy: number;
  boost_level: number;
  last_watch_at: string | null;
  boost_expires_at: string | null;
  created_at: string;
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

type Boost = {
  level: number;
  name: string;
  multiplier: number;
  costTon: number;
  durationDays?: number;
};

const BOOSTS: Boost[] = [
  { level: 0, name: 'Base', multiplier: 1, costTon: 0 },
  { level: 1, name: 'Bronze', multiplier: 1.25, costTon: 0.3, durationDays: 7 },
  { level: 2, name: 'Silver', multiplier: 1.5, costTon: 0.7, durationDays: 14 },
  { level: 3, name: 'Gold', multiplier: 2, costTon: 1.5, durationDays: 30 },
  { level: 4, name: 'Diamond', multiplier: 3, costTon: 3.5, durationDays: 60 },
];

const AD_COOLDOWN_SECONDS = 30;
const DAILY_VIEW_LIMIT = 200;
const BASE_AD_REWARD = 10;

const supabaseClients = new Map<string, ReturnType<typeof createClient>>();

function boostMultiplier(level: number): number {
  return BOOSTS.find((boost) => boost.level === level)?.multiplier ?? 1;
}

function getSupabase(env: Bindings) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const cacheKey = `${env.SUPABASE_URL}|${env.SUPABASE_SERVICE_ROLE_KEY}`;
  if (!supabaseClients.has(cacheKey)) {
    supabaseClients.set(cacheKey, createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY));
  }
  return supabaseClients.get(cacheKey)!;
}

async function getUserFromAuth(
  env: Bindings,
  authHeader: string | undefined,
  userIdHeader: string | undefined,
): Promise<{ id: string } | null> {
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const anonKey = env.SUPABASE_ANON_KEY;

  if (anonKey && token === anonKey) {
    if (userIdHeader && userIdHeader.startsWith('anon_')) {
      return { id: userIdHeader };
    }
    return null;
  }

  const supabase = getSupabase(env);
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return { id: data.user.id };
}

function mapUser(row: any): User {
  return {
    id: row.id,
    energy: Number(row.energy ?? 0),
    boost_level: Number(row.boost_level ?? 0),
    last_watch_at: row.last_watch_at ?? null,
    boost_expires_at: row.boost_expires_at ?? null,
    created_at: row.created_at,
  };
}

async function getOrCreateUser(env: Bindings, userId: string): Promise<User> {
  const existing = await env.DB.prepare(
    'SELECT id, energy, boost_level, last_watch_at, boost_expires_at, created_at FROM users WHERE id = ?',
  )
    .bind(userId)
    .first<User>();

  if (existing) {
    return mapUser(existing);
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO users (id, energy, boost_level, last_watch_at, boost_expires_at, created_at) VALUES (?, 0, 0, NULL, NULL, ?)',
  )
    .bind(userId, now)
    .run();

  return {
    id: userId,
    energy: 0,
    boost_level: 0,
    last_watch_at: null,
    boost_expires_at: null,
    created_at: now,
  };
}

async function updateUser(env: Bindings, user: User) {
  await env.DB.prepare(
    'UPDATE users SET energy = ?, boost_level = ?, last_watch_at = ?, boost_expires_at = ? WHERE id = ?',
  )
    .bind(user.energy, user.boost_level, user.last_watch_at, user.boost_expires_at, user.id)
    .run();
}

async function recordSession(env: Bindings, userId: string, timestamp: string) {
  await env.DB.prepare('INSERT INTO sessions (user_id, timestamp) VALUES (?, ?)')
    .bind(userId, timestamp)
    .run();
}

async function getDailyWatchCount(env: Bindings, userId: string, day: string): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT count FROM daily_watch_counts WHERE user_id = ? AND day = ?',
  )
    .bind(userId, day)
    .first<{ count: number }>();

  return row ? Number(row.count) : 0;
}

async function incrementDailyWatchCount(env: Bindings, userId: string, day: string): Promise<number> {
  await env.DB.prepare(
    'INSERT INTO daily_watch_counts (user_id, day, count) VALUES (?, ?, 1) ' +
      'ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1',
  )
    .bind(userId, day)
    .run();

  return getDailyWatchCount(env, userId, day);
}

async function logWatch(env: Bindings, params: {
  user_id: string;
  ad_id: string;
  reward: number;
  base_reward: number;
  multiplier: number;
  created_at: string;
}) {
  await env.DB.prepare(
    'INSERT INTO watch_logs (user_id, ad_id, reward, base_reward, multiplier, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(params.user_id, params.ad_id, params.reward, params.base_reward, params.multiplier, params.created_at)
    .run();
}

async function getWatchHistory(env: Bindings, userId: string) {
  const { results } = await env.DB.prepare(
    'SELECT user_id, ad_id, reward, base_reward, multiplier, created_at FROM watch_logs WHERE user_id = ? ' +
      'ORDER BY datetime(created_at) DESC LIMIT 20',
  )
    .bind(userId)
    .all<{
      user_id: string;
      ad_id: string;
      reward: number | null;
      base_reward: number | null;
      multiplier: number | null;
      created_at: string;
    }>();

  return (results ?? []).map((row) => ({
    user_id: row.user_id,
    ad_id: row.ad_id,
    reward: Number(row.reward ?? 0),
    base_reward: Number(row.base_reward ?? 0),
    multiplier: Number(row.multiplier ?? 1),
    created_at: row.created_at,
  }));
}

async function getTotalWatches(env: Bindings, userId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) as count FROM watch_logs WHERE user_id = ?')
    .bind(userId)
    .first<{ count: number }>();
  return row ? Number(row.count) : 0;
}

async function getTotalEarned(env: Bindings, userId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT SUM(reward) as total FROM watch_logs WHERE user_id = ?')
    .bind(userId)
    .first<{ total: number | null }>();
  return row && row.total ? Number(row.total) : 0;
}

async function getTotalSessions(env: Bindings, userId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ?')
    .bind(userId)
    .first<{ count: number }>();
  return row ? Number(row.count) : 0;
}

async function getClaimedPartners(env: Bindings, userId: string): Promise<string[]> {
  const { results } = await env.DB.prepare(
    'SELECT partner_id FROM reward_claims WHERE user_id = ?',
  )
    .bind(userId)
    .all<{ partner_id: string }>();

  return (results ?? []).map((row) => String(row.partner_id));
}

async function recordRewardClaim(env: Bindings, params: {
  user_id: string;
  partner_id: string;
  partner_name?: string;
  reward: number;
  claimed_at: string;
}) {
  await env.DB.prepare(
    'INSERT INTO reward_claims (user_id, partner_id, partner_name, reward, claimed_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(params.user_id, params.partner_id, params.partner_name ?? null, params.reward, params.claimed_at)
    .run();

  await env.DB.prepare(
    'INSERT INTO reward_logs (user_id, partner_id, reward, claimed_at) VALUES (?, ?, ?, ?)',
  )
    .bind(params.user_id, params.partner_id, params.reward, params.claimed_at)
    .run();
}

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'X-User-ID'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
}));

app.get('/make-server-0f597298/health', (c) => {
  return c.json({ status: 'ok', driver: 'cloudflare-d1' });
});

app.post('/make-server-0f597298/user/init', async (c) => {
  const authUser = await getUserFromAuth(c.env, c.req.header('Authorization'), c.req.header('X-User-ID'));

  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const user = await getOrCreateUser(c.env, authUser.id);

  if (user.boost_expires_at && new Date(user.boost_expires_at) < new Date()) {
    user.boost_level = 0;
    user.boost_expires_at = null;
    await updateUser(c.env, user);
  }

  const nowIso = new Date().toISOString();
  await recordSession(c.env, authUser.id, nowIso);

  return c.json({
    user: {
      id: user.id,
      energy: user.energy,
      boost_level: user.boost_level,
      boost_expires_at: user.boost_expires_at,
    },
  });
});

app.get('/make-server-0f597298/user/balance', async (c) => {
  const authUser = await getUserFromAuth(c.env, c.req.header('Authorization'), c.req.header('X-User-ID'));

  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const user = await getOrCreateUser(c.env, authUser.id);

  return c.json({
    energy: user.energy,
    boost_level: user.boost_level,
    multiplier: boostMultiplier(user.boost_level),
    boost_expires_at: user.boost_expires_at,
  });
});

app.get('/make-server-0f597298/ads/next', async (c) => {
  const authUser = await getUserFromAuth(c.env, c.req.header('Authorization'), c.req.header('X-User-ID'));

  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return c.json({
    id: 'default_ad',
    url: '',
    reward: BASE_AD_REWARD,
    type: 'partner',
  });
});

app.post('/make-server-0f597298/ads/complete', async (c) => {
  const authUser = await getUserFromAuth(c.env, c.req.header('Authorization'), c.req.header('X-User-ID'));

  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json<{ ad_id?: string }>();
  const adId = body?.ad_id;

  if (!adId) {
    return c.json({ error: 'Missing ad_id' }, 400);
  }

  const user = await getOrCreateUser(c.env, authUser.id);

  if (user.last_watch_at) {
    const lastWatch = new Date(user.last_watch_at);
    const secondsSince = (Date.now() - lastWatch.getTime()) / 1000;
    if (secondsSince < AD_COOLDOWN_SECONDS) {
      const remaining = Math.ceil(AD_COOLDOWN_SECONDS - secondsSince);
      return c.json({ error: 'Cooldown active', cooldown_remaining: remaining }, 429);
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const dailyCount = await getDailyWatchCount(c.env, authUser.id, today);
  if (dailyCount >= DAILY_VIEW_LIMIT) {
    return c.json({ error: 'Daily limit reached' }, 429);
  }

  const multiplier = boostMultiplier(user.boost_level);
  const reward = Math.floor(BASE_AD_REWARD * multiplier);
  const nowIso = new Date().toISOString();

  user.energy += reward;
  user.last_watch_at = nowIso;
  await updateUser(c.env, user);

  await incrementDailyWatchCount(c.env, authUser.id, today);

  await logWatch(c.env, {
    user_id: authUser.id,
    ad_id: adId,
    reward,
    base_reward: BASE_AD_REWARD,
    multiplier,
    created_at: nowIso,
  });

  return c.json({
    success: true,
    reward,
    new_balance: user.energy,
    multiplier,
    daily_watches_remaining: DAILY_VIEW_LIMIT - (dailyCount + 1),
  });
});

app.post('/make-server-0f597298/orders/create', async (c) => {
  const authUser = await getUserFromAuth(c.env, c.req.header('Authorization'), c.req.header('X-User-ID'));

  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json<{ boost_level?: number }>();
  const boostLevel = body?.boost_level;

  if (typeof boostLevel !== 'number' || boostLevel < 1 || boostLevel > 4) {
    return c.json({ error: 'Invalid boost_level' }, 400);
  }

  const boost = BOOSTS.find((b) => b.level === boostLevel);
  if (!boost) {
    return c.json({ error: 'Boost not found' }, 404);
  }

  const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const payload = `boost_${boostLevel}_${authUser.id}_${Date.now()}`;
  const nowIso = new Date().toISOString();

  await c.env.DB.prepare(
    'INSERT INTO orders (id, user_id, boost_level, ton_amount, status, payload, tx_hash, created_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, NULL, ?)',
  )
    .bind(orderId, authUser.id, boostLevel, boost.costTon, 'pending', payload, nowIso)
    .run();

  const merchantAddress = c.env.VITE_TON_MERCHANT_ADDRESS || 'UQD_merchant_address_placeholder';

  return c.json({
    order_id: orderId,
    address: merchantAddress,
    amount: boost.costTon,
    payload,
    boost_name: boost.name,
    duration_days: boost.durationDays ?? null,
  });
});

app.get('/make-server-0f597298/orders/:orderId', async (c) => {
  const authUser = await getUserFromAuth(c.env, c.req.header('Authorization'), c.req.header('X-User-ID'));

  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const orderId = c.req.param('orderId');
  const orderRow = await c.env.DB.prepare(
    'SELECT id, user_id, boost_level, ton_amount, status, payload, tx_hash, created_at FROM orders WHERE id = ?',
  )
    .bind(orderId)
    .first<Order>();

  if (!orderRow) {
    return c.json({ error: 'Order not found' }, 404);
  }

  if (orderRow.user_id !== authUser.id) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  return c.json({
    order_id: orderRow.id,
    status: orderRow.status,
    boost_level: orderRow.boost_level,
    ton_amount: orderRow.ton_amount,
    tx_hash: orderRow.tx_hash,
    created_at: orderRow.created_at,
  });
});

app.post('/make-server-0f597298/orders/:orderId/confirm', async (c) => {
  const authUser = await getUserFromAuth(c.env, c.req.header('Authorization'), c.req.header('X-User-ID'));

  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const orderId = c.req.param('orderId');
  const orderRow = await c.env.DB.prepare(
    'SELECT id, user_id, boost_level, ton_amount, status, payload, tx_hash, created_at FROM orders WHERE id = ?',
  )
    .bind(orderId)
    .first<Order>();

  if (!orderRow) {
    return c.json({ error: 'Order not found' }, 404);
  }

  if (orderRow.user_id !== authUser.id) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  if (orderRow.status !== 'pending') {
    return c.json({ error: 'Order already processed' }, 400);
  }

  const body = await c.req
    .json<{ tx_hash?: string }>()
    .catch(() => ({}) as { tx_hash?: string });
  const txHash = body.tx_hash ?? `demo_tx_${Date.now()}`;

  await c.env.DB.prepare('UPDATE orders SET status = ?, tx_hash = ? WHERE id = ?')
    .bind('paid', txHash, orderId)
    .run();

  const user = await getOrCreateUser(c.env, authUser.id);
  user.boost_level = orderRow.boost_level;

  const boost = BOOSTS.find((b) => b.level === orderRow.boost_level);
  if (boost?.durationDays) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + boost.durationDays);
    user.boost_expires_at = expiresAt.toISOString();
  }

  await updateUser(c.env, user);

  return c.json({
    success: true,
    tx_hash: txHash,
    boost_level: user.boost_level,
    boost_expires_at: user.boost_expires_at,
    multiplier: boostMultiplier(user.boost_level),
  });
});

app.get('/make-server-0f597298/stats', async (c) => {
  const authUser = await getUserFromAuth(c.env, c.req.header('Authorization'), c.req.header('X-User-ID'));

  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const user = await getOrCreateUser(c.env, authUser.id);
  const [totalWatches, totalEarned, totalSessions, watchHistory] = await Promise.all([
    getTotalWatches(c.env, authUser.id),
    getTotalEarned(c.env, authUser.id),
    getTotalSessions(c.env, authUser.id),
    getWatchHistory(c.env, authUser.id),
  ]);

  const today = new Date().toISOString().split('T')[0];
  const todayWatches = await getDailyWatchCount(c.env, authUser.id, today);

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
    watch_history: watchHistory,
  });
});

app.get('/make-server-0f597298/rewards/status', async (c) => {
  const authUser = await getUserFromAuth(c.env, c.req.header('Authorization'), c.req.header('X-User-ID'));

  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const claimedPartners = await getClaimedPartners(c.env, authUser.id);

  return c.json({
    claimed_partners: claimedPartners,
    available_rewards: 0,
  });
});

app.post('/make-server-0f597298/rewards/claim', async (c) => {
  const authUser = await getUserFromAuth(c.env, c.req.header('Authorization'), c.req.header('X-User-ID'));

  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json<{ partner_id?: string; partner_name?: string; reward_amount?: number }>();

  if (!body.partner_id || typeof body.partner_id !== 'string') {
    return c.json({ error: 'Missing or invalid partner_id' }, 400);
  }

  if (typeof body.reward_amount !== 'number') {
    return c.json({ error: 'Invalid reward amount' }, 400);
  }

  const claimExists = await c.env.DB.prepare(
    'SELECT 1 FROM reward_claims WHERE user_id = ? AND partner_id = ?',
  )
    .bind(authUser.id, body.partner_id)
    .first();

  if (claimExists) {
    return c.json({ error: 'Reward already claimed' }, 400);
  }

  const user = await getOrCreateUser(c.env, authUser.id);
  user.energy += body.reward_amount;
  await updateUser(c.env, user);

  const claimTimestamp = new Date().toISOString();
  await recordRewardClaim(c.env, {
    user_id: authUser.id,
    partner_id: body.partner_id,
    partner_name: body.partner_name,
    reward: body.reward_amount,
    claimed_at: claimTimestamp,
  });

  return c.json({
    success: true,
    reward: body.reward_amount,
    new_balance: user.energy,
    partner_name: body.partner_name ?? 'Partner',
  });
});

export default app;
