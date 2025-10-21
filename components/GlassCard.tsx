import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glowEffect?: boolean;
}

export function GlassCard({ children, className = '', glowEffect = false }: GlassCardProps) {
  return (
    <div
      className={`relative rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 ${
        glowEffect ? 'shadow-[0_0_20px_rgba(255,0,51,0.3)]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
