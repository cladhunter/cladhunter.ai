# Cladhunter - Quick Start Guide 🚀

Get your Cladhunter app running in 5 minutes!

## ⚡ Prerequisites

- Supabase account (free tier works)
- Node.js 18+ (if running locally)
- Web browser (Chrome/Safari recommended for mobile testing)

## 🏃 Quick Setup

### Step 1: Get Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a new project (or use existing)
3. Go to Settings → API
4. Copy these values:
   - Project URL → `SUPABASE_URL`
   - anon/public key → `SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

### Step 2: Configure Environment

The app will work immediately in Figma Make! Just make sure the Supabase Edge Function is deployed.

For local development, create `.env`:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
VITE_TON_MERCHANT_ADDRESS=UQDemo
```

### Step 3: Test the App

1. Open the app in your browser
2. You'll see the Mining screen
3. Click "START MINING" button
4. Watch the 5-second progress bar
5. Receive your first energy (🆑)!

**That's it!** The app is now fully functional.

## 📱 Testing Features

### Test Ad Mining

1. Click the big red "START MINING" button
2. Wait for progress to complete (5 seconds)
3. See your balance increase
4. Wait 30 seconds before next ad (cooldown)

### Test Statistics

1. Tap "STATS" in bottom navigation
2. View your total mined energy
3. Check mining sessions history
4. See today's watch count

### Test Boost Purchase (Demo Mode)

1. Tap "WALLET" in bottom navigation
2. Scroll to "PREMIUM BOOSTS"
3. Click price button (e.g., "0.3 TON")
4. Order created - see pending payment card
5. Click "I HAVE SENT THE PAYMENT"
6. Boost activated! Return to Mining to see multiplier

**Note**: In demo mode, payments are instantly confirmed. For production, you'll need to integrate real TON payment verification.

## 🧪 Testing Checklist

- [x] App loads without errors
- [ ] Mining button works
- [ ] Balance increases after mining
- [ ] Cooldown prevents spam clicking
- [ ] Stats screen shows data
- [ ] Wallet displays balance
- [ ] Boost purchase creates order
- [ ] Boost activation increases multiplier
- [ ] Navigation between screens works
- [ ] Mobile-responsive design

## 🎨 Customization

### Change Economy Settings

Edit `/config/economy.ts`:

```typescript
export const TON_TO_ENERGY_RATE = 200000; // 1 TON = 200k energy
export const DAILY_VIEW_LIMIT = 500;      // 500 ads per day
export const AD_COOLDOWN_SECONDS = 15;    // 15s cooldown
```

### Adjust Boost Levels

```typescript
export const BOOSTS = [
  { level: 1, name: "Starter", multiplier: 1.5, costTon: 0.1, durationDays: 3 },
  { level: 2, name: "Pro", multiplier: 2.5, costTon: 0.5, durationDays: 7 },
  // Add more levels...
];
```

### Change Theme Colors

Edit `/styles/globals.css`:

```css
/* Replace red (#FF0033) with your brand color */
.text-primary { color: #00FF88; }  /* Green theme example */
```

## 🔍 Troubleshooting

### "Unauthorized" Error
**Problem**: API returns 401  
**Solution**: Check `SUPABASE_ANON_KEY` is set correctly

### Balance Not Updating
**Problem**: Clicks don't increase balance  
**Solution**: 
1. Check browser console for errors
2. Open Supabase dashboard → Logs
3. Verify Edge Function is deployed

### Cooldown Not Working
**Problem**: Can spam click mining button  
**Solution**: This is a frontend-only cooldown. Server enforces 30s cooldown regardless.

### App Won't Load
**Problem**: White screen or loading forever  
**Solution**:
1. Check all imports are correct
2. Clear browser cache
3. Check console for errors
4. Verify Supabase project is active

## 📊 Demo Data

The app comes with 3 sample ads:

```typescript
{ id: 'ad_1', reward: 10, type: 'short' }
{ id: 'ad_2', reward: 25, type: 'long' }
{ id: 'ad_3', reward: 50, type: 'promo' }
```

To add real ads, edit `/supabase/functions/server/index.tsx`:

```typescript
const SAMPLE_ADS = [
  { id: 'ad_4', url: 'https://yourapp.com/ad', reward: 15, type: 'short', active: true },
  // Add more...
];
```

## 🚀 Next Steps

1. **Go Live**: Deploy to production
   - Frontend → Vercel/Netlify
   - Backend → Already on Supabase!

2. **Add Real Ads**: Integrate AdMob/Unity Ads
   - Replace simulation with real ad viewing
   - Add completion callbacks

3. **Enable TON Payments**: Set up payment verification
   - Get TON API key
   - Implement webhook
   - Test with real TON

4. **Launch Marketing**:
   - Create landing page
   - Set up social media
   - Launch referral program

## 📚 Documentation

- Full setup: See [SETUP.md](./SETUP.md)
- Architecture: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- API docs: Check `/supabase/functions/server/index.tsx`

## 💬 Support

Need help? 
- Check Supabase logs: Dashboard → Logs → Edge Functions
- Check browser console: F12 → Console tab
- Review network requests: F12 → Network tab

---

**Ready to start mining? Click that button! 🆑**
