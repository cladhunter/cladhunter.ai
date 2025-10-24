import { useTonConnectUI, useTonWallet, useTonAddress } from '@tonconnect/ui-react';
import { useCallback, useMemo, useState } from 'react';

export interface TonWallet {
  address: string;
  chain: string;
  publicKey: string;
}

export function useTonConnect() {
  const [tonConnectUI] = useTonConnectUI();
  const tonWallet = useTonWallet();
  const userFriendlyAddress = useTonAddress();
  const [isConnecting, setIsConnecting] = useState(false);

  const wallet: TonWallet | null = useMemo(() => {
    if (!tonWallet) {
      return null;
    }

    return {
      address: userFriendlyAddress || tonWallet.account.address,
      chain: tonWallet.account.chain,
      publicKey: tonWallet.account.publicKey || '',
    };
  }, [
    tonWallet,
    userFriendlyAddress,
    tonWallet?.account.address,
    tonWallet?.account.chain,
    tonWallet?.account.publicKey,
  ]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      await tonConnectUI.openModal();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [tonConnectUI]);

  const disconnect = useCallback(async () => {
    try {
      await tonConnectUI.disconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      throw error;
    }
  }, [tonConnectUI]);

  const sendTransaction = useCallback(
    async (params: {
      to: string;
      amount: string; // in nanoTON
      payload?: string;
    }) => {
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      try {
        const message: {
          address: string;
          amount: string;
          payload?: string;
        } = {
          address: params.to,
          amount: params.amount,
        };

        if (params.payload) {
          message.payload = params.payload;
        }

        const transaction = {
          validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
          messages: [message],
        };

        const result = await tonConnectUI.sendTransaction(transaction);
        return result;
      } catch (error) {
        console.error('Transaction failed:', error);
        throw error;
      }
    },
    [tonConnectUI, wallet]
  );

  return {
    wallet,
    isConnecting,
    connect,
    disconnect,
    sendTransaction,
    isConnected: !!wallet,
  };
}
