# Cladhunter Architecture

## 📐 System Overview

Cladhunter is a three-tier watch-to-earn application built on Supabase and TON blockchain.

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│            React + TypeScript + Tailwind                │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│    │  Mining  │  │  Stats   │  │  Wallet  │           │
│    │  Screen  │  │  Screen  │  │  Screen  │           │
│    └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│         └─────────────┼─────────────┘                   │
│                       │                                  │
│              ┌────────▼────────┐                        │
│              │  Custom Hooks   │                        │
│              │  useAuth        │                        │
│              │  useUserData    │                        │
│              │  useApi         │                        │
│              └────────┬────────┘                        │
└───────────────────────┼──────────────────────────────────┘
                        │ HTTPS + Bearer Auth
┌───────────────────────▼──────────────────────────────────┐
│                   BACKEND (Edge Function)                │
│                   Hono Web Server                        │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│    │   User   │  │   Ads    │  │  Orders  │           │
│    │   API    │  │   API    │  │   API    │           │
│    └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│         └─────────────┼─────────────┘                   │
│                       │                                  │
│              ┌────────▼────────┐                        │
│              │   KV Store      │                        │
│              │   (Supabase)    │                        │
│              └─────────────────┘                        │
└──────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│                   TON BLOCKCHAIN                         │
│              Payment Verification                        │
│              (Future Integration)                        │
└──────────────────────────────────────────────────────────┘
```

## 🗂 Project Structure

```
/
├── components/           # React Components
│   ├── MiningScreen.tsx      # Main ad-watching interface
│   ├── StatsScreen.tsx       # User statistics & charts
│   ├── WalletScreen.tsx      # Balance & boost purchases
│   ├── BoostInfo.tsx         # Active boost indicator
│   ├── GlassCard.tsx         # Reusable glassmorphic card
│   ├── BottomNav.tsx         # Mobile navigation
│   ├── LoadingAnimation.tsx  # Loading states
│   ├── ErrorBoundary.tsx     # Error handling
│   └── ui/                   # Shadcn components
│
├── hooks/                # Custom React Hooks
│   ├── useAuth.tsx           # Authentication logic
│   ├── useUserData.tsx       # User state management
│   └── useApi.tsx            # API request wrapper
│
├── config/               # Application Configuration
│   └── economy.ts            # Economy constants & helpers
│
├── types/                # TypeScript Definitions
│   └── index.ts              # Shared types
│
├── utils/                # Utility Functions
│   └── supabase/
│       ├── client.tsx        # Supabase client initialization
│       └── info.tsx          # Project configuration
│
├── supabase/             # Backend (Edge Functions)
│   └── functions/server/
│       ├── index.tsx         # API routes & logic
│       └── kv_store.tsx      # Key-value storage (protected)
│
├── styles/               # Global Styles
│   └── globals.css           # Tailwind + custom CSS
│
├── App.tsx               # Main application component
├── SETUP.md              # Setup instructions
├── ARCHITECTURE.md       # This file
└── .env.example          # Environment variables template
```

## 🔄 Data Flow

### 1. User Initialization
```
User opens app → useAuth hook → Check Supabase session
  ↓
No session → Generate anonymous ID → Store in localStorage
  ↓
Call POST /user/init → Create or fetch user from KV store
  ↓
useUserData updates global state → Components render with data
```

### 2. Ad Watching Flow
```
User clicks "START MINING" → GET /ads/next → Receive random ad
  ↓
5-second progress animation (simulated ad viewing)
  ↓
POST /ads/complete with ad_id
  ↓
Server validates:
  - Cooldown (30s since last watch)
  - Daily limit (200 ads/day)
  - Ad exists
  ↓
Calculate reward = base_reward × boost_multiplier
  ↓
Atomic update:
  - Increment user.energy
  - Update user.last_watch_at
  - Create watch log
  - Increment daily counter
  ↓
Return new balance → Frontend refreshes → Toast notification
```

### 3. Boost Purchase Flow
```
User clicks boost price → POST /orders/create
  ↓
Server creates order with:
  - Unique payload
  - Pending status
  - TON amount
  ↓
Frontend displays payment instructions
  ↓
User sends TON → Clicks "I HAVE SENT THE PAYMENT"
  ↓
POST /orders/:orderId/confirm (Demo mode - auto-confirm)
  ↓
Server updates:
  - order.status = 'paid'
  - user.boost_level = ordered level
  - user.boost_expires_at = now + duration
  ↓
Frontend refreshes balance → Shows active boost indicator
```

## 🗄 Data Schema (KV Store)

### Keys Structure

```typescript
// User data
"user:{userId}" → {
  id: string,
  energy: number,
  boost_level: number,
  last_watch_at: string | null,
  boost_expires_at: string | null,
  created_at: string
}

// Watch logs (for history & stats)
"watch:{userId}:{timestamp}" → {
  user_id: string,
  ad_id: string,
  reward: number,
  base_reward: number,
  multiplier: number,
  created_at: string
}

// Daily watch counter
"watch_count:{userId}:{YYYY-MM-DD}" → "150"  // string number

// Orders
"order:{orderId}" → {
  id: string,
  user_id: string,
  boost_level: number,
  ton_amount: number,
  status: 'pending' | 'paid' | 'failed',
  payload: string,
  tx_hash: string | null,
  created_at: string
}
```

### Why KV Store?

- ✅ No migrations needed
- ✅ Fast read/write operations
- ✅ Built into Supabase
- ✅ Flexible schema
- ✅ Prefix-based querying
- ⚠️ Not suitable for complex queries (use Postgres for production scale)

## 🔐 Security Architecture

### Authentication Flow

```
Frontend Request
  ↓
Authorization: Bearer {access_token or public_anon_key}
  ↓
Backend: supabase.auth.getUser(token)
  ↓
Valid? → Extract user.id → Proceed
Invalid? → Return 401 Unauthorized
```

### Protected Routes

All API routes except `/health` require authentication:

```typescript
const authUser = await getUserFromAuth(c.req.header('Authorization'));
if (!authUser) {
  return c.json({ error: 'Unauthorized' }, 401);
}
```

### Anti-Abuse Mechanisms

1. **Cooldown System**: 30s between ad views
2. **Daily Limit**: 200 ads per user per day
3. **Watch Logs**: All activity tracked for auditing
4. **Atomic Operations**: Prevent race conditions
5. **Payload Matching**: TON transactions verified by unique payload

### Environment Variables Security

```
❌ NEVER expose in frontend:
  - SUPABASE_SERVICE_ROLE_KEY
  - TON_API_KEY (for payment verification)

✅ Safe for frontend:
  - SUPABASE_ANON_KEY (row-level security applied)
  - VITE_TON_MERCHANT_ADDRESS
  - VITE_TONCONNECT_MANIFEST_URL
```

## 📊 Economy System

### Energy & TON Conversion

```typescript
1 TON = 100,000 energy (🆑)
1 energy = 0.00001 TON

Example: User has 5,000 🆑 = 0.05 TON
```

### Ad Rewards

| Ad Type | Base Reward | Duration |
|---------|-------------|----------|
| Short   | 10 🆑       | ~5s      |
| Long    | 25 🆑       | ~15s     |
| Promo   | 50 🆑       | ~30s     |

### Boost Multipliers

Actual reward = Base Reward × Boost Multiplier

```
No boost:  10 🆑 × 1    = 10 🆑
Bronze:    10 🆑 × 1.25 = 12.5 🆑
Silver:    10 🆑 × 1.5  = 15 🆑
Gold:      10 🆑 × 2    = 20 🆑
Diamond:   10 🆑 × 3    = 30 🆑
```

### ROI Calculation (Example)

**Gold Boost Purchase:**
- Cost: 1.5 TON = 150,000 🆑
- Duration: 30 days
- Multiplier: 2x
- Extra earnings per ad: 10 🆑 (double from 10 to 20)

Breakeven: 150,000 ÷ 10 = 15,000 ads needed
Daily: 15,000 ÷ 30 = 500 ads/day (exceeds daily limit)

**Conclusion**: Boosts are profitable only for power users hitting daily limits.

## 🚀 Performance Optimization

### Frontend
- Lazy loading screens (already implemented via conditional rendering)
- Debounced API calls
- Local state caching with `useUserData`
- Motion animations optimized for 60fps

### Backend
- KV store for O(1) lookups
- Prefix queries for range operations
- Atomic operations prevent conflicts
- CORS pre-flight caching (600s)

### Future Optimizations
- Implement Redis for session caching
- Add CDN for static assets
- WebSocket for real-time balance updates
- Service Worker for offline support

## 🧪 Testing Strategy

### Manual Testing Checklist

- [ ] User initialization creates new record
- [ ] Ad mining increases balance correctly
- [ ] Cooldown prevents spam clicking
- [ ] Daily limit enforcement works
- [ ] Boost purchase creates order
- [ ] Order confirmation activates boost
- [ ] Multiplier applies to subsequent ads
- [ ] Boost expiration resets to base level
- [ ] Stats screen shows accurate data
- [ ] Navigation works smoothly
- [ ] Responsive design on mobile
- [ ] Error states display properly

### Integration Testing (Future)

```bash
# Test ad completion
curl -X POST https://{projectId}.supabase.co/functions/v1/make-server-0f597298/ads/complete \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"ad_id": "ad_1"}'

# Expected: 200 OK with reward and new balance
```

## 🔮 Future Enhancements

### Phase 2: Real Ad Integration
- Integrate Google AdMob or Unity Ads
- Server-side ad verification
- Video completion callbacks

### Phase 3: TON Payments
- TON API webhook integration
- Automatic payment verification
- Real-time transaction monitoring

### Phase 4: Social Features
- Referral tracking implementation
- Leaderboards
- Daily/weekly challenges
- Social sharing rewards

### Phase 5: Gamification
- Achievements system
- Streak bonuses
- Lucky draws
- Seasonal events

### Phase 6: Scaling
- Migrate from KV to PostgreSQL
- Implement caching layer (Redis)
- Rate limiting with Upstash
- Analytics dashboard (Mixpanel/Amplitude)

## 📞 Troubleshooting

### Common Issues

**Issue**: "Unauthorized" error
**Solution**: Check if `SUPABASE_ANON_KEY` is set correctly

**Issue**: Balance not updating
**Solution**: Check browser console and Supabase logs

**Issue**: Cooldown not working
**Solution**: Verify server time vs client time (check timezone)

**Issue**: Order not confirming
**Solution**: This is expected - TON verification not yet implemented

### Debug Mode

Add to browser console:

```javascript
localStorage.setItem('debug', 'true');
```

Then check network tab for detailed request/response logs.

## 👥 Contributing

When extending this codebase:

1. Follow existing naming conventions
2. Add TypeScript types for all new data structures
3. Update SETUP.md if adding env variables
4. Test on mobile viewport (375px width minimum)
5. Maintain the dark futuristic aesthetic
6. Keep components under 300 lines
7. Document all API endpoints

---

**Built with ❤️ for the TON ecosystem**
**Last Updated**: October 19, 2025
