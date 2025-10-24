import { beforeEach, describe, expect, it, vi } from 'vitest';

const createHeaders = () => ({
  Authorization: 'Bearer public-anon-key',
  'X-User-ID': 'anon_kv_object_user',
  'Content-Type': 'application/json',
});

let inMemory: Map<string, any>;

const setupEnvironment = () => {
  process.env.PUBLIC_SUPABASE_ANON_KEY = 'public-anon-key';
  delete process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

  inMemory = new Map<string, any>();

  (globalThis as any).__kvOverride = {
    async set(key: string, value: any) {
      inMemory.set(key, value);
    },
    async get(key: string) {
      return inMemory.get(key) ?? null;
    },
    async del(key: string) {
      inMemory.delete(key);
    },
    async mset(keys: string[], values: any[]) {
      keys.forEach((key, idx) => {
        inMemory.set(key, values[idx]);
      });
    },
    async mget(keys: string[]) {
      return keys.map((key) => inMemory.get(key) ?? null);
    },
    async mdel(keys: string[]) {
      keys.forEach((key) => inMemory.delete(key));
    },
    async getByPrefix(prefix: string) {
      const results: any[] = [];
      for (const [key, value] of inMemory.entries()) {
        if (key.startsWith(prefix)) {
          results.push(value);
        }
      }
      return results;
    },
    async incrementUserEnergyAndWatchCount({
      userKey,
      energyDelta,
      lastWatchAt,
      watchCountKey,
      watchIncrement,
      dailyLimit,
      adId,
      baseReward,
      multiplier,
      countryCode,
    }: any) {
      const userValue = inMemory.get(userKey);
      if (!userValue) {
        throw new Error(`Missing user ${userKey}`);
      }

      const user =
        typeof userValue === 'string' ? JSON.parse(userValue) : { ...userValue };

      const currentCountValue = inMemory.get(watchCountKey);
      const currentCount =
        typeof currentCountValue === 'string'
          ? JSON.parse(currentCountValue)
          : typeof currentCountValue === 'number'
            ? currentCountValue
            : 0;

      const nextCount = currentCount + watchIncrement;
      if (typeof dailyLimit === 'number' && nextCount > dailyLimit) {
        const error: any = new Error('DAILY_LIMIT_EXCEEDED');
        error.code = 'P0001';
        throw error;
      }

      user.energy = (user.energy ?? 0) + energyDelta;
      user.last_watch_at = lastWatchAt;

      inMemory.set(userKey, typeof userValue === 'string' ? JSON.stringify(user) : user);
      inMemory.set(watchCountKey, nextCount);

      const watchLogKey = `watch:${user.id}:${lastWatchAt}`;
      inMemory.set(watchLogKey, {
        user_id: user.id,
        ad_id: adId,
        reward: energyDelta,
        base_reward: baseReward,
        multiplier,
        country_code: countryCode ?? null,
        created_at: lastWatchAt,
      });

      return { user, watch_count: nextCount };
    },
    async claimPartnerRewardAtomic({ userKey, energyDelta, claimKey, claimValue }: any) {
      if (inMemory.has(claimKey)) {
        const error: any = new Error('REWARD_ALREADY_CLAIMED');
        error.code = '23505';
        throw error;
      }

      const userValue = inMemory.get(userKey);
      if (!userValue) {
        throw new Error(`Missing user ${userKey}`);
      }

      const user =
        typeof userValue === 'string' ? JSON.parse(userValue) : { ...userValue };

      user.energy = (user.energy ?? 0) + energyDelta;

      inMemory.set(userKey, typeof userValue === 'string' ? JSON.stringify(user) : user);
      inMemory.set(claimKey, claimValue);

      return { user };
    },
  };

  (globalThis as any).Deno = {
    env: {
      get(key: string) {
        return process.env[key] ?? null;
      },
    },
    serve() {
      // no-op for tests
    },
  };

  const createQueryBuilder = (table: string) => {
    let selectArg = '';
    const builder = {
      select: vi.fn((arg: string) => {
        selectArg = arg ?? '';
        return builder;
      }),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      limit: vi.fn(async () => ({ data: [], error: null })),
      maybeSingle: vi.fn(async () => {
        if (table === 'watch_logs' && selectArg.includes('total_watches')) {
          return { data: { total_watches: 1, total_earned: 10 }, error: null };
        }
        if (table === 'watch_logs' && selectArg.includes('today_watches')) {
          return { data: { today_watches: 1 }, error: null };
        }
        if (table === 'user_sessions' && selectArg.includes('total_sessions')) {
          return { data: { total_sessions: 1 }, error: null };
        }
        return { data: null, error: null };
      }),
    };

    return builder;
  };

  (globalThis as any).__supabaseClientOverride = {
    rpc: vi.fn(async () => ({ data: null, error: null })),
    from: vi.fn((table: string) => createQueryBuilder(table)),
  };
};

beforeEach(() => {
  vi.resetModules();
  setupEnvironment();
});

const loadApp = async () => {
  const mod = await import('../supabase/functions/server/index.tsx');
  return mod.app;
};

describe('supabase edge function kv object regression', () => {
  it('handles object values retrieved from KV store', async () => {
    const app = await loadApp();
    const headers = createHeaders();

    const userId = headers['X-User-ID'];
    const userKey = `user:${userId}`;

    inMemory.set(userKey, {
      id: userId,
      energy: 0,
      boost_level: 0,
      last_watch_at: null,
      boost_expires_at: null,
      created_at: new Date().toISOString(),
      wallet_address: null,
      country_code: 'ZZ',
    });

    const completeResponse = await app.request(
      'http://localhost/make-server-0f597298/ads/complete',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ ad_id: 'object_test_ad' }),
      },
    );

    expect(completeResponse.status).toBe(200);
    const completeBody = await completeResponse.json();
    expect(completeBody.success).toBe(true);
    expect(completeBody.reward).toBeGreaterThan(0);

    const statsResponse = await app.request('http://localhost/make-server-0f597298/stats', {
      method: 'GET',
      headers,
    });

    expect(statsResponse.status).toBe(200);
    const statsBody = await statsResponse.json();
    expect(statsBody?.totals?.energy).toBe(completeBody.new_balance);
    expect(statsBody?.totals?.watches).toBeGreaterThanOrEqual(1);
  });
});
