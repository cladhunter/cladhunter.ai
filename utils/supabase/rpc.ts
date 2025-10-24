import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureSupabaseAuth, getSupabaseClient } from './client';

export interface SupabaseRpcError extends Error {
  code?: string;
  hint?: string | null;
  details?: unknown;
}

function toRpcError(functionName: string, error: { message: string; code?: string; hint?: string | null; details?: unknown }): SupabaseRpcError {
  const err = new Error(error?.message || `RPC ${functionName} failed`);
  (err as SupabaseRpcError).code = error?.code;
  (err as SupabaseRpcError).hint = error?.hint ?? null;
  (err as SupabaseRpcError).details = error?.details;
  return err as SupabaseRpcError;
}

export async function callRpcFunction<T = unknown>(
  functionName: string,
  params?: Record<string, unknown>,
  client?: SupabaseClient,
): Promise<T> {
  const supabase = client ?? getSupabaseClient();
  await ensureSupabaseAuth();

  const { data, error } = await supabase.rpc(functionName, params ?? {});

  if (error) {
    throw toRpcError(functionName, error);
  }

  return (data ?? null) as T;
}

export async function completeAdWatchRpc<T = unknown>(
  payload: { ad_id: string; wallet_address?: string | null },
  client?: SupabaseClient,
): Promise<T> {
  return callRpcFunction<T>('complete_ad_watch', payload, client);
}

export async function claimPartnerRewardRpc<T = unknown>(
  payload: { partner_id: string; wallet_address?: string | null },
  client?: SupabaseClient,
): Promise<T> {
  return callRpcFunction<T>('claim_partner_reward_v2', payload, client);
}
