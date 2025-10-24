import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { GlassCard } from './GlassCard';
import { BoostInfo } from './BoostInfo';
import { AdModal } from './AdModal';
import { RewardsSection } from './RewardsSection';
import { Zap, Gift, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useUserData } from '../hooks/useUserData';
import { useApi } from '../hooks/useApi';
import { useTonConnect } from '../hooks/useTonConnect';
import { boostMultiplier } from '../config/economy';
import { getRandomAd, type AdCreative } from '../config/ads';
import { TonConnectButton } from './TonConnectButton';

interface AdCompleteResponse {
  success: boolean;
  reward: number;
  new_balance: number;
  multiplier: number;
  daily_watches_remaining: number;
}

export function MiningScreen() {
  const { user } = useAuth();
  const { userData, refreshBalance } = useUserData();
  const { completeAdWatch } = useApi();
  const { isConnected } = useTonConnect();

  const [isMining, setIsMining] = useState(false);
  const [miningProgress, setMiningProgress] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [currentAdCreative, setCurrentAdCreative] = useState<AdCreative | null>(null);

  const isMiningDisabled = !isConnected || isMining || cooldownRemaining > 0;

  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setTimeout(() => {
        setCooldownRemaining((value) => Math.max(value - 1, 0));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownRemaining]);

  const handleStartMining = async () => {
    if (isMining || cooldownRemaining > 0) return;

    if (!isConnected) {
      toast.error('Connect your TON wallet to start mining.');
      return;
    }

    if (!user) return;

    const adCreative = getRandomAd();
    setCurrentAdCreative(adCreative);
    setIsAdModalOpen(true);
  };

  const handleAdCompleted = async () => {
    if (!user || !currentAdCreative) return;

    setIsMining(true);
    setMiningProgress(0);

    const interval = setInterval(() => {
      setMiningProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          completeAd(currentAdCreative.id);
          return 100;
        }
        return prev + 2;
      });
    }, 100);
  };

  const completeAd = async (adId: string) => {
    if (!user) return;

    try {
      const result = await completeAdWatch<AdCompleteResponse>({
        ad_id: adId,
        wallet_address: user.address,
      });

      const multiplierText = result.multiplier > 1 ? ` (x${result.multiplier})` : '';
      toast.success(`+${result.reward} 🆑 mined successfully${multiplierText}!`);

      await refreshBalance();
      setCooldownRemaining(30);

      if (result.daily_watches_remaining <= 10) {
        toast(`${result.daily_watches_remaining} ad views remaining today`, {
          duration: 3000,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete ad watch';
      toast.error(message);
    } finally {
      setIsMining(false);
      setMiningProgress(0);
      setCurrentAdCreative(null);
    }
  };

  const handleAdModalClose = () => {
    setIsAdModalOpen(false);
    setCurrentAdCreative(null);
  };

  const currentMultiplier = userData ? boostMultiplier(userData.boost_level) : 1;
  const balance = userData?.energy || 0;

  const boostCards = [
    { icon: Zap, label: 'X2 REWARD', duration: '15 MIN', premium: true },
    { icon: Gift, label: 'EXTRA ADS', count: '+5', premium: true },
    { icon: Shield, label: 'STREAK SHIELD', premium: true },
  ];

  return (
    <div className="flex flex-col items-center px-4 pt-6 pb-24 min-h-screen">
      <div className="text-center mb-6">
        <h1 className="text-xl tracking-wider mb-2 text-[#FF0033] uppercase">
          CLADHUNTER 🆑
        </h1>
        <p className="text-white/60 tracking-wide uppercase">
          BALANCE: {balance.toFixed(1)} 🆑
        </p>
        {currentMultiplier > 1 && (
          <p className="text-[#FF0033] text-xs mt-1">
            ACTIVE BOOST: x{currentMultiplier}
          </p>
        )}
      </div>

      {!isConnected && (
        <GlassCard className="w-full mb-6 p-4 border border-[#0098EA]/30 bg-[#0098EA]/10">
          <p className="text-[#0098EA] text-xs uppercase tracking-wider text-center mb-3">
            Connect your TON wallet to unlock mining rewards
          </p>
          <TonConnectButton />
        </GlassCard>
      )}

      {userData && userData.boost_level > 0 && (
        <BoostInfo
          boostLevel={userData.boost_level}
          multiplier={currentMultiplier}
          expiresAt={userData.boost_expires_at}
        />
      )}

      <div className="relative mb-6 flex-shrink-0">
        <motion.button
          onClick={handleStartMining}
          disabled={isMiningDisabled}
          className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-gradient-to-br from-[#FF0033]/20 to-[#FF0033]/5 border-2 border-[#FF0033] flex items-center justify-center disabled:opacity-50 touch-manipulation"
          whileHover={{ scale: isMiningDisabled ? 1 : 1.05 }}
          whileTap={{ scale: isMiningDisabled ? 1 : 0.95 }}
          animate={
            isMining
              ? {
                  boxShadow: [
                    '0 0 20px rgba(255,0,51,0.5)',
                    '0 0 40px rgba(255,0,51,0.8)',
                    '0 0 20px rgba(255,0,51,0.5)',
                  ],
                  transition: { duration: 1.5, repeat: Infinity },
                }
              : {}
          }
        >
          <div className="text-center">
            <p className="text-white/60 text-xs uppercase tracking-wider mb-2">Start Mining</p>
            <p className="text-4xl font-semibold text-white">{isMining ? `${miningProgress}%` : 'GO'}</p>
            <p className="text-white/30 text-[10px] uppercase tracking-widest mt-2">
              Tap to watch ad & earn
            </p>
          </div>
        </motion.button>
      </div>

      <RewardsSection onRewardClaimed={refreshBalance} />

      <AdModal
        isOpen={isAdModalOpen}
        ad={currentAdCreative ?? getRandomAd()}
        onClose={handleAdModalClose}
        onAdCompleted={handleAdCompleted}
      />
    </div>
  );
}
