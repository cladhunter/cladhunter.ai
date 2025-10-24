import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

let supabaseClient: SupabaseClient | null = null;
let authPromise: Promise<void> | null = null;

function createBrowserClient(): SupabaseClient {
  const supabaseUrl = `https://${projectId}.supabase.co`;
  return createSupabaseClient(supabaseUrl, publicAnonKey);
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createBrowserClient();
  }
  return supabaseClient;
}

async function performAnonymousSignIn(client: SupabaseClient) {
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw error;
  }

  if (!data.session) {
    const { error: signInError } = await client.auth.signInAnonymously();
    if (signInError) {
      throw signInError;
    }
  }
}

export async function ensureSupabaseAuth(): Promise<void> {
  const client = getSupabaseClient();

  if (authPromise) {
    return authPromise;
  }

  authPromise = (async () => {
    try {
      await performAnonymousSignIn(client);
    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  const client = getSupabaseClient();
  await ensureSupabaseAuth();
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}
