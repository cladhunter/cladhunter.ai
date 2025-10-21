/**
 * API Testing Utility
 * Use this in browser console to test backend endpoints
 */

import { API_BASE_URL, getAuthHeaders } from './supabase/client';
import { publicAnonKey } from './supabase/info';

export class ApiTester {
  private baseUrl: string;
  private token: string;
  private userId: string;

  constructor(token?: string, userId?: string) {
    this.baseUrl = API_BASE_URL;
    this.token = token || publicAnonKey;
    this.userId = userId || `anon_test_${Date.now()}`;
  }

  private getHeaders(): HeadersInit {
    const headers = getAuthHeaders(this.token);
    // Add X-User-ID for anonymous users
    if (this.token === publicAnonKey && this.userId) {
      return {
        ...headers,
        'X-User-ID': this.userId,
      };
    }
    return headers;
  }

  /**
   * Test health check endpoint
   */
  async testHealth() {
    console.log('🏥 Testing health endpoint...');
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
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
      const response = await fetch(`${this.baseUrl}/user/init`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      const data = await response.json();
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
      const response = await fetch(`${this.baseUrl}/user/balance`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      const data = await response.json();
      console.log('✅ Balance:', data);
      return data;
    } catch (error) {
      console.error('❌ Get balance failed:', error);
      return null;
    }
  }

  /**
   * Test get next ad
   */
  async testGetNextAd() {
    console.log('📺 Testing get next ad...');
    try {
      const response = await fetch(`${this.baseUrl}/ads/next`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      const data = await response.json();
      console.log('✅ Next ad:', data);
      return data;
    } catch (error) {
      console.error('❌ Get next ad failed:', error);
      return null;
    }
  }

  /**
   * Test complete ad watch
   */
  async testCompleteAd(adId: string = 'ad_1') {
    console.log(`✨ Testing complete ad (${adId})...`);
    try {
      const response = await fetch(`${this.baseUrl}/ads/complete`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ ad_id: adId }),
      });
      const data = await response.json();
      console.log('✅ Ad completed:', data);
      return data;
    } catch (error) {
      console.error('❌ Complete ad failed:', error);
      return null;
    }
  }

  /**
   * Test create order
   */
  async testCreateOrder(boostLevel: number = 1) {
    console.log(`🛒 Testing create order (boost level ${boostLevel})...`);
    try {
      const response = await fetch(`${this.baseUrl}/orders/create`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ boost_level: boostLevel }),
      });
      const data = await response.json();
      console.log('✅ Order created:', data);
      return data;
    } catch (error) {
      console.error('❌ Create order failed:', error);
      return null;
    }
  }

  /**
   * Test get stats
   */
  async testGetStats() {
    console.log('📊 Testing get stats...');
    try {
      const response = await fetch(`${this.baseUrl}/stats`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      const data = await response.json();
      console.log('✅ Stats:', data);
      return data;
    } catch (error) {
      console.error('❌ Get stats failed:', error);
      return null;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Running all API tests...\n');
    
    await this.testHealth();
    console.log('\n');
    
    await this.testUserInit();
    console.log('\n');
    
    await this.testGetBalance();
    console.log('\n');
    
    const ad = await this.testGetNextAd();
    console.log('\n');
    
    if (ad?.id) {
      await this.testCompleteAd(ad.id);
      console.log('\n');
    }
    
    await this.testGetStats();
    console.log('\n');
    
    await this.testCreateOrder(1);
    console.log('\n');
    
    console.log('✅ All tests completed!');
  }

  /**
   * Simulate mining session
   */
  async simulateMining(count: number = 5) {
    console.log(`⛏️ Simulating ${count} mining sessions...\n`);
    
    for (let i = 1; i <= count; i++) {
      console.log(`Session ${i}/${count}`);
      
      const ad = await this.testGetNextAd();
      if (!ad?.id) {
        console.error('Failed to get ad');
        break;
      }
      
      // Wait 5 seconds (simulated ad viewing)
      console.log('⏳ Watching ad...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const result = await this.testCompleteAd(ad.id);
      if (result?.success) {
        console.log(`✅ +${result.reward} 🆑 earned! New balance: ${result.new_balance}\n`);
      } else {
        console.error('Failed to complete ad\n');
        break;
      }
      
      // Wait cooldown (30 seconds)
      if (i < count) {
        console.log('⏳ Cooldown (30s)...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
    
    const stats = await this.testGetStats();
    console.log('\n📊 Final stats:', stats);
  }
}

// Global instance for easy console access
declare global {
  interface Window {
    testApi: ApiTester;
  }
}

if (typeof window !== 'undefined') {
  window.testApi = new ApiTester();
  console.log('🔧 API Tester loaded! Use window.testApi in console.');
  console.log('Examples:');
  console.log('  await window.testApi.runAllTests()');
  console.log('  await window.testApi.testHealth()');
  console.log('  await window.testApi.simulateMining(3)');
}

export default ApiTester;