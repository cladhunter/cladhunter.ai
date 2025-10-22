import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift } from 'lucide-react';
import { AdCreative, adConfig } from '../config/ads';
import { hapticFeedback, openExternalLink } from '../utils/telegram';

interface AdModalProps {
  isOpen: boolean;
  ad: AdCreative;
  onClose: () => void;
  onAdCompleted: () => void;
}

export function AdModal({ isOpen, ad, onClose, onAdCompleted }: AdModalProps) {
  const [claimEnabled, setClaimEnabled] = useState(false);
  const [countdown, setCountdown] = useState(adConfig.skipDelay);
  const [viewStartTime] = useState(Date.now());
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setClaimEnabled(false);
      setCountdown(adConfig.skipDelay);
      return;
    }

    // Countdown timer for claim button
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setClaimEnabled(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const handleClaim = () => {
    const viewDuration = (Date.now() - viewStartTime) / 1000;
    
    // Only proceed if minimum view duration is met
    if (viewDuration < adConfig.minViewDuration) {
      return;
    }

    // Haptic feedback on claim
    hapticFeedback('notification', 'success');

    // Open partner URL in new tab (Telegram-aware)
    openExternalLink(ad.partnerUrl);
    
    // Complete ad watch and close
    onAdCompleted();
    onClose();
  };

  const handleVideoEnded = () => {
    // Enable claim button when video ends
    setClaimEnabled(true);
    
    // Haptic feedback when video ends
    hapticFeedback('notification', 'success');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex flex-col bg-black"
          style={{
            touchAction: 'none',
            height: '100vh',
            minHeight: '100dvh', // Dynamic viewport height for mobile browsers
          }}
        >
          {/* Ad Creative Container - Full screen optimized for mobile */}
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {ad.type === 'video' ? (
              <video
                ref={videoRef}
                src={ad.url}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted={false}
                onEnded={handleVideoEnded}
                style={{
                  aspectRatio: '9/16',
                  maxHeight: '100dvh',
                }}
              />
            ) : (
              <img
                src={ad.url}
                alt="Advertisement"
                className="w-full h-full object-cover"
                style={{
                  aspectRatio: '9/16',
                  maxHeight: '100dvh',
                }}
              />
            )}

            {/* Dark gradient overlay for better button visibility */}
            <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

            {/* Partner Name Badge - Mobile optimized */}
            {ad.partnerName && (
              <div 
                className="absolute bg-black/70 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1.5"
                style={{
                  top: 'max(env(safe-area-inset-top, 0px) + 12px, 12px)',
                  left: '12px',
                }}
              >
                <p className="text-white/90 text-[10px] uppercase tracking-wider">
                  {ad.partnerName}
                </p>
              </div>
            )}

            {/* Progress bar for videos - Mobile optimized */}
            {ad.type === 'video' && (
              <div 
                className="absolute left-0 right-0 h-0.5 bg-white/20"
                style={{
                  bottom: claimEnabled ? '116px' : '80px', // Above button area
                }}
              >
                <motion.div
                  className="h-full bg-[#FF0033]"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{
                    duration: ad.duration || 15,
                    ease: 'linear',
                  }}
                />
              </div>
            )}

            {/* Claim Button Area - Fixed at bottom with safe area */}
            <div 
              className="absolute inset-x-0 bottom-0 px-4"
              style={{
                paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 16px, 16px)',
              }}
            >
              {/* Claim Button */}
              <motion.button
                initial={{ y: 100, opacity: 0 }}
                animate={
                  claimEnabled
                    ? { y: 0, opacity: 1 }
                    : { y: 100, opacity: 0 }
                }
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                onClick={handleClaim}
                disabled={!claimEnabled}
                className="w-full bg-gradient-to-r from-[#FF0033] to-[#FF3355] text-white py-3.5 rounded-2xl flex items-center justify-center gap-2.5 disabled:opacity-0 disabled:pointer-events-none uppercase tracking-widest shadow-2xl shadow-[#FF0033]/60 active:scale-[0.98] transition-transform"
                style={{
                  minHeight: '56px', // iOS minimum touch target
                }}
              >
                <Gift size={22} className="flex-shrink-0" />
                <span className="text-base">Claim Reward</span>
              </motion.button>

              {/* Countdown indicator - Mobile optimized */}
              {!claimEnabled && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full text-center"
                  style={{ marginTop: '12px' }}
                >
                  <p className="text-white/70 uppercase tracking-wider text-xs">
                    Watch for {countdown}s...
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
