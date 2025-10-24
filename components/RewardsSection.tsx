import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { GlassCard } from './GlassCard';
import { Gift, ExternalLink, Check } from 'lucide-react';
import { toast } from 'sonner';
import { getActivePartners, platformConfig, type PartnerReward } from '../config/partners';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import type { ClaimRewardResponse, RewardStatusResponse } from '../types';
import { hapticFeedback } from '../utils/telegram';

interface RewardsSectionProps {
  onRewardClaimed?: () => void;
}

export function RewardsSection({ onRewardClaimed }: RewardsSectionProps) {
  const { invokeEdgeFunction, claimPartnerReward } = useApi();
  const { user } = useAuth();
  const [claimedPartners, setClaimedPartners] = useState<string[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activePartners = getActivePartners();

  useEffect(() => {
    let isActive = true;

    const loadRewardStatus = async () => {
      if (!user) {
        if (isActive) {
          setClaimedPartners([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const response = await invokeEdgeFunction<RewardStatusResponse>('/rewards/status', { method: 'GET' });

        if (response && isActive) {
          setClaimedPartners(response.claimed_partners);
        }
      } catch (error) {
        console.error('Failed to load reward status:', error);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadRewardStatus();

    return () => {
      isActive = false;
    };
  }, [user, invokeEdgeFunction]);

  async function handleClaimReward(partner: PartnerReward) {
    if (claimedPartners.includes(partner.id) || claiming || !user) return;

    window.open(partner.url, '_blank');
    hapticFeedback('impact', 'medium');

    setTimeout(async () => {
      setClaiming(partner.id);

      try {
        const response = await claimPartnerReward<ClaimRewardResponse>({
          partner_id: partner.id,
          wallet_address: user.address,
        });

        if (response?.success) {
          setClaimedPartners(prev => [...prev, partner.id]);
          toast.success(`🎉 ${response.reward} 🆑 earned!`, {
            description: `Thanks for subscribing to ${response.partner_name}!`,
          });
          hapticFeedback('notification', 'success');

          if (onRewardClaimed) {
            onRewardClaimed();
          }
        } else {
          toast.error('Failed to claim reward');
          hapticFeedback('notification', 'error');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to claim reward';
        toast.error(message);
        hapticFeedback('notification', 'error');
      } finally {
        setClaiming(null);
      }
    }, 1000);
  }

  if (loading) {
    return (
      <div className="w-full">
        <p className="text-white/40 uppercase text-xs tracking-wider mb-3">
          REWARDS
        </p>
        <GlassCard className="px-4 py-8">
          <p className="text-white/40 text-center text-xs uppercase">Loading...</p>
        </GlassCard>
      </div>
    );
  }

  if (activePartners.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <Gift size={14} className="text-[#FF0033]" />
        <p className="text-white/40 uppercase text-xs tracking-wider">
          PARTNER REWARDS
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {activePartners.map((partner) => {
          const isClaimed = claimedPartners.includes(partner.id);
          const isClaiming = claiming === partner.id;
          const platformInfo = platformConfig[partner.platform];

          return (
            <GlassCard key={partner.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {partner.icon && (
                      <span className="text-sm">{partner.icon}</span>
                    )}
                    <p className="uppercase tracking-wide text-white text-sm truncate">
                      {partner.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-white/50 uppercase">
                      {platformInfo.icon} {platformInfo.name}
                    </p>
                    {!isClaimed && (
                      <>
                        <span className="text-white/30">•</span>
                        <p className="text-[10px] text-[#FF0033] uppercase">
                          +{partner.reward} 🆑
                        </p>
                      </>
                    )}
                  </div>
                  {partner.description && (
                    <p className="text-[9px] text-white/40 mt-1 line-clamp-1">
                      {partner.description}
                    </p>
                  )}
                </div>

                <motion.button
                  onClick={() => handleClaimReward(partner)}
                  disabled={isClaimed || isClaiming}
                  className={`
                    flex-shrink-0 px-3 py-1.5 rounded text-[10px] uppercase tracking-wide
                    transition-colors touch-manipulation
                    ${
                      isClaimed
                        ? 'bg-white/10 text-white/40'
                        : 'bg-[#FF0033]/10 text-[#FF0033] active:bg-[#FF0033]/20'
                    }
                    disabled:opacity-50
                    flex items-center gap-2
                  `}
                >
                  {isClaimed ? <Check size={12} /> : <ExternalLink size={12} />}
                  <span>{isClaimed ? 'Claimed' : isClaiming ? 'Claiming...' : 'Claim'}</span>
                </motion.button>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
