/**
 * TON Connect Usage Examples for Cladhunter
 * 
 * This file contains practical examples of how to use TON Connect
 * in different scenarios within the Cladhunter application.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTonConnect } from '../hooks/useTonConnect';
import { toast } from 'sonner@2.0.3';

// ============================================================================
// Example 1: Basic Wallet Connection
// ============================================================================

export function ExampleWalletConnection() {
  const { wallet, isConnected, connect, disconnect } = useTonConnect();

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Wallet connected successfully!');
    } catch (error) {
      toast.error('Failed to connect wallet');
      console.error(error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast.success('Wallet disconnected');
    } catch (error) {
      toast.error('Failed to disconnect');
      console.error(error);
    }
  };

  return (
    <div>
      {!isConnected ? (
        <button onClick={handleConnect}>Connect Wallet</button>
      ) : (
        <>
          <p>Connected: {wallet?.address}</p>
          <button onClick={handleDisconnect}>Disconnect</button>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Example 2: Send Simple Transaction
// ============================================================================

export function ExampleSendTransaction() {
  const { sendTransaction, isConnected } = useTonConnect();

  const handleSendTon = async () => {
    if (!isConnected) {
      toast.error('Please connect wallet first');
      return;
    }

    try {
      const result = await sendTransaction({
        to: 'EQD...merchant-address',
        amount: '100000000', // 0.1 TON in nanoTON
        payload: 'Payment for service',
      });

      toast.success('Transaction sent!');
      console.log('Transaction hash:', result.boc);
    } catch (error) {
      toast.error('Transaction failed');
      console.error(error);
    }
  };

  return (
    <button onClick={handleSendTon} disabled={!isConnected}>
      Send 0.1 TON
    </button>
  );
}

// ============================================================================
// Example 3: Buy Boost with Full Flow
// ============================================================================

export function ExampleBuyBoostFlow() {
  const { sendTransaction, isConnected } = useTonConnect();
  const [loading, setLoading] = useState(false);

  const buyBoost = async (boostLevel: number) => {
    if (!isConnected) {
      toast.error('Connect wallet to buy boost');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create order on server
      const orderResponse = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boost_level: boostLevel }),
      });

      const order = await orderResponse.json();

      // Step 2: Send transaction
      const amountInNanoTon = Math.floor(order.amount * 1_000_000_000).toString();
      
      const txResult = await sendTransaction({
        to: order.address,
        amount: amountInNanoTon,
        payload: order.payload,
      });

      toast.success('Transaction sent! Confirming...');

      // Step 3: Confirm on server
      const confirmResponse = await fetch(`/api/orders/${order.order_id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_hash: txResult.boc }),
      });

      const result = await confirmResponse.json();

      toast.success(`Boost activated! x${result.multiplier}`);
    } catch (error) {
      toast.error('Purchase failed');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={() => buyBoost(1)} disabled={loading || !isConnected}>
      {loading ? 'Processing...' : 'Buy Bronze Boost (0.3 TON)'}
    </button>
  );
}

// ============================================================================
// Example 4: Check Wallet Balance (requires additional setup)
// ============================================================================

export function ExampleCheckBalance() {
  const { wallet, isConnected } = useTonConnect();
  const [balance, setBalance] = useState<string | null>(null);

  const fetchBalance = async () => {
    if (!wallet) return;

    try {
      // Using TonCenter API
      const response = await fetch(
        `https://toncenter.com/api/v2/getAddressBalance?address=${wallet.address}`
      );
      const data = await response.json();
      
      // Convert from nanoTON to TON
      const tonBalance = (parseInt(data.result) / 1_000_000_000).toFixed(4);
      setBalance(tonBalance);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchBalance();
    }
  }, [isConnected]);

  return (
    <div>
      {isConnected && wallet ? (
        <p>Balance: {balance || 'Loading...'} TON</p>
      ) : (
        <p>Connect wallet to see balance</p>
      )}
    </div>
  );
}

// ============================================================================
// Example 5: Multiple Transactions with Retry Logic
// ============================================================================

export function ExampleTransactionWithRetry() {
  const { sendTransaction, isConnected } = useTonConnect();

  const sendWithRetry = async (maxRetries = 3) => {
    if (!isConnected) return;

    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        const result = await sendTransaction({
          to: 'EQD...address',
          amount: '100000000',
          payload: 'retry-transaction',
        });

        toast.success('Transaction successful!');
        return result;
      } catch (error) {
        attempt++;
        
        if (attempt < maxRetries) {
          toast(`Retry ${attempt}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          toast.error('Transaction failed after retries');
          throw error;
        }
      }
    }
  };

  return (
    <button onClick={() => sendWithRetry()}>
      Send with Retry
    </button>
  );
}

// ============================================================================
// Example 6: Batch Operations
// ============================================================================

export function ExampleBatchPurchase() {
  const { sendTransaction, isConnected } = useTonConnect();
  const [selectedBoosts, setSelectedBoosts] = useState<number[]>([]);

  const buyMultipleBoosts = async () => {
    if (!isConnected) return;

    for (const boostLevel of selectedBoosts) {
      try {
        // Create order
        const orderRes = await fetch('/api/orders/create', {
          method: 'POST',
          body: JSON.stringify({ boost_level: boostLevel }),
        });
        const order = await orderRes.json();

        // Send transaction
        const amountInNanoTon = Math.floor(order.amount * 1_000_000_000).toString();
        await sendTransaction({
          to: order.address,
          amount: amountInNanoTon,
          payload: order.payload,
        });

        toast.success(`Boost ${boostLevel} purchased!`);
        
        // Wait before next transaction
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to buy boost ${boostLevel}:`, error);
        break; // Stop on first error
      }
    }
  };

  return (
    <div>
      <select onChange={(e) => setSelectedBoosts([parseInt(e.target.value)])}>
        <option value="1">Bronze</option>
        <option value="2">Silver</option>
        <option value="3">Gold</option>
      </select>
      <button onClick={buyMultipleBoosts}>Buy Selected</button>
    </div>
  );
}

// ============================================================================
// Example 7: Conditional UI Based on Wallet State
// ============================================================================

export function ExampleConditionalUI() {
  const { wallet, isConnected, isConnecting, connect } = useTonConnect();

  if (isConnecting) {
    return <div>Connecting wallet...</div>;
  }

  if (!isConnected) {
    return (
      <div>
        <p>Connect your wallet to access premium features</p>
        <button onClick={connect}>Connect Now</button>
      </div>
    );
  }

  return (
    <div>
      <p>✅ Wallet connected: {wallet?.address}</p>
      <p>Chain: {wallet?.chain}</p>
      {/* Premium features here */}
    </div>
  );
}

// ============================================================================
// Example 8: Transaction Amount Helpers
// ============================================================================

export class TonAmountHelper {
  // Convert TON to nanoTON
  static tonToNano(ton: number): string {
    return Math.floor(ton * 1_000_000_000).toString();
  }

  // Convert nanoTON to TON
  static nanoToTon(nano: string | number): number {
    return parseInt(nano.toString()) / 1_000_000_000;
  }

  // Format TON amount for display
  static formatTon(amount: number, decimals = 4): string {
    return amount.toFixed(decimals) + ' TON';
  }

  // Validate TON amount
  static isValidAmount(amount: number): boolean {
    return amount > 0 && amount <= 1000000; // Max 1M TON
  }
}

// Usage:
const exampleAmount = 0.3; // 0.3 TON
const nanoAmount = TonAmountHelper.tonToNano(exampleAmount); // "300000000"
const formatted = TonAmountHelper.formatTon(exampleAmount); // "0.3000 TON"

// ============================================================================
// Example 9: Error Handling Best Practices
// ============================================================================

export enum TonErrorType {
  USER_REJECTED = 'USER_REJECTED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export function handleTonError(error: any): TonErrorType {
  const errorMessage = error.message?.toLowerCase() || '';

  if (errorMessage.includes('user reject') || errorMessage.includes('cancelled')) {
    toast.error('Transaction cancelled by user');
    return TonErrorType.USER_REJECTED;
  }

  if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
    toast.error('Insufficient balance');
    return TonErrorType.INSUFFICIENT_BALANCE;
  }

  if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    toast.error('Network error. Please try again');
    return TonErrorType.NETWORK_ERROR;
  }

  toast.error('Transaction failed');
  return TonErrorType.UNKNOWN;
}

// ============================================================================
// Example 10: Custom Hook for Boost Purchase
// ============================================================================

export function useBuyBoost() {
  const { sendTransaction, isConnected } = useTonConnect();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buyBoost = useCallback(async (boostLevel: number) => {
    if (!isConnected) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    setError(null);

    try {
      // Implementation here...
      // (same as Example 3)
    } catch (err: any) {
      const errorType = handleTonError(err);
      setError(errorType);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isConnected, sendTransaction]);

  return { buyBoost, loading, error };
}

// ============================================================================
// Testing Utilities
// ============================================================================

export const TON_TEST_ADDRESSES = {
  mainnet: {
    merchant: 'EQD...your-mainnet-address',
    testUser: 'EQC...test-user-address',
  },
  testnet: {
    merchant: 'kQD...your-testnet-address',
    testUser: 'kQC...test-user-address',
  },
};

export const TON_TEST_AMOUNTS = {
  small: TonAmountHelper.tonToNano(0.01),   // 0.01 TON
  medium: TonAmountHelper.tonToNano(0.1),    // 0.1 TON
  large: TonAmountHelper.tonToNano(1.0),     // 1 TON
};

/**
 * Mock TON Connect for testing
 * Use in development environment only!
 */
export const mockTonConnect = {
  wallet: {
    address: 'EQC_mock_address_for_testing',
    chain: '-239', // Mainnet
    publicKey: 'mock_public_key',
  },
  isConnected: true,
  connect: async () => console.log('Mock: Connected'),
  disconnect: async () => console.log('Mock: Disconnected'),
  sendTransaction: async (params: any) => {
    console.log('Mock transaction:', params);
    return { boc: 'mock_transaction_hash_' + Date.now() };
  },
};