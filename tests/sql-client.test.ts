import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  claimReward,
  completeAdWatch,
  confirmOrder,
  createOrder,
  getRewardStatus,
  getUserBalance,
  getUserStats,
  initUser,
} from '../utils/api/sqlClient';

interface RpcCall {
  fn: string;
  params: Record<string, unknown>;
}

type RpcReturn<T> = { data: T | null; error: { message: string } | null };

declare global {
  // eslint-disable-next-line no-var
  var __supabaseClientOverride: { rpc: <T>(fn: string, params: Record<string, unknown>) => Promise<RpcReturn<T>> } | undefined;
}

const rpcCalls: RpcCall[] = [];

function buildResponse(fn: string): any {
  switch (fn) {
    case 'app_init_user':
      return { user: { id: 'anon_1', energy: 10, boost_level: 0, boost_expires_at: null, country_code: 'ZZ' } };
    case 'app_get_user_balance':
      return { energy: 25, boost_level: 1, multiplier: 1.25, boost_expires_at: null };
    case 'app_complete_ad_watch':
      return { success: true, reward: 15, new_balance: 40, multiplier: 1.5, daily_watches_remaining: 10 };
    case 'app_create_order':
      return { order_id: 'order-1', address: 'TON', amount: 1.2, payload: 'payload', boost_name: 'Silver', duration_days: 14 };
    case 'app_confirm_order':
      return { success: true, boost_level: 2, boost_expires_at: '2025-01-01T00:00:00.000Z', multiplier: 1.5 };
    case 'app_get_stats':
      return {
        totals: {
          energy: 50,
          watches: 5,
          earned: 50,
          sessions: 2,
          today_watches: 1,
          daily_limit: 200,
        },
        boost: { level: 1, multiplier: 1.25, expires_at: null },
        country_code: 'ZZ',
        watch_history: [],
        session_history: [],
      };
    case 'app_get_reward_status':
      return { claimed_partners: ['partner_1'], available_rewards: 0 };
    case 'app_claim_reward':
      return { success: true, reward: 20, new_balance: 70, partner_name: 'Partner' };
    default:
      return {};
  }
}

beforeEach(() => {
  rpcCalls.length = 0;
  globalThis.__supabaseClientOverride = {
    rpc: async <T>(fn: string, params: Record<string, unknown>): Promise<RpcReturn<T>> => {
      rpcCalls.push({ fn, params });
      return { data: buildResponse(fn) as T, error: null };
    },
  };
});

afterEach(() => {
  delete globalThis.__supabaseClientOverride;
});

describe('sqlClient RPC wrappers', () => {
  it('initialises user via app_init_user', async () => {
    const response = await initUser({ userId: 'anon_1' });
    expect(response.user.id).toBe('anon_1');
    expect(rpcCalls[0]).toEqual({ fn: 'app_init_user', params: { p_user_id: 'anon_1', p_wallet_address: null, p_country_code: null } });
  });

  it('fetches balance with wallet info', async () => {
    await getUserBalance({ userId: 'anon_1', walletAddress: 'wallet' });
    expect(rpcCalls[0]).toEqual({ fn: 'app_get_user_balance', params: { p_user_id: 'anon_1', p_wallet_address: 'wallet', p_country_code: null } });
  });

  it('completes ad watch', async () => {
    const response = await completeAdWatch({ userId: 'anon_1', adId: 'ad_123' });
    expect(response.success).toBe(true);
    expect(rpcCalls[0]).toEqual({
      fn: 'app_complete_ad_watch',
      params: { p_user_id: 'anon_1', p_ad_id: 'ad_123', p_wallet_address: null, p_country_code: null },
    });
  });

  it('creates order and confirms it', async () => {
    const order = await createOrder({ userId: 'anon_1', boostLevel: 2 });
    expect(order.boost_name).toBe('Silver');
    expect(rpcCalls[0]).toEqual({
      fn: 'app_create_order',
      params: { p_user_id: 'anon_1', p_boost_level: 2, p_wallet_address: null, p_country_code: null },
    });

    rpcCalls.length = 0;
    const confirmation = await confirmOrder({ userId: 'anon_1', orderId: 'order-1', txHash: 'hash' });
    expect(confirmation.success).toBe(true);
    expect(rpcCalls[0]).toEqual({
      fn: 'app_confirm_order',
      params: { p_user_id: 'anon_1', p_order_id: 'order-1', p_tx_hash: 'hash' },
    });
  });

  it('retrieves stats and reward data', async () => {
    const stats = await getUserStats({ userId: 'anon_1' });
    expect(stats.totals.energy).toBe(50);
    expect(rpcCalls[0]).toEqual({ fn: 'app_get_stats', params: { p_user_id: 'anon_1' } });

    rpcCalls.length = 0;
    const rewards = await getRewardStatus({ userId: 'anon_1' });
    expect(rewards.claimed_partners).toContain('partner_1');
    expect(rpcCalls[0]).toEqual({ fn: 'app_get_reward_status', params: { p_user_id: 'anon_1' } });
  });

  it('claims partner reward', async () => {
    const reward = await claimReward({ userId: 'anon_1', partnerId: 'partner_2', rewardAmount: 30, partnerName: 'Partner 2' });
    expect(reward.success).toBe(true);
    expect(rpcCalls[0]).toEqual({
      fn: 'app_claim_reward',
      params: { p_user_id: 'anon_1', p_partner_id: 'partner_2', p_reward: 30, p_partner_name: 'Partner 2' },
    });
  });

  it('throws when Supabase returns an error', async () => {
    globalThis.__supabaseClientOverride = {
      rpc: vi.fn(async () => ({ data: null, error: { message: 'boom' } })),
    };

    await expect(initUser({ userId: 'anon_2' })).rejects.toThrow('boom');
  });
});
