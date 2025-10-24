/**
 * API Testing Utility
 * Use this in browser console to test backend endpoints
 */

import { ensureSupabaseAuth, getSupabaseClient } from './supabase/client';

export class ApiTester {
  private supabase = getSupabaseClient();

  constructor(private walletAddress?: string | null) {}

  private async ensureAuth() {
    await ensureSupabaseAuth();
  }

  /**
   * Test health check endpoint via Edge function
   */
  async testHealth() {
    console.log('🏥 Testing health endpoint...');
    try {
      await this.ensureAuth();
      const { data, error } = await this.supabase.functions.invoke('make-server-0f597298/health');
      if (error) throw error;
      console.log('✅ Health check:', data);
      return data;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return null;
    }
  }

  /**
   * Test user initialization
   */
  async testUserInit() {
    console.log('👤 Testing user init...');
    try {
      await this.ensureAuth();
      const { data, error } = await this.supabase.functions.invoke('make-server-0f597298/user/init', {
        method: 'POST',
        body: { wallet_address: this.walletAddress },
      });
      if (error) throw error;
      console.log('✅ User init:', data);
      return data;
    } catch (error) {
      console.error('❌ User init failed:', error);
      return null;
    }
  }

  /**
   * Test get balance
   */
  async testGetBalance() {
    console.log('💰 Testing get balance...');
    try {
      await this.ensureAuth();
      const { data, error } = await this.supabase.functions.invoke('make-server-0f597298/user/balance', {
        method: 'GET',
      });
      if (error) throw error;
      console.log('✅ Balance:', data);
      return data;
    } catch (error) {
      console.error('❌ Get balance failed:', error);
      return null;
    }
  }

  /**
   * Test complete ad watch via RPC
   */
  async testCompleteAd(adId: string = 'ad_1') {
    console.log(`✨ Testing complete ad (${adId})...`);
    try {
      await this.ensureAuth();
      const { data, error } = await this.supabase.rpc('complete_ad_watch', {
        ad_id: adId,
        wallet_address: this.walletAddress,
      });
      if (error) throw error;
      console.log('✅ Ad completed:', data);
      return data;
    } catch (error) {
      console.error('❌ Complete ad failed:', error);
      return null;
    }
  }

  /**
   * Test claim partner reward via RPC
   */
  async testClaimPartner(partnerId: string) {
    console.log(`🎁 Testing claim partner reward (${partnerId})...`);
    try {
      await this.ensureAuth();
      const { data, error } = await this.supabase.rpc('claim_partner_reward_v2', {
        partner_id: partnerId,
        wallet_address: this.walletAddress,
      });
      if (error) throw error;
      console.log('✅ Partner reward claimed:', data);
      return data;
    } catch (error) {
      console.error('❌ Claim partner reward failed:', error);
      return null;
    }
  }
}
