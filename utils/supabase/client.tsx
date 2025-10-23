import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from './info';

const envSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? undefined;
const envSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? undefined;

const fallbackUrl = `https://${projectId}.supabase.co`;

function normalizeUrl(url: string) {
  return url.trim().replace(/\/+$/, '');
}

const hasEnvSupabaseUrl = typeof envSupabaseUrl === 'string' && envSupabaseUrl.trim().length > 0;
const hasEnvSupabaseAnonKey = typeof envSupabaseAnonKey === 'string' && envSupabaseAnonKey.trim().length > 0;

const supabaseUrl = normalizeUrl(hasEnvSupabaseUrl ? envSupabaseUrl! : fallbackUrl);
const supabaseAnonKey = hasEnvSupabaseAnonKey ? envSupabaseAnonKey!.trim() : publicAnonKey;

const missingEnvVars = [
  !hasEnvSupabaseUrl ? 'VITE_SUPABASE_URL' : null,
  !hasEnvSupabaseAnonKey ? 'VITE_SUPABASE_ANON_KEY' : null,
].filter(Boolean) as string[];

if (missingEnvVars.length > 0) {
  const variablesList = missingEnvVars.join(', ');
  const baseMessage = `Supabase environment ${missingEnvVars.length > 1 ? 'variables' : 'variable'} ${variablesList} ${missingEnvVars.length > 1 ? 'are' : 'is'} not set.`;
  const guidanceMessage = `${baseMessage} Configure them to avoid using the shared credentials from utils/supabase/info.tsx.`;

  if (import.meta.env.PROD) {
    throw new Error(`${guidanceMessage} Set ${variablesList} before deploying.`);
  }

  console.warn(`[supabase] ${guidanceMessage}`);

  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      toast.warning(`${baseMessage} Add ${variablesList} to your .env file.`);
    }, 0);
  }
}

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
