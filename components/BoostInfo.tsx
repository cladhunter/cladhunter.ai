import { GlassCard } from './GlassCard';
import { Zap } from 'lucide-react';

interface BoostInfoProps {
  boostLevel: number;
  multiplier: number;
  expiresAt: string | null;
}

export function BoostInfo({ boostLevel, multiplier, expiresAt }: BoostInfoProps) {
  if (boostLevel === 0) return null;

  const getTimeRemaining = (expiresAt: string | null): string => {
    if (!expiresAt) return '';
    
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'EXPIRED';
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days}D ${hours}H`;
    } else {
      return `${hours}H`;
    }
  };

  const timeRemaining = getTimeRemaining(expiresAt);

  return (
    <GlassCard className="px-3 py-2 mb-4 border border-[#FF0033]/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-[#FF0033]" />
          <div>
            <p className="text-xs uppercase text-[#FF0033] tracking-wide">
              BOOST ACTIVE: x{multiplier}
            </p>
            {timeRemaining && (
              <p className="text-[10px] text-white/50 uppercase">
                {timeRemaining} REMAINING
              </p>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
