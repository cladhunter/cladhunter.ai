import { useState, useEffect } from 'react';
import { useTonConnect } from './useTonConnect';

export interface AuthUser {
  id: string;
  address: string;
  chain: string;
  publicKey: string;
  accessToken: string;
}

export function useAuth() {
  const { wallet } = useTonConnect();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (wallet) {
      setUser({
        id: wallet.address,
        address: wallet.address,
        chain: wallet.chain,
        publicKey: wallet.publicKey,
        accessToken: '',
      });
    } else {
      setUser(null);
    }

    setLoading(false);
  }, [wallet]);

  return { user, loading };
}
