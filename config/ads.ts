/**
 * Ad Configuration for Cladhunter
 * 
 * EASY SETUP: Simply add new ads to the array below!
 * 
 * Ad Types:
 * - 'video': MP4 video file (mobile-optimized, 9:16 aspect ratio recommended)
 * - 'image': Static creative/poster (9:16 aspect ratio recommended for mobile)
 * 
 * IMPORTANT: Make sure all ad URLs are publicly accessible and HTTPS
 * 
 * 📝 Quick Add Template:
 * {
 *   id: 'unique_ad_id',           // Unique identifier (use snake_case)
 *   type: 'image',                 // 'video' or 'image'
 *   url: 'https://...',            // Direct URL to video/image file
 *   partnerUrl: 'https://...',     // Where to redirect users on click
 *   partnerName: 'Partner Name',   // For analytics tracking
 *   duration: 15,                  // (Optional) Video duration in seconds
 * }
 */

export interface AdCreative {
  id: string;
  type: 'video' | 'image';
  url: string; // URL to video/image file
  partnerUrl: string; // Partner website URL (where user is redirected on click)
  partnerName?: string; // Optional partner name for analytics
  duration?: number; // Optional: video duration in seconds (for analytics)
  priority?: number; // Higher numbers surface first when picking ads
  countries?: string[]; // Optional whitelist of ISO country codes
}

/**
 * 🎯 AD CREATIVES LIST
 * Add your advertising partners below
 */
export const adCreatives: AdCreative[] = [
  // ========================================
  // 🎬 VIDEO ADS
  // ========================================
  {
    id: 'demo_video_1',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    partnerUrl: 'https://example.com/partner1',
    partnerName: 'Demo Video Partner',
    duration: 15,
    priority: 5,
    countries: ['US', 'CA', 'GB'],
  },
  
  // ========================================
  // 🖼️ IMAGE ADS
  // ========================================
  
  // Cryptocurrency Theme
  {
    id: 'crypto_trading',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1633534415766-165181ffdbb7?w=1080&h=1920&fit=crop',
    partnerUrl: 'https://example.com/crypto',
    partnerName: 'Crypto Trading',
    priority: 4,
    countries: ['DE', 'CH', 'AT'],
  },
  
  // Gaming Theme
  {
    id: 'mobile_gaming',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1726935037951-d5a5a73b3243?w=1080&h=1920&fit=crop',
    partnerUrl: 'https://example.com/gaming',
    partnerName: 'Mobile Gaming',
    countries: ['US', 'BR', 'AR'],
  },
  
  // Tech/App Theme
  {
    id: 'tech_app',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1760888549280-4aef010720bd?w=1080&h=1920&fit=crop',
    partnerUrl: 'https://example.com/tech',
    partnerName: 'Tech Solutions',
    priority: 2,
  },
  
  // ========================================
  // 👇 ADD YOUR ADS HERE 👇
  // ========================================
  
  // Example: Add a new video ad
  // {
  //   id: 'your_product_promo',
  //   type: 'video',
  //   url: 'https://cdn.yoursite.com/promo-video.mp4',
  //   partnerUrl: 'https://yourproduct.com?utm_source=cladhunter',
  //   partnerName: 'Your Product Name',
  //   duration: 20,
  // },
  
  // Example: Add a new image ad
  // {
  //   id: 'your_app_banner',
  //   type: 'image',
  //   url: 'https://cdn.yoursite.com/ad-banner-9x16.jpg',
  //   partnerUrl: 'https://yourapp.com/download',
  //   partnerName: 'Your App',
  // },
];

/**
 * Get a random ad from the pool
 */
export function getEligibleAds(countryCode?: string | null): AdCreative[] {
  const normalizedCode = countryCode?.trim().toUpperCase() ?? null;
  const withIndex = adCreatives.map((ad, index) => ({ ad, index }));

  const filtered = withIndex.filter(({ ad }) => {
    if (!ad.countries || ad.countries.length === 0) {
      return true;
    }
    if (!normalizedCode) {
      return false;
    }
    return ad.countries.some((code) => code.toUpperCase() === normalizedCode);
  });

  const pool = filtered.length > 0 ? filtered : withIndex;

  return pool
    .slice()
    .sort((a, b) => {
      const priorityDiff = (b.ad.priority ?? 0) - (a.ad.priority ?? 0);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return a.index - b.index;
    })
    .map(({ ad }) => ad);
}

export function getRandomAd(countryCode?: string | null): AdCreative {
  const eligible = getEligibleAds(countryCode);
  const randomIndex = Math.floor(Math.random() * eligible.length);
  return eligible[randomIndex];
}

/**
 * Ad viewing configuration
 */
export const adConfig = {
  skipDelay: 6, // Seconds before claim button appears
  trackViews: true, // Track ad views on server
  minViewDuration: 3, // Minimum seconds viewed to count as valid view
};
