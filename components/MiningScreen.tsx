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
import { boostMultiplier } from '../config/economy';
import { getRandomAd, type AdCreative } from '../config/ads';

interface AdResponse {
  id: string;
  url: string;
  reward: number;
  type: string;
}

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
  const { makeRequest } = useApi();
  
  const [isMining, setIsMining] = useState(false);
  const [miningProgress, setMiningProgress] = useState(0);
  const [currentAd, setCurrentAd] = useState<AdResponse | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [currentAdCreative, setCurrentAdCreative] = useState<AdCreative | null>(null);

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setTimeout(() => {
        setCooldownRemaining(cooldownRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownRemaining]);

  const handleStartMining = async () => {
    if (isMining || !user || cooldownRemaining > 0) return;
    
    // Get a random ad creative
    const adCreative = getRandomAd();
    setCurrentAdCreative(adCreative);
    
    // Open ad modal
    setIsAdModalOpen(true);
  };

  const handleAdCompleted = async () => {
    if (!user || !currentAdCreative) return;

    setIsMining(true);
    setMiningProgress(0);

    // Simulate mining progress
    const interval = setInterval(() => {
      setMiningProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          completeAdWatch(currentAdCreative.id);
          return 100;
        }
        return prev + 2;
      });
    }, 100);
  };

  const completeAdWatch = async (adId: string) => {
    if (!user) return;

    const result = await makeRequest<AdCompleteResponse>(
      '/ads/complete',
      {
        method: 'POST',
        body: JSON.stringify({ ad_id: adId }),
      },
      user.accessToken,
      user.id
    );

    setIsMining(false);
    setMiningProgress(0);
    setCurrentAd(null);

    if (result) {
      const multiplierText = result.multiplier > 1 ? ` (x${result.multiplier})` : '';
      toast.success(`+${result.reward} 🆑 mined successfully${multiplierText}!`);
      
      // Refresh balance
      await refreshBalance();
      
      // Set cooldown
      setCooldownRemaining(30);
      
      // Show remaining watches
      if (result.daily_watches_remaining <= 10) {
        toast(`${result.daily_watches_remaining} ad views remaining today`, {
          duration: 3000,
        });
      }
    } else {
      // Check if it's a cooldown error
      setCooldownRemaining(30);
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
      {/* Header */}
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

      {/* Boost Info */}
      {userData && userData.boost_level > 0 && (
        <BoostInfo
          boostLevel={userData.boost_level}
          multiplier={currentMultiplier}
          expiresAt={userData.boost_expires_at}
        />
      )}

      {/* Mining Button */}
      <div className="relative mb-6 flex-shrink-0">
        <motion.button
          onClick={handleStartMining}
          disabled={isMining || cooldownRemaining > 0}
          className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-gradient-to-br from-[#FF0033]/20 to-[#FF0033]/5 border-2 border-[#FF0033] flex items-center justify-center disabled:opacity-50 touch-manipulation"
          whileHover={{ scale: isMining || cooldownRemaining > 0 ? 1 : 1.05 }}
          whileTap={{ scale: isMining || cooldownRemaining > 0 ? 1 : 0.95 }}
          animate={
            isMining
              ? {
                  boxShadow: [
                    '0 0 20px rgba(255,0,51,0.5)',
                    '0 0 40px rgba(255,0,51,0.8)',
                    '0 0 20px rgba(255,0,51,0.5)',
                  ],
                }
              : {}
          }
          transition={{
            boxShadow: {
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            },
          }}
        >
          <div className="text-center px-4">
            {cooldownRemaining > 0 ? (
              <>
                <p className="text-[#FF0033]/60 uppercase tracking-widest mb-2">
                  COOLDOWN
                </p>
                <p className="text-white/60 text-xl">{cooldownRemaining}s</p>
              </>
            ) : (
              <>
                <p className="text-[#FF0033] uppercase tracking-widest mb-2">
                  {isMining ? 'MINING ACTIVE...' : 'START MINING'}
                </p>
                <p className="text-white/60 text-xs uppercase">(WATCH AD)</p>
              </>
            )}
          </div>
        </motion.button>

        {/* Progress Ring */}
        {isMining && (
          <svg className="absolute inset-0 w-56 h-56 sm:w-64 sm:h-64 -rotate-90 pointer-events-none" viewBox="0 0 256 256">
            <circle
              cx="128"
              cy="128"
              r="125"
              fill="none"
              stroke="rgba(255,0,51,0.2)"
              strokeWidth="3"
            />
            <motion.circle
              cx="128"
              cy="128"
              r="125"
              fill="none"
              stroke="#FF0033"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: miningProgress / 100 }}
              transition={{ duration: 0.1 }}
              style={{
                pathLength: miningProgress / 100,
                strokeDasharray: '785.4',
                filter: 'drop-shadow(0 0 4px rgba(255,0,51,0.8))',
              }}
            />
          </svg>
        )}
      </div>

      {/* Status Text */}
      {isMining && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[#FF0033] uppercase tracking-wide mb-6"
        >
          MINING PROGRESS: {miningProgress}%
        </motion.p>
      )}

      {/* Boost Cards */}
      <div className="w-full">
        <p className="text-white/40 uppercase text-xs tracking-wider mb-3">BOOSTS</p>
        <div className="flex flex-col gap-2">
          {boostCards.map((boost, idx) => {
            const Icon = boost.icon;
            return (
              <GlassCard key={idx} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon size={16} className="text-[#FF0033]" />
                    <div>
                      <p className="uppercase tracking-wide text-white">
                        {boost.label}
                      </p>
                      <p className="text-[10px] text-white/50 uppercase">
                        {'duration' in boost && boost.duration}
                        {'count' in boost && boost.count}
                        {!('duration' in boost) && !('count' in boost) && 'PREMIUM'}
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 bg-[#FF0033]/10 rounded text-[10px] text-[#FF0033] uppercase">
                    PREMIUM
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Partner Rewards Section */}
      <div className="w-full mt-6">
        <RewardsSection onRewardClaimed={refreshBalance} />
      </div>

      {/* Ad Modal */}
      {currentAdCreative && (
        <AdModal
          isOpen={isAdModalOpen}
          ad={currentAdCreative}
          onClose={handleAdModalClose}
          onAdCompleted={handleAdCompleted}
        />
      )}
    </div>
  );
}