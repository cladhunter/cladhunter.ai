import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useApi } from './useApi';

export interface UserData {
  id: string;
  energy: number;
  boost_level: number;
  boost_expires_at: string | null;
  country_code: string | null;
}

export function useUserData() {
  const { user } = useAuth();
  const { initUser, getUserBalance } = useApi();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshBalance = useCallback(async () => {
    if (!user) return;

    const data = await getUserBalance({
      userId: user.id,
      walletAddress: user.address,
    });

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
  }, [user, getUserBalance]);

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

      const data = await initUser({
        userId: user.id,
        walletAddress: user.address,
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
  }, [user, initUser]);

  return { userData, loading, refreshBalance };
}
