import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

const API_ROUTE_PREFIX = '/make-server-0f597298';
const LOCAL_WORKER_ORIGIN = 'http://127.0.0.1:8787';

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

function buildSameOriginFallback(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const origin = window.location.origin.replace(/\/$/, '');
  return `${origin}${API_ROUTE_PREFIX}`;
}

function resolveApiBaseUrl(): string {
  const envApiBase = (import.meta.env?.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '');

  if (envApiBase) {
    return envApiBase;
  }

  if (import.meta.env?.DEV) {
    const localWorkerBase = `${LOCAL_WORKER_ORIGIN}${API_ROUTE_PREFIX}`;
    console.warn(
      '[Cladhunter] VITE_API_BASE_URL is not set – defaulting to local Cloudflare worker at',
      localWorkerBase,
    );
    return localWorkerBase;
  }

  const sameOriginBase = buildSameOriginFallback();
  if (sameOriginBase) {
    console.warn(
      '[Cladhunter] VITE_API_BASE_URL is not set – attempting same-origin worker at',
      sameOriginBase,
      'Set VITE_API_BASE_URL if your API lives on a different domain.',
    );
    return sameOriginBase;
  }

  throw new Error(
    'VITE_API_BASE_URL is not configured. Set it to the Cloudflare Worker endpoint (including /make-server-0f597298).',
  );
}

export const API_BASE_URL = resolveApiBaseUrl();