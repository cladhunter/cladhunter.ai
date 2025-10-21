# Cladhunter Setup Guide

## 🚀 Production Setup Instructions

### 1. Environment Variables

Create a `.env` file in your Supabase project with the following variables:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# TON Payment Configuration
VITE_TON_MERCHANT_ADDRESS=UQYourMerchantWalletAddress
TON_API_KEY=your-ton-api-key

# TonConnect Manifest (optional)
VITE_TONCONNECT_MANIFEST_URL=https://yourdomain.com/tonconnect-manifest.json
```

### 2. Database Setup

The application uses Supabase KV Store (key-value storage) for data persistence. No additional database setup is required.

**Data Structure:**
- `user:{userId}` - User profile and balance
- `watch:{userId}:{timestamp}` - Watch logs
- `order:{orderId}` - Boost purchase orders
- `watch_count:{userId}:{date}` - Daily watch counter

### 3. API Endpoints

All endpoints are available at: `https://{projectId}.supabase.co/functions/v1/make-server-0f597298`

#### User Management
- `POST /user/init` - Initialize user on app load
- `GET /user/balance` - Get current balance and boost info

#### Ads & Mining
- `GET /ads/next` - Get next available ad
- `POST /ads/complete` - Complete ad watch and credit energy

#### Boosts & Payments
- `POST /orders/create` - Create TON payment order for boost
- `GET /orders/:orderId` - Check order status
- `POST /orders/:orderId/confirm` - Manually confirm payment (demo mode)

#### Statistics
- `GET /stats` - Get user mining statistics

### 4. Economy Configuration

Edit `/config/economy.ts` to customize the app economy:

```typescript
export const TON_TO_ENERGY_RATE = 100000; // 1 TON = 100,000 energy
export const ENERGY_PER_AD = {
  short: 10,
  long: 25,
  promo: 50,
};
export const DAILY_VIEW_LIMIT = 200;
export const AD_COOLDOWN_SECONDS = 30;
```

### 5. Boost Levels

| Level | Name | Multiplier | Cost (TON) | Duration (Days) |
|-------|------|------------|------------|-----------------|
| 0 | Base | 1x | Free | - |
| 1 | Bronze | 1.25x | 0.3 | 7 |
| 2 | Silver | 1.5x | 0.7 | 14 |
| 3 | Gold | 2x | 1.5 | 30 |
| 4 | Diamond | 3x | 3.5 | 60 |

### 6. TON Payment Integration

For production TON payments:

1. Set your merchant wallet address in `VITE_TON_MERCHANT_ADDRESS`
2. Get TON API key from https://tonconsole.com
3. Implement webhook to verify payments:
   - Listen for TON blockchain transactions
   - Match by `payload` field
   - Call `/orders/:orderId/confirm` when verified

**Current Demo Mode:**
The app includes a manual confirmation button for testing. Replace with automated TON payment verification for production.

### 7. Security Checklist

- ✅ Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend
- ✅ All API routes validate user auth via Bearer token
- ✅ Rate limiting on ad completion (30s cooldown)
- ✅ Daily view limit enforcement (200 ads/day)
- ✅ Anti-replay protection for ad watches
- ✅ Atomic balance updates to prevent race conditions

### 8. Testing

1. Open the app - you'll get an anonymous user ID
2. Click "START MINING" to watch an ad
3. Complete the 5-second progress to earn energy
4. Visit Wallet screen to purchase boosts
5. Create an order and manually confirm to activate boost
6. Return to Mining to see multiplier in action

### 9. Deployment

**Frontend:**
- Deploy to any static hosting (Vercel, Netlify, GitHub Pages)
- Set environment variables in hosting dashboard

**Backend:**
- Already deployed as Supabase Edge Function
- No additional backend deployment needed

### 10. Production Todos

- [ ] Replace demo ads with real ad network integration
- [ ] Implement automated TON payment verification webhook
- [ ] Add real authentication (email/social login)
- [ ] Implement withdrawal functionality
- [ ] Add referral tracking system
- [ ] Set up analytics and monitoring
- [ ] Configure rate limiting via Supabase
- [ ] Add admin dashboard for ad management

## 📱 Features

✅ **Energy Mining**: Watch ads to earn energy (🆑)  
✅ **Boost System**: Purchase multipliers with TON  
✅ **Statistics Dashboard**: Track earnings and performance  
✅ **Wallet**: Manage balance and view transactions  
✅ **Referral System**: Invite friends (UI ready, tracking TBD)  
✅ **Mobile-First Design**: Optimized for touch devices  
✅ **Dark Futuristic Theme**: Glassmorphic UI with red accents  

## 🛠 Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase Edge Functions (Hono)
- **Database**: Supabase KV Store
- **Payments**: TON Blockchain (TonConnect)
- **Charts**: Recharts
- **Animation**: Motion (Framer Motion)

## 📞 Support

For issues or questions, check:
- Supabase logs: `https://app.supabase.com/project/{projectId}/logs`
- Browser console for frontend errors
- Network tab to debug API calls

---

**Made with ❤️ for the TON ecosystem**
