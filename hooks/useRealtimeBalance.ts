import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';

interface BalanceRow {
  user_id: string;
  balance: number;
  updated_at?: string;
}

interface UseRealtimeBalanceResult {
  balance: number;
  loading: boolean;
  error: string | null;
  updateBalance: (value: number | ((previous: number) => number)) => void;
}

function extractBalance(row: Partial<BalanceRow> | null | undefined): number | null {
  if (!row || typeof row !== 'object') {
    return null;
  }

  if (typeof row.balance === 'number' && Number.isFinite(row.balance)) {
    return row.balance;
  }

  const candidate = (row as Record<string, unknown>).amount;
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate;
  }

  return null;
}

export function useRealtimeBalance(userId: string | null | undefined): UseRealtimeBalanceResult {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(Boolean(userId));
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const updateBalance = useCallback((value: number | ((previous: number) => number)) => {
    setBalance(prev => {
      const safePrev = Number.isFinite(prev) ? prev : 0;
      if (typeof value === 'function') {
        return value(safePrev);
      }
      return value;
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchInitialBalance(currentUserId: string) {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('balances')
        .select('balance')
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (fetchError) {
        const shouldIgnore = fetchError.code === 'PGRST116';
        if (!shouldIgnore) {
          console.warn('[balances] Failed to fetch initial balance:', fetchError.message);
          setError(fetchError.message);
        }
      }

      const initialBalance = extractBalance(data ?? undefined);
      if (initialBalance !== null) {
        setBalance(initialBalance);
      }

      setLoading(false);
    }

    function subscribeToBalanceChanges(currentUserId: string) {
      const channel = supabase
        .channel(`balances:user:${currentUserId}`)
        .on<BalanceRow>('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'balances',
          filter: `user_id=eq.${currentUserId}`,
        }, payload => {
          const nextBalance = extractBalance(payload.new as Partial<BalanceRow>);
          if (nextBalance !== null) {
            setBalance(nextBalance);
          } else if (payload.eventType === 'DELETE') {
            setBalance(0);
          }
        })
        .subscribe(status => {
          if (status === 'CHANNEL_ERROR') {
            console.error('[balances] Realtime subscription error');
            setError('Realtime subscription error');
          }
        });

      channelRef.current = channel;
    }

    if (!userId) {
      setBalance(0);
      setLoading(false);
      setError(null);
      return () => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      };
    }

    fetchInitialBalance(userId).catch(error => {
      console.error('[balances] Unexpected error fetching balance:', error);
      if (isMounted) {
        setError(error instanceof Error ? error.message : 'Failed to load balance');
        setLoading(false);
      }
    });
    subscribeToBalanceChanges(userId);

    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, userId]);

  return { balance, loading, error, updateBalance };
}
