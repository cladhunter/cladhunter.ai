/**
 * Partner Rewards Configuration for Cladhunter
 * 
 * Add your partner channels/accounts here. Users earn coins for subscribing.
 * Partners can be Telegram channels, X (Twitter) accounts, or other social platforms.
 * 
 * IMPORTANT: To add a new partner, simply add a new object to the array below.
 */

export interface PartnerReward {
  id: string; // Unique identifier (use snake_case: telegram_crypto_news)
  platform: 'telegram' | 'x' | 'youtube' | 'instagram' | 'discord'; // Social platform
  name: string; // Partner display name
  username: string; // @username or channel name
  url: string; // Direct link to channel/profile
  reward: number; // Coins reward (recommended: 500-1000)
  description?: string; // Optional short description
  icon?: string; // Optional emoji icon
  active: boolean; // Set to false to temporarily disable
}

/**
 * Partner Rewards List
 * 👇 ADD YOUR PARTNERS BELOW 👇
 */
export const partnerRewards: PartnerReward[] = [
  // Example: Telegram channel
  {
    id: 'telegram_cladhunter_official',
    platform: 'telegram',
    name: 'Cladhunter Official',
    username: '@cladhunter',
    url: 'https://t.me/cladhunter',
    reward: 1000,
    description: 'Official Cladhunter news and updates',
    icon: '📢',
    active: true,
  },
  
  // Example: Telegram crypto news
  {
    id: 'telegram_crypto_insights',
    platform: 'telegram',
    name: 'Crypto Insights',
    username: '@cryptoinsights',
    url: 'https://t.me/cryptoinsights',
    reward: 750,
    description: 'Daily crypto market analysis',
    icon: '💰',
    active: true,
  },
  
  // Example: X (Twitter) account
  {
    id: 'x_cladhunter',
    platform: 'x',
    name: 'Cladhunter X',
    username: '@cladhunter',
    url: 'https://x.com/cladhunter',
    reward: 800,
    description: 'Follow us on X for updates',
    icon: '🐦',
    active: true,
  },
  
  // Example: YouTube channel
  {
    id: 'youtube_crypto_tutorials',
    platform: 'youtube',
    name: 'Crypto Tutorials',
    username: '@cryptotutorials',
    url: 'https://youtube.com/@cryptotutorials',
    reward: 500,
    description: 'Learn crypto mining basics',
    icon: '🎥',
    active: true,
  },
  
  // 👇 ADD MORE PARTNERS HERE 👇
  // {
  //   id: 'telegram_your_channel',
  //   platform: 'telegram',
  //   name: 'Your Channel Name',
  //   username: '@yourchannel',
  //   url: 'https://t.me/yourchannel',
  //   reward: 750,
  //   description: 'Description of your channel',
  //   icon: '⭐',
  //   active: true,
  // },
];

/**
 * Get all active partner rewards
 */
export function getActivePartners(): PartnerReward[] {
  return partnerRewards.filter(p => p.active);
}

/**
 * Get partner by ID
 */
export function getPartnerById(id: string): PartnerReward | undefined {
  return partnerRewards.find(p => p.id === id);
}

/**
 * Get partners by platform
 */
export function getPartnersByPlatform(platform: PartnerReward['platform']): PartnerReward[] {
  return partnerRewards.filter(p => p.active && p.platform === platform);
}

/**
 * Platform display configuration
 */
export const platformConfig = {
  telegram: {
    name: 'Telegram',
    color: '#0088cc',
    icon: '✈️',
  },
  x: {
    name: 'X (Twitter)',
    color: '#000000',
    icon: '✖️',
  },
  youtube: {
    name: 'YouTube',
    color: '#ff0000',
    icon: '▶️',
  },
  instagram: {
    name: 'Instagram',
    color: '#e4405f',
    icon: '📸',
  },
  discord: {
    name: 'Discord',
    color: '#5865f2',
    icon: '💬',
  },
};
