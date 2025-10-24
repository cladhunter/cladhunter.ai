// Smoke test for Supabase edge function routes using public anon key only
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
};

(globalThis as any).Deno = {
  env: {
    get(key: string) {
      return process.env[key] ?? null;
    },
  },
  serve() {
    // Suppress server start during tests
  },
};

const { app } = await import('../supabase/functions/server/index.tsx');

const headers = {
  Authorization: 'Bearer public-anon-key',
  'X-User-ID': 'anon_test_user',
  'Content-Type': 'application/json',
};

const initResponse = await app.request('http://localhost/make-server-0f597298/user/init', {
  method: 'POST',
  headers,
  body: JSON.stringify({}),
});

if (initResponse.status !== 200) {
  throw new Error(`init failed with status ${initResponse.status}`);
}

const initData = await initResponse.json();
console.log('Init response:', initData);

const completeResponse = await app.request('http://localhost/make-server-0f597298/ads/complete', {
  method: 'POST',
  headers,
  body: JSON.stringify({ ad_id: 'test_ad' }),
});

if (completeResponse.status !== 200) {
  throw new Error(`ads/complete failed with status ${completeResponse.status}`);
}

const completeData = await completeResponse.json();
console.log('Ads complete response:', completeData);

if (!completeData.success) {
  throw new Error('ads/complete did not return success');
}

if (typeof completeData.new_balance !== 'number' || completeData.new_balance <= 0) {
  throw new Error('ads/complete did not update balance');
}
