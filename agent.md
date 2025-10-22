# Cladhunter - Agent Development Guide

## 🎯 Project Overview

**Cladhunter** - мобильное PWA приложение, симулятор облачного майнинга валюты 🆑 с механикой "смотри рекламу — получай монеты".

### Core Concept
- Темный футуристический дизайн с глянцевыми панелями
- Оптимизировано для мобильных телефонов
- Система наград за просмотр рекламы
- Интеграция с TON Connect для криптоплатежей
- Система бустов для увеличения заработка

### Color Scheme
- Background: `#0A0A0A` (черный)
- Text: `white`
- Accent: `#FF0033` (красный)
- Glass effects: `white/10` with backdrop blur

---

## 🏗️ Architecture

### Three-Tier Architecture
```
Frontend (React + TypeScript)
    ↓
Supabase Edge Functions (Hono Server)
    ↓
Supabase KV Store (Key-Value Database)
```

### Tech Stack

**Frontend:**
- React 18 + TypeScript
- Tailwind CSS v4.0
- Motion (Framer Motion)
- Lucide React (icons)
- Recharts (graphs)
- TON Connect UI React
- Sonner (toasts)

**Backend:**
- Deno runtime
- Hono web framework
- Supabase Edge Functions
- KV Store for data persistence

**Authentication:**
- Supabase Auth (optional)
- Anonymous users support with `anon_*` IDs

---

## 📁 Project Structure

### Key Directories

```
/components          # React components
  /ui               # ShadCN UI components (DO NOT MODIFY STRUCTURE)
  /figma            # Protected Figma components
  AdModal.tsx       # Ad viewing modal
  MiningScreen.tsx  # Main mining screen
  StatsScreen.tsx   # Statistics screen
  WalletScreen.tsx  # Wallet & TON integration
  RewardsSection.tsx # Partner rewards system

/config             # Configuration files
  ads.ts           # Ad sources configuration
  economy.ts       # Economy & boosts config
  partners.ts      # Partner rewards config

/hooks              # React hooks
  useApi.tsx       # API requests wrapper
  useAuth.tsx      # Authentication
  useTonConnect.tsx # TON wallet integration
  useUserData.tsx  # User data management

/supabase/functions/server/
  index.tsx        # Main server with all API endpoints
  kv_store.tsx     # KV database wrapper (PROTECTED)

/utils              # Utility functions
  /supabase        # Supabase client & config
  telegram.ts      # Telegram WebApp integration
  helpers.ts       # Helper functions

/types              # TypeScript type definitions
  index.ts         # All API response types
```

---

## 🗄️ Database Structure

### KV Store Keys Pattern

```typescript
// Users
user:${userId}              → User object (JSON)

// Sessions (NEW)
session:${userId}:${timestamp}         → Session tracking (JSON)

// Ad watching
watch:${userId}:${timestamp}           → Watch log (JSON)
watch_count:${userId}:${date}          → Daily watch count (string number)

// Orders
order:${orderId}            → Order object (JSON)

// Rewards
reward_claim:${userId}:${partnerId}    → Claim record (JSON)
reward_log:${userId}:${timestamp}      → Reward log (JSON)
```

### User Object Schema
```typescript
interface User {
  id: string;                    // User ID or anon_*
  energy: number;                // Current balance (🆑)
  boost_level: number;           // 0-4 boost level
  last_watch_at: string | null;  // ISO timestamp
  boost_expires_at: string | null; // ISO timestamp
  created_at: string;            // ISO timestamp
}
```

---

## 🔌 API Endpoints

**Base URL:** `https://${projectId}.supabase.co/functions/v1/make-server-0f597298`

### Authentication
All endpoints require:
- **Header:** `Authorization: Bearer ${token}`
- **Header:** `X-User-ID: ${userId}` (for anonymous users)

### Endpoints List

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/user/init` | Initialize/get user data |
| GET | `/user/balance` | Get current balance |
| GET | `/ads/next` | Get next ad (deprecated, use client config) |
| POST | `/ads/complete` | Complete ad watch & claim reward |
| POST | `/orders/create` | Create TON payment order |
| GET | `/orders/:orderId` | Check order status |
| POST | `/orders/:orderId/confirm` | Confirm payment (manual/webhook) |
| GET | `/stats` | Get user statistics |
| GET | `/rewards/status` | Get claimed rewards status |
| POST | `/rewards/claim` | Claim partner reward |

---

## ⚙️ Economy System

### Boosts Configuration
```typescript
const BOOSTS = [
  { level: 0, name: "Base",    multiplier: 1,    costTon: 0 },
  { level: 1, name: "Bronze",  multiplier: 1.25, costTon: 0.3, durationDays: 7 },
  { level: 2, name: "Silver",  multiplier: 1.5,  costTon: 0.7, durationDays: 14 },
  { level: 3, name: "Gold",    multiplier: 2,    costTon: 1.5, durationDays: 30 },
  { level: 4, name: "Diamond", multiplier: 3,    costTon: 3.5, durationDays: 60 },
];
```

### Reward Calculation
```typescript
BASE_AD_REWARD = 10; // Base reward per ad
actual_reward = BASE_AD_REWARD * boost_multiplier;
```

### Limits & Cooldowns
```typescript
AD_COOLDOWN_SECONDS = 30;    // Cooldown between ads
DAILY_VIEW_LIMIT = 200;      // Max ads per day
```

---

## 🎁 Partner Rewards System

### Configuration (`/config/partners.ts`)
```typescript
interface PartnerReward {
  id: string;           // Unique identifier
  name: string;         // Display name
  platform: Platform;   // 'telegram' | 'youtube' | 'twitter' | 'discord'
  url: string;          // Partner link
  reward: number;       // Reward amount (🆑)
  active: boolean;      // Is currently active
  icon?: string;        // Optional emoji icon
  description?: string; // Optional description
}
```

### Flow
1. User clicks "CLAIM" button
2. Opens partner URL in new tab
3. After 1 second, sends claim request to API
4. Backend checks if already claimed
5. Adds reward to balance
6. Records claim in database
7. Shows success toast

---

## 💎 TON Integration

### TON Connect Flow
1. User connects wallet via TonConnectButton
2. User selects boost level
3. Frontend creates order via `/orders/create`
4. Backend returns payment details (address, amount, payload)
5. User confirms transaction in wallet
6. Backend confirms via `/orders/:orderId/confirm`
7. Boost is activated and expires after duration

### Environment Variables (Backend)
```typescript
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
VITE_TON_MERCHANT_ADDRESS  // Merchant wallet address
```

### TON Connect Manifest
Location: `/tonconnect-manifest.json`
Must be accessible at: `https://yourdomain.com/tonconnect-manifest.json`

---

## 🔐 Authentication System

### Two Authentication Modes

#### 1. Anonymous Users (Default)
```typescript
// Generated ID format: anon_{timestamp}_{random}
const anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
localStorage.setItem('cladhunter_anonymous_id', anonymousId);

// API Request Headers
Authorization: Bearer ${publicAnonKey}
X-User-ID: ${anonymousId}
```

#### 2. Authenticated Users (Optional)
```typescript
// After Supabase login
Authorization: Bearer ${session.access_token}
X-User-ID: ${session.user.id}
```

### Server-Side Auth Check
```typescript
async function getUserFromAuth(
  authHeader: string | null, 
  userIdHeader: string | null
): Promise<{ id: string } | null> {
  const token = authHeader.replace('Bearer ', '');
  
  // Check if anonymous
  if (token === supabaseAnonKey && userIdHeader?.startsWith('anon_')) {
    return { id: userIdHeader };
  }
  
  // Check if authenticated
  const { data: { user } } = await supabase.auth.getUser(token);
  if (user) return { id: user.id };
  
  return null;
}
```

---

## 📱 Mobile Optimization

### Telegram WebApp Integration
```typescript
// Import from /utils/telegram.ts
import { hapticFeedback, expandApp } from '../utils/telegram';

// Usage
hapticFeedback('impact', 'medium');  // Physical feedback
hapticFeedback('notification', 'success'); // Notification feedback
expandApp(); // Expand to full screen
```

### Touch Optimization
- All buttons have `touch-manipulation` class
- Active states with `:active` pseudo-class
- Motion animations with `whileTap` for feedback
- Minimum touch target size: 44x44px

### Viewport Configuration
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
```

---

## 🎨 Design System

### Typography Rules
**IMPORTANT:** Do NOT add Tailwind typography classes unless explicitly requested:
- ❌ NO: `text-2xl`, `font-bold`, `leading-none`
- ✅ YES: Only when user specifically asks to change typography

Default typography is configured in `/styles/globals.css`

### Glass Card Component
```tsx
<GlassCard className="px-4 py-3">
  {/* Content */}
</GlassCard>
```

Properties:
- Background: `bg-white/5`
- Backdrop blur: `backdrop-blur-md`
- Border: `border border-white/10`
- Rounded corners: `rounded-lg`

### Button States
```tsx
// Primary action
className="bg-[#FF0033] text-white active:bg-[#CC0029]"

// Secondary action
className="bg-white/10 text-white active:bg-white/20"

// Disabled
className="opacity-50 cursor-not-allowed"
```

---

## 🛠️ Development Guidelines

### DO's ✅
1. Always use `useApi` hook for API calls
2. Pass `user.accessToken` and `user.id` to `makeRequest`
3. Use `hapticFeedback` for user interactions
4. Handle loading and error states
5. Show toast notifications for user feedback
6. Use Motion for animations
7. Follow the existing file structure
8. Import ShadCN components from `/components/ui`
9. Use Lucide React for icons
10. Keep mobile-first approach

### DON'Ts ❌
1. Don't modify `/supabase/functions/server/kv_store.tsx` (PROTECTED)
2. Don't modify `/components/figma/ImageWithFallback.tsx` (PROTECTED)
3. Don't create new files in `/components/ui` (ShadCN only)
4. Don't add font size/weight classes without request
5. Don't use `react-konva` (not supported)
6. Don't mock API calls if backend exists
7. Don't hardcode API URLs (use `API_BASE_URL`)
8. Don't forget error handling
9. Don't create migration files (KV store only)
10. Don't expose `SUPABASE_SERVICE_ROLE_KEY` to frontend

### Code Style
```typescript
// Use async/await
async function fetchData() {
  try {
    const response = await makeRequest('/endpoint');
    if (response?.data) {
      // Handle success
    }
  } catch (error) {
    console.error('Error:', error);
    // Handle error
  }
}

// Use optional chaining
const value = response?.data?.field;

// Use nullish coalescing
const count = dailyCountStr ?? 0;

// Type everything
interface Props {
  onSuccess: () => void;
}
```

---

## 🧪 Testing & Debugging

### Test API Endpoints
```typescript
// Use /utils/test-api.ts for testing
import { testEndpoint } from './utils/test-api';

testEndpoint('/user/init');
```

### Console Logging
Backend logs are visible in Supabase Edge Functions logs:
```typescript
console.log('Context:', { userId, endpoint, timestamp });
```

### Error Messages
Always include context in error messages:
```typescript
console.log(`Error initializing user for ${userId}:`, error);
```

---

## 🔄 State Management

### Global State (via Hooks)
```typescript
// useAuth - Authentication state
const { user, loading, isAnonymous } = useAuth();

// useUserData - User data & balance
const { userData, loading, refreshBalance } = useUserData();

// useTonConnect - TON wallet connection
const { wallet, connected, connectWallet, disconnectWallet, sendTransaction } = useTonConnect();

// useApi - API requests
const { makeRequest, loading, error } = useApi();
```

### Local State (useState)
Use for component-specific state only:
```typescript
const [claiming, setClaiming] = useState<string | null>(null);
const [showModal, setShowModal] = useState(false);
```

---

## 🚀 Current Implementation Status

### ✅ Fully Implemented
- [x] User authentication (anonymous + Supabase)
- [x] Ad viewing system with cooldowns
- [x] Economy system with 5 boost levels
- [x] TON Connect integration
- [x] Boost purchase flow
- [x] Partner rewards system
- [x] Statistics tracking
- [x] Mobile optimization
- [x] Telegram WebApp integration
- [x] Glass UI design system
- [x] Error handling & loading states
- [x] Haptic feedback
- [x] Toast notifications
- [x] Daily limits & cooldowns

### 🔧 Known Limitations
1. Transaction verification is manual (no webhook)
2. No email confirmation (auto-confirmed)
3. No social login providers configured yet
4. No analytics dashboard
5. No admin panel
6. No referral system tracking

### 💡 Potential Improvements
1. Add transaction webhook for automatic confirmation
2. Implement referral tracking and rewards
3. Add leaderboard system
4. Add achievement/badge system
5. Add push notifications
6. Add withdrawal functionality
7. Add more partner integrations
8. Add analytics dashboard for admins
9. Add rate limiting per IP
10. Add fraud detection

---

## 📋 Common Tasks

### Adding a New API Endpoint

**1. Update Server (`/supabase/functions/server/index.tsx`):**
```typescript
app.post("/make-server-0f597298/new-endpoint", async (c) => {
  try {
    const authUser = await getUserFromAuth(
      c.req.header('Authorization'), 
      c.req.header('X-User-ID')
    );
    
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // Your logic here
    
    return c.json({ success: true, data: result });
  } catch (error) {
    console.log('Error in new endpoint:', error);
    return c.json({ error: 'Failed' }, 500);
  }
});
```

**2. Add Type Definition (`/types/index.ts`):**
```typescript
export interface NewEndpointResponse {
  success: boolean;
  data: YourDataType;
}
```

**3. Use in Component:**
```typescript
const { makeRequest } = useApi();
const { user } = useAuth();

const response = await makeRequest<NewEndpointResponse>(
  '/new-endpoint',
  { method: 'POST', body: JSON.stringify(payload) },
  user.accessToken,
  user.id
);
```

### Adding a New Partner Reward

**Edit `/config/partners.ts`:**
```typescript
export const partners: PartnerReward[] = [
  {
    id: 'new-partner-id',
    name: 'New Partner',
    platform: 'telegram',
    url: 'https://t.me/newpartner',
    reward: 500,
    active: true,
    icon: '🎯',
    description: 'Subscribe to earn rewards',
  },
  // ... existing partners
];
```

### Modifying Economy Settings

**Edit `/config/economy.ts`:**
```typescript
// Adjust base reward
export const BASE_AD_REWARD = 15; // Changed from 10

// Adjust cooldown
export const AD_COOLDOWN_SECONDS = 20; // Changed from 30

// Adjust daily limit
export const DAILY_VIEW_LIMIT = 300; // Changed from 200
```

**Don't forget to update server-side constants in `/supabase/functions/server/index.tsx`!**

---

## 🐛 Common Issues & Solutions

### Issue: "Unauthorized" Error
**Solution:** Ensure `user.accessToken` and `user.id` are passed to `makeRequest`:
```typescript
await makeRequest('/endpoint', options, user.accessToken, user.id);
```

### Issue: TON Transaction Not Confirming
**Solution:** Manually confirm via API or check transaction hash on TON Explorer

### Issue: Daily Limit Not Resetting
**Solution:** KV keys are date-based: `watch_count:${userId}:YYYY-MM-DD`

### Issue: Boost Expired But Still Active
**Solution:** Backend checks expiration on `/user/init` call

### Issue: Partner Reward Already Claimed
**Solution:** Check KV store: `reward_claim:${userId}:${partnerId}`

---

## 📝 Important Notes

### Protected Files (DO NOT MODIFY)
```
/supabase/functions/server/kv_store.tsx
/components/figma/ImageWithFallback.tsx
/utils/supabase/info.tsx
/Attributions.md
/guidelines/Guidelines.md
```

### Environment Variables Required
```env
# Backend (Supabase Edge Functions)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
VITE_TON_MERCHANT_ADDRESS

# Frontend (provided by system)
projectId
publicAnonKey
```

### Import Patterns
```typescript
// ShadCN components
import { Button } from './components/ui/button';

// Icons
import { Gift, ExternalLink } from 'lucide-react';

// Motion
import { motion } from 'motion/react';

// Toast
import { toast } from 'sonner@2.0.3';

// Supabase
import { createClient } from './utils/supabase/client';
import { projectId, publicAnonKey } from './utils/supabase/info';
```

---

## 🎯 Project Goals

### Short Term
- [ ] Add transaction webhook for auto-confirmation
- [ ] Implement proper TON transaction verification
- [ ] Add more partner integrations
- [ ] Improve error messages

### Medium Term
- [ ] Add referral system with tracking
- [ ] Add leaderboard
- [ ] Add achievements/badges
- [ ] Add withdrawal system
- [ ] Add admin dashboard

### Long Term
- [ ] Scale to multiple ad networks
- [ ] Add social login providers
- [ ] Implement ML-based fraud detection
- [ ] Add mobile app versions (iOS/Android)
- [ ] Integrate with real mining operations

---

## 🔥 Best Practices

1. **Always validate user input** on both frontend and backend
2. **Use TypeScript types** for all API responses
3. **Handle edge cases** (expired boosts, daily limits, etc.)
4. **Provide user feedback** (loading states, toasts, haptics)
5. **Log errors with context** for easier debugging
6. **Keep state minimal** - derive when possible
7. **Optimize for mobile** - touch targets, animations, loading
8. **Test with anonymous users** - most common use case
9. **Follow the existing patterns** - consistency is key
10. **Document complex logic** - help future developers

---

## 📚 Additional Resources

### Supabase Documentation
- Edge Functions: https://supabase.com/docs/guides/functions
- Auth: https://supabase.com/docs/guides/auth

### TON Documentation
- TON Connect: https://docs.ton.org/develop/dapps/ton-connect
- TON Center API: https://toncenter.com/api/v2/

### Libraries Documentation
- Hono: https://hono.dev/
- Motion: https://motion.dev/
- Recharts: https://recharts.org/
- Lucide: https://lucide.dev/

---

**Last Updated:** October 22, 2025
**Version:** 1.0.0
**Status:** Production Ready ✅

### Stats Response
```typescript
{
  total_energy: 1234,
  total_watches: 45,
  total_earned: 1234,
  total_sessions: 15,        // NEW: Number of app sessions
  today_watches: 10,
  daily_limit: 200,
  boost_level: 2,
  multiplier: 1.5,
  boost_expires_at: "2025-11-01T00:00:00.000Z",
  watch_history: [            // NEW: Last 20 watch sessions
    {
      user_id: "anon_123",
      ad_id: "ad_xyz",
      reward: 15,
      base_reward: 10,
      multiplier: 1.5,
      created_at: "2025-10-22T14:30:00.000Z"
    },
    // ... more sessions
  ]
}
```