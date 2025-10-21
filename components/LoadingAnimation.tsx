import { motion } from 'motion/react';

export function LoadingAnimation() {
  return (
    <div className="flex items-center justify-center">
      <motion.div
        animate={{
          rotate: 360,
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "linear",
        }}
        className="relative w-16 h-16"
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#FF0033] to-[#FF0033]/20 blur-sm" />
        <div className="absolute inset-2 rounded-full bg-[#0A0A0A] flex items-center justify-center">
          <span className="text-2xl">🆑</span>
        </div>
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-0 rounded-full border-2 border-[#FF0033]"
        />
      </motion.div>
    </div>
  );
}
