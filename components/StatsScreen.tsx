import { useState, useEffect } from 'react';
import { GlassCard } from './GlassCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Button } from './ui/button';
import { TrendingUp, Clock, Award } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';

interface StatsResponse {
  total_energy: number;
  total_watches: number;
  total_earned: number;
  today_watches: number;
  daily_limit: number;
  boost_level: number;
  multiplier: number;
  boost_expires_at: string | null;
}

const chartData = [
  { day: 'Mon', cl: 12.5 },
  { day: 'Tue', cl: 18.2 },
  { day: 'Wed', cl: 15.8 },
  { day: 'Thu', cl: 22.4 },
  { day: 'Fri', cl: 19.6 },
  { day: 'Sat', cl: 25.1 },
  { day: 'Sun', cl: 21.3 },
];

const miningHistory = [
  { amount: '+0.5', time: '13:42', adId: '0214', boost: false },
  { amount: '+1.0', time: '13:28', adId: '0213', boost: true },
  { amount: '+0.5', time: '12:55', adId: '0212', boost: false },
  { amount: '+0.5', time: '12:14', adId: '0211', boost: false },
  { amount: '+0.5', time: '11:38', adId: '0210', boost: false },
  { amount: '+1.0', time: '11:02', adId: '0209', boost: true },
];

export function StatsScreen() {
  const { user } = useAuth();
  const { makeRequest } = useApi();
  const [stats, setStats] = useState<StatsResponse | null>(null);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    const data = await makeRequest<StatsResponse>('/stats', { method: 'GET' }, user.accessToken, user.id);
    if (data) {
      setStats(data);
    }
  };

  const totalMined = stats?.total_earned || 0;
  const totalWatches = stats?.total_watches || 0;
  const todayWatches = stats?.today_watches || 0;
  const dailyLimit = stats?.daily_limit || 200;
  const avgPerAd = totalWatches > 0 ? totalMined / totalWatches : 0;

  return (
    <div className="px-4 pt-6 pb-24 min-h-screen">
      {/* Header */}
      <h1 className="text-xl tracking-wider mb-5 text-[#FF0033] uppercase text-center">
        MINING STATS
      </h1>

      {/* Total Mined Card */}
      <GlassCard className="p-5 mb-5 text-center" glowEffect>
        <p className="text-white/60 text-xs uppercase tracking-wider mb-2">TOTAL MINED</p>
        <p className="text-3xl sm:text-4xl text-[#FF0033]">{totalMined.toFixed(1)} 🆑</p>
        <p className="text-white/40 text-xs mt-2">
          {todayWatches}/{dailyLimit} ads watched today
        </p>
      </GlassCard>

      {/* Chart */}
      <GlassCard className="p-3 mb-5 overflow-hidden">
        <p className="text-white/80 text-xs uppercase tracking-wider mb-3">CL/DAY (7-DAY VIEW)</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="day" 
              stroke="rgba(255,255,255,0.4)"
              tick={{ fontSize: 10 }}
            />
            <YAxis 
              stroke="rgba(255,255,255,0.4)"
              tick={{ fontSize: 10 }}
            />
            <Line
              type="monotone"
              dataKey="cl"
              stroke="#FF0033"
              strokeWidth={2}
              dot={{ fill: '#FF0033', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* Metric Cards */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <GlassCard className="p-2.5 text-center">
          <Clock size={14} className="text-[#FF0033] mx-auto mb-1.5" />
          <p className="text-[10px] uppercase text-white/60 mb-1">SESSIONS</p>
          <p className="text-white">{totalWatches}</p>
        </GlassCard>
        <GlassCard className="p-2.5 text-center">
          <Award size={14} className="text-[#FF0033] mx-auto mb-1.5" />
          <p className="text-[10px] uppercase text-white/60 mb-1">AVG</p>
          <p className="text-white">{avgPerAd.toFixed(1)} 🆑</p>
        </GlassCard>
        <GlassCard className="p-2.5 text-center">
          <TrendingUp size={14} className="text-[#FF0033] mx-auto mb-1.5" />
          <p className="text-[10px] uppercase text-white/60 mb-1">MULT</p>
          <p className="text-white">x{stats?.multiplier || 1}</p>
        </GlassCard>
      </div>

      {/* Mining History */}
      <div className="mb-4">
        <p className="text-white/60 text-xs uppercase tracking-wider mb-3">MINING SESSIONS</p>
        <div className="space-y-2 max-h-[240px] overflow-y-auto">
          {miningHistory.map((session, idx) => (
            <GlassCard key={idx} className="p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[#FF0033]">{session.amount} 🆑</span>
                  <span className="text-white/40 text-xs">{session.time}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white/60 text-xs">#{session.adId}</p>
                  <p className="text-[#FF0033] text-[10px] uppercase">
                    {session.boost ? 'X2' : 'OK'}
                  </p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* CTA Button */}
      <Button className="w-full bg-[#FF0033] hover:bg-[#FF0033]/80 text-white uppercase tracking-wider min-h-[48px] touch-manipulation">
        GET MORE ADS TODAY
      </Button>
    </div>
  );
}