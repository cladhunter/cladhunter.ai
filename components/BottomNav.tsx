import { BarChart3, Pickaxe, Wallet } from 'lucide-react';

interface BottomNavProps {
  activeScreen: 'mining' | 'stats' | 'wallet';
  onNavigate: (screen: 'mining' | 'stats' | 'wallet') => void;
}

export function BottomNav({ activeScreen, onNavigate }: BottomNavProps) {
  const navItems = [
    { id: 'stats' as const, icon: BarChart3, label: 'STATS' },
    { id: 'mining' as const, icon: Pickaxe, label: 'MINING' },
    { id: 'wallet' as const, icon: Wallet, label: 'WALLET' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/10 pb-safe z-50">
      <div className="flex justify-around items-center px-4 py-3 w-full mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center gap-1 transition-all min-w-[60px] min-h-[48px] justify-center touch-manipulation ${
                isActive ? 'text-[#FF0033]' : 'text-white/40'
              }`}
            >
              <Icon
                size={22}
                className={isActive ? 'drop-shadow-[0_0_8px_rgba(255,0,51,0.8)]' : ''}
              />
              <span className="text-[9px] tracking-wider uppercase">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
