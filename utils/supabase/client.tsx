import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

let supabaseClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (!projectId || !publicAnonKey) {
    throw new Error('Supabase project configuration is missing.');
  }

  if (!supabaseClient) {
    const supabaseUrl = `https://${projectId}.supabase.co`;
    supabaseClient = createSupabaseClient(supabaseUrl, publicAnonKey);
  }
  return supabaseClient;
}

export function getAuthHeaders(accessToken?: string): HeadersInit {
  const token = accessToken || publicAnonKey;

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

function resolveApiBaseUrl(): string {
  const envApiBase = (import.meta.env?.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '');

  if (envApiBase) {
    return envApiBase;
  }

  if (import.meta.env?.DEV) {
    const localWorkerBase = 'http://127.0.0.1:8787/make-server-0f597298';
    console.warn(
      '[Cladhunter] VITE_API_BASE_URL is not set – defaulting to local Cloudflare worker at',
      localWorkerBase,
    );
    return localWorkerBase;
  }

  throw new Error(
    'VITE_API_BASE_URL is not configured. Set it to the Cloudflare Worker endpoint (including /make-server-0f597298).',
  );
}

export const API_BASE_URL = resolveApiBaseUrl();