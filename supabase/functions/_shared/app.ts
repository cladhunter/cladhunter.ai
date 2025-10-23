import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient as createSupabaseClient } from "jsr:@supabase/supabase-js@2";

import { getDatabaseClient, getDatabaseConfigError } from "./db.ts";

const FUNCTION_PREFIX = "/make-server-0f597298";

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
  ton_amount: number | string;
  status: "pending" | "paid" | "failed";
  payload: string;
  tx_hash: string | null;
  created_at: string;
  updated_at: string;
}

interface CompleteAdWatchResult {
  reward: number;
  new_balance: number;
  multiplier: number | string;
  daily_watches_remaining: number;
  boost_level?: number;
  boost_expires_at?: string | null;
  last_watch_at?: string | null;
}

const BOOSTS = [
  { level: 0, name: "Base", multiplier: 1, costTon: 0 },
  { level: 1, name: "Bronze", multiplier: 1.25, costTon: 0.3, durationDays: 7 },
  { level: 2, name: "Silver", multiplier: 1.5, costTon: 0.7, durationDays: 14 },
  { level: 3, name: "Gold", multiplier: 2, costTon: 1.5, durationDays: 30 },
  { level: 4, name: "Diamond", multiplier: 3, costTon: 3.5, durationDays: 60 },
];

const AD_COOLDOWN_SECONDS = 30;
const DAILY_VIEW_LIMIT = 200;
const BASE_AD_REWARD = 10;

function boostMultiplier(level: number): number {
  return BOOSTS.find((b) => b.level === level)?.multiplier || 1;
}

function parseJsonDetails(details?: string | null) {
  if (!details) return null;
  try {
    return JSON.parse(details);
  } catch (_error) {
    return null;
  }
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function createApp() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  const missingSupabaseEnvVars: string[] = [];
  if (!supabaseUrl) {
    missingSupabaseEnvVars.push("SUPABASE_URL");
  }
  if (!supabaseAnonKey) {
    missingSupabaseEnvVars.push("SUPABASE_ANON_KEY");
  }

  const supabaseConfigErrorMessage = missingSupabaseEnvVars.length
    ? `Supabase configuration error: missing environment variables: ${missingSupabaseEnvVars.join(", ")}`
    : null;

  if (supabaseConfigErrorMessage) {
    console.error(`[supabase] ${supabaseConfigErrorMessage}`);
  }

  const supabaseAuth =
    supabaseUrl && supabaseAnonKey
      ? createSupabaseClient(supabaseUrl, supabaseAnonKey)
      : null;

  const app = new Hono();

  app.use("*", async (c, next) => {
    const dbError = getDatabaseConfigError();
    if (dbError) {
      console.error(`[database] ${dbError}`);
      return c.json({ error: "Server misconfigured: database unavailable" }, 500);
    }

    if (!supabaseAuth) {
      console.error(
        supabaseConfigErrorMessage ??
          "Supabase configuration error: missing Supabase auth configuration",
      );
      return c.json({ error: "Server misconfigured: auth unavailable" }, 500);
    }

    return next();
  });

  app.use("*", logger(console.log));
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

  const getUserFromAuth = async (
    authHeader: string | null,
    userIdHeader: string | null,
  ): Promise<{ id: string } | null> => {
    if (!authHeader) return null;

    const token = authHeader.replace("Bearer ", "");
    if (supabaseAnonKey && token === supabaseAnonKey) {
      if (userIdHeader && userIdHeader.startsWith("anon_")) {
        return { id: userIdHeader };
      }
      return null;
    }

    if (!supabaseAuth) {
      return null;
    }

    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }

    return { id: data.user.id };
  };

  function mapProfile(record: any): User {
    return {
      id: record.id,
      energy: Number(record.energy) || 0,
      boost_level: Number(record.boost_level) || 0,
      last_watch_at: record.last_watch_at,
      boost_expires_at: record.boost_expires_at,
      created_at: record.created_at,
    };
  }

  async function getOrCreateUser(userId: string): Promise<User> {
    const db = getDatabaseClient();
    const rows = await db<User[]>`
      select *
      from ensure_profile(${userId})
    `;

    if (!rows || rows.length === 0) {
      throw new Error("Failed to load user profile");
    }

    return mapProfile(rows[0]);
  }

  async function updateUser(user: User): Promise<void> {
    const db = getDatabaseClient();
    await db`
      update profiles
      set energy = ${user.energy},
          boost_level = ${user.boost_level},
          last_watch_at = ${user.last_watch_at},
          boost_expires_at = ${user.boost_expires_at}
      where id = ${user.id}
    `;
  }

  app.get(`${FUNCTION_PREFIX}/health`, (c) => {
    return c.json({ status: "ok" });
  });

  app.post(`${FUNCTION_PREFIX}/user/init`, async (c) => {
    try {
      const authUser = await getUserFromAuth(c.req.header("Authorization"), c.req.header("X-User-ID"));
      if (!authUser) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const user = await getOrCreateUser(authUser.id);

      if (user.boost_expires_at && new Date(user.boost_expires_at) < new Date()) {
        user.boost_level = 0;
        user.boost_expires_at = null;
        await updateUser(user);
      }

      try {
        const db = getDatabaseClient();
        await db`
          insert into sessions (user_id)
          values (${authUser.id})
        `;
      } catch (error) {
        console.log("Error saving session:", error);
      }

      return c.json({
        user: {
          id: user.id,
          energy: user.energy,
          boost_level: user.boost_level,
          boost_expires_at: user.boost_expires_at,
        },
      });
    } catch (error) {
      console.log("Error initializing user:", error);
      return c.json({ error: "Failed to initialize user" }, 500);
    }
  });

  app.get(`${FUNCTION_PREFIX}/user/balance`, async (c) => {
    try {
      const authUser = await getUserFromAuth(c.req.header("Authorization"), c.req.header("X-User-ID"));
      if (!authUser) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const user = await getOrCreateUser(authUser.id);

      return c.json({
        energy: user.energy,
        boost_level: user.boost_level,
        multiplier: boostMultiplier(user.boost_level),
        boost_expires_at: user.boost_expires_at,
      });
    } catch (error) {
      console.log("Error fetching balance:", error);
      return c.json({ error: "Failed to fetch balance" }, 500);
    }
  });

  app.get(`${FUNCTION_PREFIX}/ads/next`, async (c) => {
    try {
      const authUser = await getUserFromAuth(c.req.header("Authorization"), c.req.header("X-User-ID"));
      if (!authUser) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      return c.json({
        id: "default_ad",
        url: "",
        reward: BASE_AD_REWARD,
        type: "partner",
      });
    } catch (error) {
      console.log("Error fetching next ad:", error);
      return c.json({ error: "Failed to fetch ad" }, 500);
    }
  });

  app.post(`${FUNCTION_PREFIX}/ads/complete`, async (c) => {
    try {
      const authUser = await getUserFromAuth(c.req.header("Authorization"), c.req.header("X-User-ID"));
      if (!authUser) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const body = await c.req.json();
      const { ad_id } = body;

      if (typeof ad_id !== "string" || ad_id.trim().length === 0) {
        return c.json({ error: "Missing ad_id" }, 400);
      }

      const db = getDatabaseClient();
      try {
        const rows = await db<{ result: CompleteAdWatchResult }[]>`
          select complete_ad_watch(
            ${authUser.id},
            ${ad_id},
            ${BASE_AD_REWARD},
            ${DAILY_VIEW_LIMIT},
            ${AD_COOLDOWN_SECONDS}
          ) as result
        `;

        const result = rows[0]?.result;
        if (!result) {
          console.log("complete_ad_watch returned no result for user", authUser.id);
          return c.json({ error: "Failed to complete ad watch" }, 500);
        }

        return c.json({
          success: true,
          reward: toNumber(result.reward),
          new_balance: toNumber(result.new_balance),
          multiplier: toNumber(result.multiplier),
          daily_watches_remaining: toNumber(result.daily_watches_remaining),
          boost_level: result.boost_level,
          boost_expires_at: result.boost_expires_at ?? null,
          last_watch_at: result.last_watch_at ?? null,
        });
      } catch (error) {
        const pgError = error as { message?: string; detail?: string; code?: string };
        const parsedDetails = parseJsonDetails(pgError.detail);

        if (pgError.message === "cooldown_active") {
          const remaining = typeof parsedDetails?.cooldown_remaining === "number"
            ? parsedDetails.cooldown_remaining
            : AD_COOLDOWN_SECONDS;
          return c.json({ error: "Cooldown active", cooldown_remaining: remaining }, 429);
        }

        if (pgError.message === "daily_limit_reached") {
          return c.json({ error: "Daily limit reached" }, 429);
        }

        console.log("Error completing ad watch via SQL:", error);
        return c.json({ error: "Failed to complete ad watch" }, 500);
      }
    } catch (error) {
      console.log("Error completing ad watch:", error);
      return c.json({ error: "Failed to complete ad watch" }, 500);
    }
  });

  app.post(`${FUNCTION_PREFIX}/orders/create`, async (c) => {
    try {
      const authUser = await getUserFromAuth(c.req.header("Authorization"), c.req.header("X-User-ID"));
      if (!authUser) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const body = await c.req.json();
      const { boost_level } = body;

      if (typeof boost_level !== "number" || boost_level < 1 || boost_level > 4) {
        return c.json({ error: "Invalid boost_level" }, 400);
      }

      const boost = BOOSTS.find((b) => b.level === boost_level);
      if (!boost) {
        return c.json({ error: "Boost not found" }, 404);
      }

      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const payload = `boost_${boost_level}_${authUser.id}_${Date.now()}`;
      const orderCreatedAt = new Date().toISOString();

      const db = getDatabaseClient();
      await db`
        insert into orders (id, user_id, boost_level, ton_amount, status, payload, tx_hash, created_at, updated_at)
        values (
          ${orderId},
          ${authUser.id},
          ${boost_level},
          ${boost.costTon},
          'pending',
          ${payload},
          null,
          ${orderCreatedAt},
          ${orderCreatedAt}
        )
      `;

      const merchantAddress = Deno.env.get("VITE_TON_MERCHANT_ADDRESS") || "UQD_merchant_address_placeholder";

      return c.json({
        order_id: orderId,
        address: merchantAddress,
        amount: boost.costTon,
        payload,
        boost_name: boost.name,
        duration_days: boost.durationDays,
      });
    } catch (error) {
      console.log("Error creating order:", error);
      return c.json({ error: "Failed to create order" }, 500);
    }
  });

  app.get(`${FUNCTION_PREFIX}/orders/:orderId`, async (c) => {
    try {
      const authUser = await getUserFromAuth(c.req.header("Authorization"), c.req.header("X-User-ID"));
      if (!authUser) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const orderId = c.req.param("orderId");
      const db = getDatabaseClient();
      const rows = await db<Order[]>`
        select *
        from orders
        where id = ${orderId}
        limit 1
      `;

      const order = rows[0];
      if (!order) {
        return c.json({ error: "Order not found" }, 404);
      }

      if (order.user_id !== authUser.id) {
        return c.json({ error: "Unauthorized" }, 403);
      }

      return c.json({
        order_id: order.id,
        status: order.status,
        boost_level: order.boost_level,
        ton_amount: toNumber(order.ton_amount),
        tx_hash: order.tx_hash,
        created_at: order.created_at,
      });
    } catch (error) {
      console.log("Error checking order status:", error);
      return c.json({ error: "Failed to check order status" }, 500);
    }
  });

  app.post(`${FUNCTION_PREFIX}/orders/:orderId/confirm`, async (c) => {
    try {
      const authUser = await getUserFromAuth(c.req.header("Authorization"), c.req.header("X-User-ID"));
      if (!authUser) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const orderId = c.req.param("orderId");
      const db = getDatabaseClient();
      const rows = await db<Order[]>`
        select *
        from orders
        where id = ${orderId}
        limit 1
      `;

      const order = rows[0];
      if (!order) {
        return c.json({ error: "Order not found" }, 404);
      }

      if (order.user_id !== authUser.id) {
        return c.json({ error: "Unauthorized" }, 403);
      }

      if (order.status !== "pending") {
        return c.json({ error: "Order already processed" }, 400);
      }

      const body = await c.req.json().catch(() => ({}));
      const txHash = typeof body.tx_hash === "string" && body.tx_hash.length > 0
        ? body.tx_hash
        : `demo_tx_${Date.now()}`;

      await db`
        update orders
        set status = 'paid',
            tx_hash = ${txHash},
            updated_at = ${new Date().toISOString()}
        where id = ${orderId}
      `;

      const user = await getOrCreateUser(authUser.id);
      user.boost_level = order.boost_level;

      const boost = BOOSTS.find((b) => b.level === order.boost_level);
      if (boost?.durationDays) {
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
      console.log("Error confirming order:", error);
      return c.json({ error: "Failed to confirm order" }, 500);
    }
  });

  app.get(`${FUNCTION_PREFIX}/stats`, async (c) => {
    try {
      const authUser = await getUserFromAuth(c.req.header("Authorization"), c.req.header("X-User-ID"));
      if (!authUser) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const user = await getOrCreateUser(authUser.id);
      const db = getDatabaseClient();

      const watchStatsRows = await db<{ total_watches: number | string | null; total_reward: number | string | null }[]>`
        select total_watches, total_reward
        from v_user_watch_stats
        where user_id = ${authUser.id}
        limit 1
      `;

      const watchStats = watchStatsRows[0];
      const totalWatches = watchStats ? toNumber(watchStats.total_watches) : 0;
      const totalEarned = watchStats ? toNumber(watchStats.total_reward) : 0;

      const watchHistoryData = await db<{
        user_id: string;
        ad_id: string;
        reward: number;
        base_reward: number;
        multiplier: number | string;
        created_at: string;
      }[]>`
        select user_id, ad_id, reward, base_reward, multiplier, created_at
        from ad_watches
        where user_id = ${authUser.id}
        order by created_at desc
        limit 20
      `;

      const parsedWatchLogs = watchHistoryData.map((log) => ({
        user_id: log.user_id,
        ad_id: log.ad_id,
        reward: toNumber(log.reward),
        base_reward: toNumber(log.base_reward),
        multiplier: toNumber(log.multiplier),
        created_at: log.created_at,
      }));

      const sessionCountRows = await db<{ count: number | string | bigint }[]>`
        select count(*)::bigint as count
        from sessions
        where user_id = ${authUser.id}
      `;
      const totalSessions = toNumber(sessionCountRows[0]?.count ?? 0);

      const now = new Date();
      const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const endOfDay = new Date(startOfDay);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

      const todayCountRows = await db<{ count: number | string | bigint }[]>`
        select count(*)::bigint as count
        from ad_watches
        where user_id = ${authUser.id}
          and created_at >= ${startOfDay.toISOString()}
          and created_at < ${endOfDay.toISOString()}
      `;
      const todayWatches = toNumber(todayCountRows[0]?.count ?? 0);

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
      console.log("Error fetching stats:", error);
      return c.json({ error: "Failed to fetch stats" }, 500);
    }
  });

  app.get(`${FUNCTION_PREFIX}/rewards/status`, async (c) => {
    try {
      const authUser = await getUserFromAuth(c.req.header("Authorization"), c.req.header("X-User-ID"));
      if (!authUser) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const db = getDatabaseClient();
      const claimedRewards = await db<{ partner_id: string }[]>`
        select partner_id
        from reward_claims
        where user_id = ${authUser.id}
      `;

      const claimedPartners = claimedRewards.map((claim) => claim.partner_id);

      return c.json({
        claimed_partners: claimedPartners,
        available_rewards: 0,
      });
    } catch (error) {
      console.log("Error fetching reward status:", error);
      return c.json({ error: "Failed to fetch reward status" }, 500);
    }
  });

  app.post(`${FUNCTION_PREFIX}/rewards/claim`, async (c) => {
    try {
      const authUser = await getUserFromAuth(c.req.header("Authorization"), c.req.header("X-User-ID"));
      if (!authUser) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const body = await c.req.json();
      const { partner_id, partner_name, reward_amount } = body;

      if (!partner_id || typeof partner_id !== "string") {
        return c.json({ error: "Missing or invalid partner_id" }, 400);
      }

      if (!reward_amount || typeof reward_amount !== "number") {
        return c.json({ error: "Invalid reward amount" }, 400);
      }

      const db = getDatabaseClient();
      const existingClaim = await db<{ id: number }[]>`
        select id
        from reward_claims
        where user_id = ${authUser.id}
          and partner_id = ${partner_id}
        limit 1
      `;

      if (existingClaim.length > 0) {
        return c.json({ error: "Reward already claimed" }, 400);
      }

      const user = await getOrCreateUser(authUser.id);
      user.energy += reward_amount;
      await updateUser(user);

      const claimedAt = new Date().toISOString();

      await db`
        insert into reward_claims (user_id, partner_id, reward, claimed_at)
        values (${authUser.id}, ${partner_id}, ${reward_amount}, ${claimedAt})
      `;

      await db`
        insert into reward_logs (user_id, partner_id, reward, created_at)
        values (${authUser.id}, ${partner_id}, ${reward_amount}, ${claimedAt})
      `;

      return c.json({
        success: true,
        reward: reward_amount,
        new_balance: user.energy,
        partner_name: typeof partner_name === "string" ? partner_name : "Partner",
      });
    } catch (error) {
      console.log("Error claiming reward:", error);
      return c.json({ error: "Failed to claim reward" }, 500);
    }
  });

  return app;
}
