import { useState, useCallback } from 'react';
import { ensureSupabaseAuth, getSupabaseClient } from '../utils/supabase/client';
import { callRpcFunction, claimPartnerRewardRpc, completeAdWatchRpc } from '../utils/supabase/rpc';

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const err = error as { message: string };
    return new Error(err.message || 'Unknown error occurred');
  }

  return new Error('Unknown error occurred');
}

export function useApi() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callRpc = useCallback(async <T,>(
    functionName: string,
    params?: Record<string, unknown>,
  ): Promise<T> => {
    setLoading(true);
    setError(null);

    try {
      const result = await callRpcFunction<T>(functionName, params, supabase);
      return result;
    } catch (err) {
      const formatted = toError(err);
      setError(formatted.message);
      throw formatted;
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const invokeEdgeFunction = useCallback(async <T,>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: Record<string, unknown> | undefined;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T> => {
    setLoading(true);
    setError(null);

    try {
      await ensureSupabaseAuth();
      const { data, error: invokeError } = await supabase.functions.invoke(`make-server-0f597298${endpoint}`, {
        method: options.method ?? 'GET',
        body: options.body,
        headers: options.headers,
      });

      if (invokeError) {
        throw toError(invokeError);
      }

      return (data ?? null) as T;
    } catch (err) {
      const formatted = toError(err);
      setError(formatted.message);
      throw formatted;
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const completeAdWatch = useCallback(async <T = unknown>(
    payload: { ad_id: string; wallet_address?: string | null }
  ): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      const result = await completeAdWatchRpc<T>(payload, supabase);
      return result;
    } catch (err) {
      const formatted = toError(err);
      setError(formatted.message);
      throw formatted;
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const claimPartnerReward = useCallback(async <T = unknown>(
    payload: { partner_id: string; wallet_address?: string | null }
  ): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      const result = await claimPartnerRewardRpc<T>(payload, supabase);
      return result;
    } catch (err) {
      const formatted = toError(err);
      setError(formatted.message);
      throw formatted;
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  return {
    loading,
    error,
    callRpc,
    invokeEdgeFunction,
    completeAdWatch,
    claimPartnerReward,
  };
}
