// Cladhunter Type Definitions

export interface User {
  id: string;
  energy: number;
  boost_level: number;
  last_watch_at: string | null;
  boost_expires_at: string | null;
  created_at: string;
}

export interface Ad {
  id: string;
  url: string;
  reward: number;
  type: 'short' | 'long' | 'promo';
  active: boolean;
}

export interface WatchLog {
  user_id: string;
  ad_id: string;
  reward: number;
  base_reward: number;
  multiplier: number;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  boost_level: number;
  ton_amount: number;
  status: 'pending' | 'paid' | 'failed';
  payload: string;
  tx_hash: string | null;
  created_at: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface AdCompleteRequest {
  ad_id: string;
}

export interface AdCompleteResponse {
  success: boolean;
  reward: number;
  new_balance: number;
  multiplier: number;
  daily_watches_remaining: number;
}

export interface OrderCreateRequest {
  boost_level: number;
}

export interface OrderCreateResponse {
  order_id: string;
  address: string;
  amount: number;
  payload: string;
  boost_name: string;
  duration_days: number;
}

export interface UserStatsResponse {
  total_energy: number;
  total_watches: number;
  total_earned: number;
  today_watches: number;
  daily_limit: number;
  boost_level: number;
  multiplier: number;
  boost_expires_at: string | null;
}

// Partner Rewards Types
export interface PartnerRewardClaim {
  partner_id: string;
  user_id: string;
  reward: number;
  claimed_at: string;
}

export interface ClaimRewardRequest {
  partner_id: string;
}

export interface ClaimRewardResponse {
  success: boolean;
  reward: number;
  new_balance: number;
  partner_name: string;
}

export interface RewardStatusResponse {
  claimed_partners: string[]; // Array of partner IDs already claimed
  available_rewards: number; // Count of unclaimed rewards
}
