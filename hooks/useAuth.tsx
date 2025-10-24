import { useState, useEffect } from 'react';
import { useTonConnect } from './useTonConnect';

export interface AuthUser {
  id: string;
  address: string;
  chain: string;
  publicKey: string;
  accessToken: string;
}

function createAuthUserId(address: string) {
  const sanitized = address.replace(/[^a-zA-Z0-9_-]/g, '');
  return `ton_${sanitized}`;
}

export function useAuth() {
  const { wallet } = useTonConnect();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (wallet) {
      const authId = createAuthUserId(wallet.address);

      setUser((prevUser) => {
        if (
          prevUser &&
          prevUser.id === authId &&
          prevUser.address === wallet.address &&
          prevUser.chain === wallet.chain &&
          prevUser.publicKey === wallet.publicKey
        ) {
          return prevUser;
        }

        return {
          id: authId,
          address: wallet.address,
          chain: wallet.chain,
          publicKey: wallet.publicKey,
          accessToken: '',
        };
      });
    } else {
      setUser((prevUser) => (prevUser ? null : prevUser));
    }

    setLoading(false);
  }, [wallet]);

  return { user, loading };
}
