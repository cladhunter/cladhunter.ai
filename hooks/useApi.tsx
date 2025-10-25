import { useState, useCallback, useMemo } from 'react';
import {
  claimReward,
  type ClaimRewardInput,
  completeAdWatch,
  type CompleteAdInput,
  confirmOrder,
  type ConfirmOrderInput,
  createOrder,
  type CreateOrderInput,
  getRewardStatus,
  type RewardStatusInput,
  getUserBalance,
  type BalanceInput,
  getUserStats,
  type StatsInput,
  initUser,
  type InitUserInput,
} from '../utils/api/sqlClient';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async <T>(action: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await action();
      setLoading(false);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('SQL API error:', message);
      setError(message);
      setLoading(false);
      return null;
    }
  }, []);

  const api = useMemo(() => ({
    initUser: (input: InitUserInput) => execute(() => initUser(input)),
    getUserBalance: (input: BalanceInput) => execute(() => getUserBalance(input)),
    completeAdWatch: (input: CompleteAdInput) => execute(() => completeAdWatch(input)),
    createOrder: (input: CreateOrderInput) => execute(() => createOrder(input)),
    confirmOrder: (input: ConfirmOrderInput) => execute(() => confirmOrder(input)),
    getUserStats: (input: StatsInput) => execute(() => getUserStats(input)),
    getRewardStatus: (input: RewardStatusInput) => execute(() => getRewardStatus(input)),
    claimReward: (input: ClaimRewardInput) => execute(() => claimReward(input)),
  }), [execute]);

  return {
    ...api,
    loading,
    error,
  };
}
