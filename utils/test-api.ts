/**
 * SQL API Testing Utility
 * Use this in browser console to invoke Supabase SQL RPC functions directly.
 */

import {
  claimReward,
  completeAdWatch,
  createOrder,
  getRewardStatus,
  getUserBalance,
  getUserStats,
  initUser,
  confirmOrder,
} from './api/sqlClient';

export class ApiTester {
  private userId: string;
  private walletAddress?: string;

  constructor(userId?: string, walletAddress?: string) {
    this.userId = userId || `anon_test_${Date.now()}`;
    this.walletAddress = walletAddress;
  }

  setWallet(address: string) {
    this.walletAddress = address;
  }

  async testUserInit() {
    console.log('👤 Testing app_init_user...');
    const response = await initUser({
      userId: this.userId,
      walletAddress: this.walletAddress,
    });
    console.log('✅ init response:', response);
    return response;
  }

  async testGetBalance() {
    console.log('💰 Testing app_get_user_balance...');
    const response = await getUserBalance({
      userId: this.userId,
      walletAddress: this.walletAddress,
    });
    console.log('✅ balance:', response);
    return response;
  }

  async testCompleteAd(adId = 'test_ad') {
    console.log(`📺 Testing app_complete_ad_watch (${adId})...`);
    const response = await completeAdWatch({
      userId: this.userId,
      adId,
      walletAddress: this.walletAddress,
    });
    console.log('✅ ad complete:', response);
    return response;
  }

  async testCreateOrder(boostLevel = 1) {
    console.log(`🛒 Testing app_create_order (level ${boostLevel})...`);
    const response = await createOrder({
      userId: this.userId,
      boostLevel,
      walletAddress: this.walletAddress,
    });
    console.log('✅ order created:', response);
    return response;
  }

  async testConfirmOrder(orderId: string, txHash?: string) {
    console.log(`✅ Testing app_confirm_order (${orderId})...`);
    const response = await confirmOrder({
      userId: this.userId,
      orderId,
      txHash,
    });
    console.log('✅ order confirmed:', response);
    return response;
  }

  async testGetStats() {
    console.log('📊 Testing app_get_stats...');
    const response = await getUserStats({ userId: this.userId });
    console.log('✅ stats:', response);
    return response;
  }

  async testRewardStatus() {
    console.log('🎁 Testing app_get_reward_status...');
    const response = await getRewardStatus({ userId: this.userId });
    console.log('✅ reward status:', response);
    return response;
  }

  async testClaimReward(partnerId: string, amount: number, partnerName: string) {
    console.log(`🏆 Testing app_claim_reward (${partnerId})...`);
    const response = await claimReward({
      userId: this.userId,
      partnerId,
      rewardAmount: amount,
      partnerName,
    });
    console.log('✅ reward claimed:', response);
    return response;
  }

  async simulateMining(count = 5) {
    console.log(`⛏️ Simulating ${count} mining sessions...`);
    for (let i = 0; i < count; i += 1) {
      await this.testCompleteAd(`ad_${i + 1}`);
    }
  }
}
