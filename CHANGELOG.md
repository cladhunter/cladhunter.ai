# Changelog

All notable changes to Cladhunter will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2025-10-19

### 🎉 Initial Release - Production Ready (Demo Mode)

### ✨ Added

#### Core Features
- **Mining System**: Watch ads to earn energy (🆑)
- **Boost System**: Purchase multipliers with TON cryptocurrency
- **Statistics Dashboard**: Track earnings, sessions, and performance
- **Wallet**: Manage balance, view transactions, and share referrals
- **Mobile-First Design**: Optimized for touch devices with 48px minimum tap targets

#### Frontend Components
- `MiningScreen`: Main ad-watching interface with progress ring
- `StatsScreen`: Statistics with Recharts integration
- `WalletScreen`: Balance management and boost purchases
- `BottomNav`: Mobile navigation bar
- `GlassCard`: Reusable glassmorphic card component
- `LoadingAnimation`: Smooth loading states
- `ErrorBoundary`: Global error handling
- `BoostInfo`: Active boost indicator

#### Custom Hooks
- `useAuth`: Authentication and anonymous user management
- `useUserData`: User state synchronization
- `useApi`: Centralized API request handling

#### Backend API (Supabase Edge Functions)
- `POST /user/init`: Initialize or fetch user data
- `GET /user/balance`: Get current balance and boost info
- `GET /ads/next`: Fetch random ad for viewing
- `POST /ads/complete`: Complete ad watch and credit energy
- `POST /orders/create`: Create boost purchase order
- `GET /orders/:orderId`: Check order status
- `POST /orders/:orderId/confirm`: Confirm payment (demo mode)
- `GET /stats`: Get user mining statistics
- `GET /health`: Health check endpoint

#### Data Management
- KV Store integration for data persistence
- User profiles with energy and boost tracking
- Watch logs for history and auditing
- Order tracking for boost purchases
- Daily watch counters with automatic reset

#### Economy System
- Configurable conversion rates (1 TON = 100,000 🆑)
- Three ad types: Short (10 🆑), Long (25 🆑), Promo (50 🆑)
- Five boost levels: Base (1x), Bronze (1.25x), Silver (1.5x), Gold (2x), Diamond (3x)
- Daily limit: 200 ads per user
- Cooldown: 30 seconds between ads

#### Security
- JWT-based authentication via Supabase
- Anonymous user support with localStorage
- Protected API routes with Bearer token validation
- Anti-spam cooldown system
- Daily view limit enforcement
- Atomic balance updates to prevent race conditions

#### UI/UX
- Dark futuristic theme (#0A0A0A background)
- Glassmorphic cards with blur effects
- Red accent color (#FF0033)
- Smooth animations with Motion/Framer Motion
- Toast notifications with Sonner
- Progress indicators and loading states
- Responsive design (mobile-first)

#### Developer Experience
- TypeScript for type safety
- Comprehensive documentation (README, SETUP, ARCHITECTURE, QUICKSTART)
- API testing utilities (`window.testApi`)
- Helper functions library
- Error handling and logging
- .env.example template

#### Documentation
- `README.md`: Project overview and features
- `SETUP.md`: Detailed setup instructions
- `ARCHITECTURE.md`: System design and data flow
- `QUICKSTART.md`: 5-minute getting started guide
- `CHANGELOG.md`: Version history (this file)
- Inline code comments throughout

### 🔧 Technical Details

#### Dependencies
- React 18+
- TypeScript 5+
- Tailwind CSS 4.0
- Shadcn/ui component library
- Motion (Framer Motion)
- Recharts for data visualization
- Supabase client
- Hono web framework (backend)
- Sonner for toast notifications

#### Data Schema
```
user:{userId} → User profile and balance
watch:{userId}:{timestamp} → Watch log entries
watch_count:{userId}:{date} → Daily counter
order:{orderId} → Purchase orders
```

### ⚠️ Known Limitations

#### Demo Mode Features
- Simulated ad viewing (5-second timer)
- Manual payment confirmation (no real TON verification)
- Anonymous users only (no email/social login)
- Withdrawal UI only (not functional)
- Sample ad data (not connected to real ad network)

### 🚧 Planned Features (Future Releases)

#### v1.1.0 - Real Ad Integration
- [ ] AdMob integration
- [ ] Unity Ads support
- [ ] Video completion callbacks
- [ ] Server-side ad verification

#### v1.2.0 - TON Payments
- [ ] TON API webhook
- [ ] Automatic payment verification
- [ ] Transaction monitoring
- [ ] Real-time confirmations

#### v1.3.0 - Authentication
- [ ] Email/password login
- [ ] Social login (Google, GitHub)
- [ ] Password recovery
- [ ] Account migration from anonymous

#### v1.4.0 - Withdrawals
- [ ] TON wallet withdrawals
- [ ] Lightning Network support
- [ ] Minimum withdrawal amounts
- [ ] Transaction fees

#### v1.5.0 - Social Features
- [ ] Referral tracking
- [ ] Leaderboards
- [ ] Daily challenges
- [ ] Social sharing rewards

#### v2.0.0 - Scale & Optimize
- [ ] PostgreSQL migration
- [ ] Redis caching
- [ ] Rate limiting (Upstash)
- [ ] Admin dashboard
- [ ] Analytics integration

### 📊 Statistics

- **Lines of Code**: ~5,000+
- **Components**: 8 main screens/components
- **API Endpoints**: 8 functional routes
- **Documentation**: 5 comprehensive guides
- **Type Definitions**: Full TypeScript coverage

### 🙏 Credits

- Built on Supabase platform
- UI components from Shadcn/ui
- Icons from Lucide React
- Charts by Recharts
- Animations by Motion

---

## [1.1.0] - 2025-10-21

### ✨ Added - Partner Ad System

#### Ad Display System
- **AdModal Component**: Fullscreen modal for displaying partner advertisements
  - Video support (MP4, 9:16 aspect ratio)
  - Image support (static creatives, 9:16 aspect ratio)
  - **"Claim Reward" button** - Fixed at bottom of screen
  - 6-second viewing requirement before claim appears
  - **Guaranteed partner redirect** - Opens partner site on claim
  - **Simultaneous reward** - Claims coins AND visits partner
  - Auto-enables claim button on video end
  - Minimum view duration tracking (3 seconds)
  - Progress bar for video ads
  - Partner name badge overlay
  - Countdown indicator during viewing

#### Mobile & Telegram Optimization
- **Full Mobile Support**: Optimized for vertical phone screens
  - Dynamic viewport height (`100dvh`) for mobile browsers
  - Safe area insets for notched devices (iPhone X+)
  - Touch-optimized buttons (56px minimum height)
  - Object-cover for responsive video/images
  - Bottom-fixed controls with gradient overlay
  
- **Telegram Web App Integration**:
  - Auto-detection and initialization
  - Haptic feedback on interactions
  - Proper external link handling
  - Theme color synchronization (#0A0A0A)
  - Full viewport expansion
  - Safe area support for all devices

#### Ad Configuration
- **`/config/ads.ts`**: Centralized ad creative management
  - Simple array-based ad configuration
  - Support for video and image creatives
  - Partner URL tracking for redirects
  - Optional partner name and duration metadata
  - `getRandomAd()` helper function
  - Configurable ad viewing parameters (skip delay, tracking, etc.)

#### Updated Mining Flow
- **MiningScreen Integration**:
  - Replaced simulated ad viewing with real ad display
  - Click "START MINING" → Show ad modal → Mine after viewing
  - Maintained server-side tracking and reward system
  - Applied boost multipliers to rewards
  - Preserved cooldown and daily limits

#### Server Updates
- Simplified ad tracking to work with any ad_id from config
- Removed hardcoded SAMPLE_ADS array
- Unified BASE_AD_REWARD system (10 🆑 base)
- Maintained all security features (cooldowns, limits, logging)

#### Documentation
- **`AD_SYSTEM.md`**: Complete guide for ad system
  - How to add new partner ads
  - Configuration examples
  - UX flow documentation
  - Analytics and tracking guide
  - Monetization recommendations
  - Security features overview
- **`MOBILE_OPTIMIZATION.md`**: Mobile & Telegram optimization guide
  - Telegram Web App integration details
  - Safe area inset implementation
  - Dynamic viewport height usage
  - Touch target optimization
  - Testing checklist
  - Debugging tools
- **`AD_UPDATE_SUMMARY.md`**: Migration from Skip to Claim button
- **`AD_QUICKSTART.md`**: Quick setup for partners
- **`docs/ad-flow.md`**: Visual flow diagrams

### 🔧 Changed
- Refactored ad viewing from simulated progress to real ad display
- Updated server `/ads/next` endpoint (now deprecated, kept for compatibility)
- Modified `/ads/complete` to accept any ad_id from client config

### 💡 Features
- Partner ads are now displayed in fullscreen modal
- Users can click ads to visit partner sites (counts as view)
- Skip button appears after 6 seconds in random position
- Minimum 3-second view required for reward
- All existing security features maintained

### 📊 Technical Details
- New component: `/components/AdModal.tsx`
- New config: `/config/ads.ts`
- New utility: `/utils/telegram.ts`
- Updated: `/components/MiningScreen.tsx`
- Updated: `/supabase/functions/server/index.tsx`
- Updated: `/App.tsx` (Telegram init)
- Updated: `/styles/globals.css` (mobile optimizations)
- New docs: `/AD_SYSTEM.md`
- New docs: `/MOBILE_OPTIMIZATION.md`
- New docs: `/AD_UPDATE_SUMMARY.md`
- New docs: `/AD_QUICKSTART.md`
- New docs: `/docs/ad-flow.md`

---

## [Unreleased]

### In Progress
- TON Connect production setup (merchant address configuration)
- Ad creative collection from partners
- Performance optimization planning

### Under Consideration
- Progressive Web App (PWA) support
- Offline mode
- Multi-language support
- Dark/light theme toggle
- Custom avatar system
- Achievement badges

---

**Format Notes:**
- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` for vulnerability fixes

---

**Maintained by Cladhunter Team**  
**Last Updated**: October 21, 2025
