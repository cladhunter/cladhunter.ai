import { beforeEach, describe, expect, it, vi } from 'vitest';

const createHeaders = () => ({
  Authorization: 'Bearer public-anon-key',
  'X-User-ID': 'anon_parallel_user',
  'Content-Type': 'application/json',
});

const setupEnvironment = () => {
  process.env.PUBLIC_SUPABASE_ANON_KEY = 'public-anon-key';
  delete process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

  const inMemory = new Map<string, string>();

  (globalThis as any).__kvOverride = {
    async set(key: string, value: any) {
      inMemory.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    async get(key: string) {
      return inMemory.get(key) ?? null;
    },
    async del(key: string) {
      inMemory.delete(key);
    },
    async mset(keys: string[], values: any[]) {
      keys.forEach((key, idx) => {
        const value = values[idx];
        inMemory.set(key, typeof value === 'string' ? value : JSON.stringify(value));
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
          try {
            results.push(JSON.parse(value));
          } catch {
            results.push(value);
          }
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
    }: any) {
      const userRaw = inMemory.get(userKey);
      if (!userRaw) {
        throw new Error(`Missing user ${userKey}`);
      }
      const user = JSON.parse(userRaw);
      const currentCountRaw = inMemory.get(watchCountKey);
      const currentCount = currentCountRaw ? JSON.parse(currentCountRaw) : 0;
      const nextCount = currentCount + watchIncrement;
      if (typeof dailyLimit === 'number' && nextCount > dailyLimit) {
        const error: any = new Error('DAILY_LIMIT_EXCEEDED');
        error.code = 'P0001';
        throw error;
      }
      user.energy += energyDelta;
      user.last_watch_at = lastWatchAt;
      inMemory.set(userKey, JSON.stringify(user));
      inMemory.set(watchCountKey, JSON.stringify(nextCount));
      return { user, watch_count: nextCount };
    },
    async claimPartnerRewardAtomic({ userKey, energyDelta, claimKey, claimValue }: any) {
      if (inMemory.has(claimKey)) {
        const error: any = new Error('REWARD_ALREADY_CLAIMED');
        error.code = '23505';
        throw error;
      }
      const userRaw = inMemory.get(userKey);
      if (!userRaw) {
        throw new Error(`Missing user ${userKey}`);
      }
      const user = JSON.parse(userRaw);
      user.energy += energyDelta;
      inMemory.set(userKey, JSON.stringify(user));
      inMemory.set(claimKey, JSON.stringify(claimValue));
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

  return { inMemory };
};

beforeEach(() => {
  vi.resetModules();
  setupEnvironment();
});

const loadApp = async () => {
  const mod = await import('../supabase/functions/server/index.tsx');
  return mod.app;
};

describe('supabase edge function concurrency', () => {
  it('handles parallel ad completions without losing energy or exceeding limit', async () => {
    const app = await loadApp();
    const headers = createHeaders();

    const initResponse = await app.request('http://localhost/make-server-0f597298/user/init', {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });

    expect(initResponse.status).toBe(200);

    const parallel = await Promise.all(
      Array.from({ length: 5 }, () =>
        app.request('http://localhost/make-server-0f597298/ads/complete', {
          method: 'POST',
          headers,
          body: JSON.stringify({ ad_id: 'test_ad' }),
        }),
      ),
    );

    const successResponses = parallel.filter((response) => response.status === 200);
    expect(successResponses).toHaveLength(5);

    const payloads = await Promise.all(successResponses.map((response) => response.json()));
    const rewardPerWatch = payloads[0].reward;
    expect(rewardPerWatch).toBeGreaterThan(0);

    const balanceResponse = await app.request('http://localhost/make-server-0f597298/user/balance', {
      method: 'GET',
      headers,
    });

    expect(balanceResponse.status).toBe(200);

    const balanceData = await balanceResponse.json();
    expect(balanceData.energy).toBe(rewardPerWatch * successResponses.length);
    expect(payloads.every((data) => data.daily_watches_remaining >= 0)).toBe(true);
  });

  it('prevents duplicate reward claims under concurrency', async () => {
    const app = await loadApp();
    const headers = createHeaders();

    const initResponse = await app.request('http://localhost/make-server-0f597298/user/init', {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });

    expect(initResponse.status).toBe(200);

    const rewardPayload = {
      partner_id: 'partner_test',
      reward_amount: 100,
      partner_name: 'Test Partner',
    };

    const [first, second] = await Promise.all([
      app.request('http://localhost/make-server-0f597298/rewards/claim', {
        method: 'POST',
        headers,
        body: JSON.stringify(rewardPayload),
      }),
      app.request('http://localhost/make-server-0f597298/rewards/claim', {
        method: 'POST',
        headers,
        body: JSON.stringify(rewardPayload),
      }),
    ]);

    const responses = [first, second];
    const successCount = responses.filter((response) => response.status === 200).length;
    const conflictCount = responses.filter((response) => response.status === 400).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(1);

    const successBody = await responses.find((response) => response.status === 200)!.json();
    expect(successBody.new_balance).toBe(100);

    const conflictBody = await responses.find((response) => response.status === 400)!.json();
    expect(conflictBody.error).toBe('Reward already claimed');
  });
});
