import { useTonConnect } from '../hooks/useTonConnect';
import { Button } from './ui/button';
import { Wallet, LogOut, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner@2.0.3';

export function TonConnectButton() {
  const { wallet, isConnecting, connect, disconnect, isConnected } = useTonConnect();
  const [copied, setCopied] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleCopyAddress = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      toast.success('Address copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isConnected && wallet) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white/5 rounded-lg px-3 py-2.5 border border-white/10">
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Connected</p>
            <p className="text-white text-sm font-mono">{formatAddress(wallet.address)}</p>
          </div>
          <Button
            onClick={handleCopyAddress}
            variant="ghost"
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white h-[54px] px-3"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </Button>
          <Button
            onClick={disconnect}
            variant="ghost"
            size="sm"
            className="bg-[#FF0033]/20 hover:bg-[#FF0033]/30 text-[#FF0033] h-[54px] px-3"
          >
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      onClick={connect}
      disabled={isConnecting}
      className="w-full bg-[#0098EA] hover:bg-[#0098EA]/80 text-white uppercase tracking-wider min-h-[48px] touch-manipulation"
    >
      <Wallet size={16} className="mr-2" />
      {isConnecting ? 'Connecting...' : 'Connect TON Wallet'}
    </Button>
  );
}