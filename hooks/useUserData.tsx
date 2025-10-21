import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useApi } from './useApi';

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
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    if (!user) return;

    const data = await makeRequest<{ user: UserData }>(
      '/user/init',
      { method: 'POST' },
      user.accessToken,
      user.id
    );

    if (data) {
      setUserData(data.user);
    }
    setLoading(false);
  }, [user, makeRequest]);

  const refreshBalance = useCallback(async () => {
    if (!user) return;

    const data = await makeRequest<{
      energy: number;
      boost_level: number;
      multiplier: number;
      boost_expires_at: string | null;
    }>('/user/balance', { method: 'GET' }, user.accessToken, user.id);

    if (data && userData) {
      setUserData({
        ...userData,
        energy: data.energy,
        boost_level: data.boost_level,
        boost_expires_at: data.boost_expires_at,
      });
    }
  }, [user, userData, makeRequest]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  return { userData, loading, refreshBalance };
}