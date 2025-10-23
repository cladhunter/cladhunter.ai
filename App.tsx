import { useState, useEffect } from 'react';
import { MiningScreen } from './components/MiningScreen';
import { StatsScreen } from './components/StatsScreen';
import { WalletScreen } from './components/WalletScreen';
import { BottomNav } from './components/BottomNav';
import { Toaster } from './components/ui/sonner';
import { LoadingAnimation } from './components/LoadingAnimation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './hooks/useAuth';
import { initTelegramWebApp } from './utils/telegram';
import './utils/test-api'; // Load API tester for development
import { TonConnectButton } from './components/TonConnectButton';
import { GlassCard } from './components/GlassCard';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<'mining' | 'stats' | 'wallet'>('mining');
  const [isLoading, setIsLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();

  // Initialize Telegram Web App on mount
  useEffect(() => {
    initTelegramWebApp();
  }, []);

  const handleNavigate = (screen: 'mining' | 'stats' | 'wallet') => {
    setIsLoading(true);
    setTimeout(() => {
      setActiveScreen(screen);
      setIsLoading(false);
    }, 300);
  };

  if (authLoading) {
    return (
      <div className="relative min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden flex items-center justify-center">
        <LoadingAnimation />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="relative min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden">
        {/* Noise Texture Overlay */}
        <div
          className="fixed inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Main Content Container - Mobile Frame */}
        <div className="relative w-full min-h-screen mx-auto safe-area-inset">
          {!user ? (
            <div className="flex flex-col items-center justify-center h-screen px-6 pb-24 text-center">
              <div className="max-w-sm w-full">
                <GlassCard className="p-6 border border-[#0098EA]/30 bg-[#0098EA]/10">
                  <p className="text-[#0098EA] text-xs uppercase tracking-[0.3em] mb-3">
                    Access Required
                  </p>
                  <h1 className="text-2xl font-semibold tracking-widest uppercase mb-3">
                    Connect TON Wallet
                  </h1>
                  <p className="text-white/60 text-sm leading-relaxed mb-6">
                    Авторизуйтесь через TON Connect, чтобы начать добычу 🆑, отслеживать статистику и покупать бусты.
                  </p>
                  <TonConnectButton />
                </GlassCard>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-screen">
              <LoadingAnimation />
            </div>
          ) : (
            <>
              {activeScreen === 'mining' && <MiningScreen />}
              {activeScreen === 'stats' && <StatsScreen />}
              {activeScreen === 'wallet' && <WalletScreen />}
            </>
          )}

          {/* Bottom Navigation */}
          {user && <BottomNav activeScreen={activeScreen} onNavigate={handleNavigate} />}
        </div>

        {/* Toast Notifications */}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 0, 51, 0.3)',
              color: '#FF0033',
              textTransform: 'uppercase',
              fontSize: '12px',
              letterSpacing: '0.05em',
            },
          }}
        />
      </div>
    </ErrorBoundary>
  );
}
