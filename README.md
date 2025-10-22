# 🆑 Cladhunter

> **Cloud Mining Simulator & Watch-to-Earn Platform**
> 
> A mobile-first web app where users earn crypto energy by watching ads and can boost their earnings with TON blockchain payments.

![Version](https://img.shields.io/badge/version-1.0.0-red)
![React](https://img.shields.io/badge/React-18+-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue)
![Supabase](https://img.shields.io/badge/Supabase-Edge%20Functions-green)
![TON](https://img.shields.io/badge/TON-Blockchain-blue)

---

## ✨ Features

- 🎯 **Ad-Based Mining**: Watch ads to earn energy (🆑)
- 🎁 **Partner Rewards**: Earn coins for subscribing to Telegram/X channels
- 📱 **Telegram Web App**: Native integration with haptic feedback
- 🎬 **Partner Ads**: Fullscreen video/image ads with 9:16 format
- ⚡ **Boost System**: Purchase multipliers with TON cryptocurrency
- 📊 **Statistics Dashboard**: Track your earnings and performance
- 💰 **Wallet Integration**: Manage balance and transactions
- 📲 **Mobile-Optimized**: Safe area insets, touch targets, responsive design
- 🎨 **Dark Futuristic Theme**: Glassmorphic UI with red accents
- 🔐 **Secure Backend**: Supabase Edge Functions or Cloudflare Workers with authentication
- 🚀 **Production Ready**: Full API, data persistence, and error handling
- 🔧 **Easy Config**: Simple files for adding partners and ads

---

## 🚀 Quick Start

### Option 1: Use in Figma Make
The app is ready to use immediately in Figma Make with Supabase integration!

### Option 2: Local Development

```bash
# Clone or download the project
cd cladhunter

# Install dependencies (if needed)
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development
npm run dev
```

**📖 Full Setup Guide**: See [QUICKSTART.md](./QUICKSTART.md)

### Option 3: Cloudflare Worker + D1 Backend

If you provisioned a Cloudflare D1 database, the repository ships with a compatible Worker implementation. Review [cloudflare/README.md](./cloudflare/README.md) for:

- Creating/binding the D1 database via `wrangler.toml`
- Applying the schema from `cloudflare/schema.sql`
- Deploying the worker so the frontend can talk to `VITE_API_BASE_URL`

Once deployed, set `VITE_API_BASE_URL` to the Worker URL (including `/make-server-0f597298`) in your Pages project so the React app calls the D1-backed API.

> **Important:** The frontend no longer falls back to the Supabase edge function. If `VITE_API_BASE_URL` is missing in production builds the app will throw an error to avoid writing data to the Supabase KV table. During local development it automatically targets `http://127.0.0.1:8787/make-server-0f597298`, which matches `wrangler dev`.

---

## 📱 Demo

### Mining Screen
- Click the big red button to start mining
- Watch 5-second ad simulation
- Earn energy with boost multipliers

### Statistics Screen
- View total mined energy
- See 7-day earnings chart
- Track mining sessions history

### Wallet Screen
- Check current balance
- Purchase premium boosts
- View transaction history
- Share referral links

---

## 🏗 Architecture

```
Frontend (React + TypeScript + Tailwind)
    ↓
API Layer (Custom Hooks + Fetch)
    ↓
Backend (Supabase Edge Functions - Hono / Cloudflare Worker + Hono)
    ↓
Database (Supabase KV Store / Cloudflare D1)
    ↓
Blockchain (TON - Future Integration)
```

**📐 Detailed Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 🛠 Tech Stack

### Frontend
- **React** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Motion** - Animations
- **Recharts** - Data visualization
- **Shadcn/ui** - Component library

### Backend
- **Supabase** - Backend-as-a-Service
- **Cloudflare Workers** - Optional edge runtime with D1 storage
- **Hono** - Web framework for Edge Functions
- **Deno** - Runtime environment
- **KV Store** - Data persistence
- **Cloudflare D1** - SQL persistence when running on Cloudflare

### Blockchain
- **TON** - Payment infrastructure (to be integrated)
- **TonConnect** - Wallet connection (planned)

---

## 📊 Economy

| Item | Value |
|------|-------|
| 1 TON | 100,000 🆑 |
| Base Ad Reward | 10-50 🆑 |
| Daily Limit | 200 ads |
| Cooldown | 30 seconds |

### Boost Levels

| Level | Name | Multiplier | Price | Duration |
|-------|------|------------|-------|----------|
| 0 | Base | 1x | Free | - |
| 1 | Bronze | 1.25x | 0.3 TON | 7 days |
| 2 | Silver | 1.5x | 0.7 TON | 14 days |
| 3 | Gold | 2x | 1.5 TON | 30 days |
| 4 | Diamond | 3x | 3.5 TON | 60 days |

---

## 🔐 Security

- ✅ **Authentication**: Supabase Auth with JWT tokens
- ✅ **Anti-Spam**: 30-second cooldown between ads
- ✅ **Rate Limiting**: 200 ads per user per day
- ✅ **Atomic Operations**: Prevent race conditions
- ✅ **Environment Variables**: Sensitive keys protected
- ✅ **CORS**: Properly configured for production

---

## 📁 Project Structure

```
/
├── components/           # React components
│   ├── MiningScreen.tsx      # Main mining interface
│   ├── RewardsSection.tsx    # Partner rewards ⭐ NEW
│   ├── StatsScreen.tsx       # Statistics & charts
│   ├── WalletScreen.tsx      # Wallet & boosts
│   └── ui/                   # Reusable UI components
├── hooks/                # Custom React hooks
│   ├── useAuth.tsx           # Authentication
│   ├── useUserData.tsx       # User state
│   └── useApi.tsx            # API requests
├── config/               # App configuration
│   ├── economy.ts            # Economy settings
│   ├── partners.ts           # Partner rewards config ⭐ NEW
│   └── ads.ts                # Ad creatives config
├── cloudflare/           # Cloudflare Worker + D1 backend
│   ├── worker.ts             # Hono worker mirroring Supabase API
│   └── schema.sql            # SQL schema for D1
├── supabase/             # Backend code
│   └── functions/server/
│       └── index.tsx         # API endpoints (includes rewards API)
├── utils/                # Utility functions
│   ├── helpers.ts            # Helper functions
│   ├── telegram.ts           # Telegram Web App utils
│   └── test-api.ts           # API testing tools
├── types/                # TypeScript types
├── App.tsx               # Main app component
└── styles/               # Global styles
```

---

## 🧪 Testing

### Manual Testing
```bash
# Open browser console and run:
await window.testApi.runAllTests()
```

### API Testing
```bash
# Test individual endpoints:
await window.testApi.testHealth()
await window.testApi.testUserInit()
await window.testApi.testCompleteAd('ad_1')
```

### Simulation
```bash
# Simulate 5 mining sessions with cooldown:
await window.testApi.simulateMining(5)
```

---

## 🚀 Deployment

### Frontend
Deploy to any static hosting:
- **Vercel**: `vercel deploy`
- **Netlify**: Drag & drop build folder
- **GitHub Pages**: Push to gh-pages branch

### Backend
Already deployed on Supabase Edge Functions!
No additional setup needed.

---

## 📝 Configuration

### Economy Settings
Edit `/config/economy.ts`:

```typescript
export const TON_TO_ENERGY_RATE = 100000;
export const DAILY_VIEW_LIMIT = 200;
export const AD_COOLDOWN_SECONDS = 30;
```

### Partner Rewards ⭐ NEW
Edit `/config/partners.ts` to add partner channels:

```typescript
{
  id: 'telegram_your_channel',
  platform: 'telegram',        // telegram | x | youtube | instagram | discord
  name: 'Your Channel',
  url: 'https://t.me/channel',
  reward: 750,                 // Coins (500-1000 recommended)
  active: true,
}
```

**Full Guide**: [REWARDS_GUIDE.md](./REWARDS_GUIDE.md)

### Partner Ads
Edit `/config/ads.ts` to add video/image ads:

```typescript
{
  id: 'your_ad',
  type: 'video',              // or 'image'
  url: 'https://cdn.com/ad.mp4',
  partnerUrl: 'https://partner.com',
  partnerName: 'Partner',
}
```

### Boost Levels
```typescript
export const BOOSTS = [
  { level: 1, name: "Bronze", multiplier: 1.25, costTon: 0.3, durationDays: 7 },
  // Add more...
];
```

### Theme Colors
Edit `/styles/globals.css` to change brand colors.

---

## 📚 Documentation

### Getting Started
- **Quick Start**: [QUICKSTART.md](./QUICKSTART.md) - Get started in 5 minutes
- **Setup Guide**: [SETUP.md](./SETUP.md) - Detailed setup instructions
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md) - System design & data flow

### Partner & Ads Setup ⭐ NEW
- **Rewards Guide**: [REWARDS_GUIDE.md](./REWARDS_GUIDE.md) - Add partners & ads easily

### Ad System
- **Ad System Guide**: [AD_SYSTEM.md](./AD_SYSTEM.md) - Complete ad integration guide
- **Ad Quick Start**: [AD_QUICKSTART.md](./AD_QUICKSTART.md) - Partner ad setup
- **Ad Flow**: [docs/ad-flow.md](./docs/ad-flow.md) - Visual flow diagrams

### Mobile & Telegram
- **Mobile Optimization**: [MOBILE_OPTIMIZATION.md](./MOBILE_OPTIMIZATION.md) - Full mobile guide
- **Mobile Quick Start**: [MOBILE_QUICKSTART.md](./MOBILE_QUICKSTART.md) - TG Web App setup
- **Testing Checklist**: [docs/mobile-testing-checklist.md](./docs/mobile-testing-checklist.md) - QA guide

### API Reference
- See inline comments in `/supabase/functions/server/index.tsx`

---

## 🗺 Roadmap

### Phase 1: MVP ✅
- [x] Core mining mechanics
- [x] User authentication
- [x] Energy system
- [x] Basic UI/UX
- [x] Supabase integration

### Phase 2: Boosts 🚧
- [x] Boost purchase system
- [x] Demo payment flow
- [ ] Real TON payment integration
- [ ] Webhook verification

### Phase 3: Features 📋
- [ ] Real ad network integration (AdMob/Unity Ads)
- [ ] Referral tracking
- [ ] Daily bonuses
- [ ] Achievements system
- [ ] Leaderboards

### Phase 4: Scale 🔮
- [ ] Migrate to PostgreSQL
- [ ] Add caching layer
- [ ] Analytics dashboard
- [ ] Admin panel
- [ ] Social features

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Guidelines**:
- Follow existing code style
- Add TypeScript types
- Test on mobile viewport
- Update documentation

---

## ⚠️ Known Limitations

### Current Demo Mode
- **Simulated Ads**: Uses 5-second timer instead of real ads
- **Manual Payment Confirmation**: TON payments not auto-verified
- **Anonymous Users**: No email/social login yet
- **No Withdrawals**: Withdrawal feature is UI-only

### Production Todos
- Integrate real ad network (AdMob, Unity Ads, etc.)
- Implement TON payment webhook verification
- Add email/social authentication
- Build withdrawal system with Lightning or TON
- Set up admin dashboard for ad management
- Add rate limiting via Supabase

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 💬 Support

- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions
- **Logs**: Check Supabase Dashboard → Logs → Edge Functions
- **Console**: Browser DevTools (F12) for frontend errors

---

## 🌟 Acknowledgments

- Built with [Supabase](https://supabase.com)
- UI components from [Shadcn/ui](https://ui.shadcn.com)
- Icons from [Lucide React](https://lucide.dev)
- Charts by [Recharts](https://recharts.org)
- Animations by [Motion](https://motion.dev)

---

## 🎯 Project Goals

Cladhunter aims to:
- Democratize crypto mining through ad-based earning
- Provide a fun, gamified experience
- Integrate TON blockchain for real value
- Create a sustainable watch-to-earn economy
- Offer a blueprint for similar projects

---

**Made with ❤️ for the TON ecosystem**

*Star ⭐ this repo if you find it useful!*

---

## 📸 Screenshots

*Add your screenshots here after deployment*

---

**Version**: 1.0.0  
**Last Updated**: October 19, 2025  
**Status**: Production Ready (Demo Mode)
