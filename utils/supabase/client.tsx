import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

const envSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? undefined;
const envSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? undefined;

const fallbackUrl = `https://${projectId}.supabase.co`;

function normalizeUrl(url: string) {
  return url.replace(/\/+$/, '');
}

const supabaseUrl = normalizeUrl(envSupabaseUrl ?? fallbackUrl);
const supabaseAnonKey = envSupabaseAnonKey ?? publicAnonKey;

let supabaseClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseClient;
}

export function getAuthHeaders(accessToken?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken || supabaseAnonKey}`,
  };
}

export const API_BASE_URL = `${supabaseUrl}/functions/v1/make-server-0f597298`;