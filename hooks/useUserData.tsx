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
  const { invokeEdgeFunction } = useApi();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshBalance = useCallback(async () => {
    if (!user) return;

    const data = await invokeEdgeFunction<{
      energy: number;
      boost_level: number;
      multiplier: number;
      boost_expires_at: string | null;
    }>('/user/balance', { method: 'GET' });

    if (data) {
      setUserData((current) =>
        current
          ? {
              ...current,
              energy: data.energy,
              boost_level: data.boost_level,
              boost_expires_at: data.boost_expires_at,
            }
          : current,
      );
    }
  }, [user, invokeEdgeFunction]);

  useEffect(() => {
    let isActive = true;

    const loadUserData = async () => {
      if (!user) {
        if (isActive) {
          setUserData(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      const data = await invokeEdgeFunction<{ user: UserData }>('/user/init', {
        method: 'POST',
        body: { wallet_address: user.address },
      });

      if (data && isActive) {
        setUserData(data.user);
      }

      if (isActive) {
        setLoading(false);
      }
    };

    loadUserData();

    return () => {
      isActive = false;
    };
  }, [user, invokeEdgeFunction]);

  return { userData, loading, refreshBalance };
}
