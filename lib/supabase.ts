import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/supabase/info';

function readEnv(key: string): string | undefined {
  // Vite/Next expose environment variables differently depending on runtime
  if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined') {
    const value = import.meta.env[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  if (typeof process !== 'undefined' && typeof process.env !== 'undefined') {
    const value = process.env[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function normalizeUrl(url: string) {
  return url.trim().replace(/\/+$/, '');
}

const envSupabaseUrl =
  readEnv('NEXT_PUBLIC_SUPABASE_URL') ??
  readEnv('VITE_SUPABASE_URL');

const envSupabaseAnonKey =
  readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ??
  readEnv('VITE_SUPABASE_ANON_KEY');

const fallbackUrl = `https://${projectId}.supabase.co`;

const supabaseUrl = envSupabaseUrl ? normalizeUrl(envSupabaseUrl) : fallbackUrl;
const supabaseAnonKey = envSupabaseAnonKey ?? publicAnonKey;

const envFunctionBaseUrl =
  readEnv('NEXT_PUBLIC_SUPABASE_FUNCTION_URL') ??
  readEnv('VITE_SUPABASE_FUNCTION_URL');

const envFunctionProxyUrl =
  readEnv('NEXT_PUBLIC_SUPABASE_FUNCTION_PROXY_URL') ??
  readEnv('VITE_SUPABASE_FUNCTION_PROXY_URL');

const missingEnvVars = [
  envSupabaseUrl ? null : 'NEXT_PUBLIC_SUPABASE_URL',
  envSupabaseAnonKey ? null : 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
].filter(Boolean) as string[];

if (missingEnvVars.length > 0) {
  const variablesList = missingEnvVars.join(', ');
  const baseMessage = `Supabase environment ${missingEnvVars.length > 1 ? 'variables' : 'variable'} ${variablesList} ${missingEnvVars.length > 1 ? 'are' : 'is'} not set.`;
  const guidanceMessage = `${baseMessage} Configure them to avoid using the shared credentials from utils/supabase/info.tsx.`;

  if (typeof window === 'undefined') {
    console.warn(`[supabase] ${guidanceMessage}`);
  } else {
    console.warn(`[supabase] ${guidanceMessage}`);
    window.setTimeout(() => {
      toast.warning(`${baseMessage} Add ${variablesList} to your environment.`);
    }, 0);
  }
}

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }

  return supabaseClient;
}

export function getAuthHeaders(accessToken?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken || supabaseAnonKey}`,
  };
}

function resolveFunctionBaseUrl(): string {
  if (envFunctionBaseUrl && envFunctionBaseUrl.trim().length > 0) {
    return normalizeUrl(envFunctionBaseUrl);
  }

  return `${supabaseUrl}/functions/v1/make-server-0f597298`;
}

function resolveFunctionProxyUrl(): string | null {
  if (envFunctionProxyUrl && envFunctionProxyUrl.trim().length > 0) {
    return normalizeUrl(envFunctionProxyUrl);
  }

  const isBrowser = typeof window !== 'undefined';
  const isVercelRuntime = typeof process !== 'undefined' && Boolean(process.env.VERCEL);

  if (isBrowser || isVercelRuntime) {
    return '/api/make-server-0f597298';
  }

  return null;
}

export function getApiBaseUrls() {
  const primary = resolveFunctionBaseUrl();
  const fallback = resolveFunctionProxyUrl();

  return {
    primary,
    fallback,
  } as const;
}

export const API_BASE_URL = resolveFunctionBaseUrl();

export const supabaseCredentials = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
};
