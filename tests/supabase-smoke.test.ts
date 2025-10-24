import { describe, it, expect, beforeEach, vi } from 'vitest';
import { completeAdWatchRpc, claimPartnerRewardRpc } from '../utils/supabase/rpc';

const mocks = vi.hoisted(() => ({
  ensureSupabaseAuth: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('../utils/supabase/client', () => ({
  ensureSupabaseAuth: mocks.ensureSupabaseAuth,
  getSupabaseClient: () => ({
    rpc: mocks.rpcMock,
  }),
}));

const { ensureSupabaseAuth, rpcMock } = mocks;

describe('Supabase RPC client', () => {
  beforeEach(() => {
    ensureSupabaseAuth.mockClear();
    rpcMock.mockClear();
  });

  it('returns reward information when ad watch RPC succeeds', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { success: true, reward: 15, multiplier: 1, new_balance: 25 },
      error: null,
    });

    const result = await completeAdWatchRpc<{ success: boolean; reward: number; new_balance: number }>({ ad_id: 'test_ad' });

    expect(ensureSupabaseAuth).toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledWith('complete_ad_watch', { ad_id: 'test_ad' });
    expect(result.success).toBe(true);
    expect(result.reward).toBe(15);
    expect(result.new_balance).toBe(25);
  });

  it('throws when claiming the same partner reward twice', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { success: true, reward: 750, partner_name: 'Test Partner' },
      error: null,
    });
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'REWARD_ALREADY_CLAIMED', code: '23505', hint: null, details: null },
    });

    const first = await claimPartnerRewardRpc<{ success: boolean; reward: number }>(
      { partner_id: 'partner_1' },
    );
    expect(first.success).toBe(true);
    expect(rpcMock).toHaveBeenNthCalledWith(1, 'claim_partner_reward_v2', { partner_id: 'partner_1' });

    await expect(
      claimPartnerRewardRpc({ partner_id: 'partner_1' }),
    ).rejects.toMatchObject({ message: 'REWARD_ALREADY_CLAIMED', code: '23505' });
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'claim_partner_reward_v2', { partner_id: 'partner_1' });
  });
});
