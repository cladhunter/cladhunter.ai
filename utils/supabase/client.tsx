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

const fallbackApiBase = projectId
  ? `https://${projectId}.supabase.co/functions/v1/make-server-0f597298`
  : '';

const configuredApiBase =
  (import.meta.env?.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  fallbackApiBase;

export const API_BASE_URL = configuredApiBase;