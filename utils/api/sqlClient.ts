import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '../supabase/client';
import type {
  AdCompleteResponse,
  ClaimRewardResponse,
  RewardStatusResponse,
  UserStatsResponse,
} from '../../types';
import type { UserData } from '../../hooks/useUserData';

interface RpcContext {
  client?: Pick<SupabaseClient, 'rpc'>;
}

async function callRpc<T>(
  fn: string,
  params: Record<string, unknown>,
  { client }: RpcContext = {},
): Promise<T> {
  const target = client ?? createClient();
  const { data, error } = await target.rpc<T>(fn, params);

  if (error) {
    throw new Error(error.message || `Supabase RPC ${fn} failed`);
  }

  if (data === null || typeof data === 'undefined') {
    throw new Error(`Supabase RPC ${fn} returned no data`);
  }

  return data;
}

export interface InitUserInput {
  userId: string;
  walletAddress?: string | null;
  countryCode?: string | null;
}

export async function initUser(
  { userId, walletAddress, countryCode }: InitUserInput,
  context?: RpcContext,
): Promise<{ user: UserData }>
{
  return callRpc('app_init_user', {
    p_user_id: userId,
    p_wallet_address: walletAddress ?? null,
    p_country_code: countryCode ?? null,
  }, context);
}

export interface BalanceInput {
  userId: string;
  walletAddress?: string | null;
  countryCode?: string | null;
}

export async function getUserBalance(
  { userId, walletAddress, countryCode }: BalanceInput,
  context?: RpcContext,
): Promise<{ energy: number; boost_level: number; multiplier: number; boost_expires_at: string | null; }>
{
  return callRpc('app_get_user_balance', {
    p_user_id: userId,
    p_wallet_address: walletAddress ?? null,
    p_country_code: countryCode ?? null,
  }, context);
}

export interface CompleteAdInput {
  userId: string;
  adId: string;
  walletAddress?: string | null;
  countryCode?: string | null;
}

export async function completeAdWatch(
  { userId, adId, walletAddress, countryCode }: CompleteAdInput,
  context?: RpcContext,
): Promise<AdCompleteResponse>
{
  return callRpc('app_complete_ad_watch', {
    p_user_id: userId,
    p_ad_id: adId,
    p_wallet_address: walletAddress ?? null,
    p_country_code: countryCode ?? null,
  }, context);
}

export interface CreateOrderInput {
  userId: string;
  boostLevel: number;
  walletAddress?: string | null;
  countryCode?: string | null;
}

export async function createOrder(
  { userId, boostLevel, walletAddress, countryCode }: CreateOrderInput,
  context?: RpcContext,
): Promise<{ order_id: string; address: string; amount: number; payload: string; boost_name: string; duration_days: number; }>
{
  return callRpc('app_create_order', {
    p_user_id: userId,
    p_boost_level: boostLevel,
    p_wallet_address: walletAddress ?? null,
    p_country_code: countryCode ?? null,
  }, context);
}

export interface ConfirmOrderInput {
  userId: string;
  orderId: string;
  txHash?: string | null;
}

export async function confirmOrder(
  { userId, orderId, txHash }: ConfirmOrderInput,
  context?: RpcContext,
): Promise<{ success: boolean; boost_level: number; boost_expires_at: string | null; multiplier: number; }>
{
  return callRpc('app_confirm_order', {
    p_user_id: userId,
    p_order_id: orderId,
    p_tx_hash: txHash ?? null,
  }, context);
}

export interface StatsInput {
  userId: string;
}

export async function getUserStats(
  { userId }: StatsInput,
  context?: RpcContext,
): Promise<UserStatsResponse>
{
  return callRpc('app_get_stats', {
    p_user_id: userId,
  }, context);
}

export interface RewardStatusInput {
  userId: string;
}

export async function getRewardStatus(
  { userId }: RewardStatusInput,
  context?: RpcContext,
): Promise<RewardStatusResponse>
{
  return callRpc('app_get_reward_status', {
    p_user_id: userId,
  }, context);
}

export interface ClaimRewardInput {
  userId: string;
  partnerId: string;
  rewardAmount: number;
  partnerName: string;
}

export async function claimReward(
  { userId, partnerId, rewardAmount, partnerName }: ClaimRewardInput,
  context?: RpcContext,
): Promise<ClaimRewardResponse>
{
  return callRpc('app_claim_reward', {
    p_user_id: userId,
    p_partner_id: partnerId,
    p_reward: rewardAmount,
    p_partner_name: partnerName,
  }, context);
}
