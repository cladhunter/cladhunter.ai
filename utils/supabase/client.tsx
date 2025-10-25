import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

type SupabaseClient = ReturnType<typeof createSupabaseClient>;

let cachedSupabaseClient: SupabaseClient | null = null;

function readEnvValue(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env && key in process.env) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }

  if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined') {
    const env = import.meta.env as Record<string, string | undefined>;
    const value = env[key];
    if (value) {
      return value;
    }
  }

  return undefined;
}

function resolveSupabaseUrl(): string {
  const fromEnv =
    readEnvValue('VITE_SUPABASE_URL') ||
    readEnvValue('SUPABASE_URL');

  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  return `https://${projectId}.supabase.co`;
}

function resolveSupabaseAnonKey(): string {
  return (
    readEnvValue('VITE_SUPABASE_ANON_KEY') ||
    readEnvValue('SUPABASE_ANON_KEY') ||
    publicAnonKey
  );
}

const resolvedSupabaseUrl = resolveSupabaseUrl();
const resolvedAnonKey = resolveSupabaseAnonKey();

function resolveOverride(): SupabaseClient | null {
  const globalObject = globalThis as Record<string, unknown> & {
    __supabaseClientOverride?: SupabaseClient;
  };

  return globalObject.__supabaseClientOverride ?? null;
}

export function createClient(): SupabaseClient {
  const override = resolveOverride();
  if (override) {
    return override;
  }

  if (!cachedSupabaseClient) {
    cachedSupabaseClient = createSupabaseClient(resolvedSupabaseUrl, resolvedAnonKey);
  }

  return cachedSupabaseClient;
}

export const supabase = createClient();
