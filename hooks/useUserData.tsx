import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useApi } from './useApi';
import { useRealtimeBalance } from './useRealtimeBalance';

export interface UserData {
  id: string;
  energy: number;
  boost_level: number;
  boost_expires_at: string | null;
}

export function useUserData() {
  const { user } = useAuth();
  const { makeRequest } = useApi();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const {
    balance,
    loading: balanceLoading,
    error: balanceError,
    updateBalance,
  } = useRealtimeBalance(user?.id ?? null);

  const fetchUserData = useCallback(async () => {
    if (!user) {
      setUserData(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    const data = await makeRequest<{ user: UserData }>(
      '/user/init',
      { method: 'POST' },
      user.accessToken,
      user.id
    );

    if (data) {
      setUserData(data.user);
      updateBalance(data.user.energy);
    }
    setProfileLoading(false);
  }, [user, makeRequest, updateBalance]);

  const refreshBalance = useCallback(async () => {
    if (!user) return;

    const data = await makeRequest<{
      energy: number;
      boost_level: number;
      multiplier: number;
      boost_expires_at: string | null;
    }>('/user/balance', { method: 'GET' }, user.accessToken, user.id);

    if (data) {
      setUserData(prev => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          energy: data.energy,
          boost_level: data.boost_level,
          boost_expires_at: data.boost_expires_at,
        };
      });
      updateBalance(data.energy);
    }
  }, [user, makeRequest, updateBalance]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  useEffect(() => {
    if (!userData) return;

    setUserData(prev => {
      if (!prev) {
        return prev;
      }

      if (prev.energy === balance) {
        return prev;
      }

      return {
        ...prev,
        energy: balance,
      };
    });
  }, [balance, userData]);

  const loading = useMemo(() => profileLoading || balanceLoading, [profileLoading, balanceLoading]);

  return {
    userData,
    loading,
    refreshBalance,
    balance,
    balanceError,
    updateBalance,
  };
}