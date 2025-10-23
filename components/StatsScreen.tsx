import { useState, useEffect } from 'react';
import { GlassCard } from './GlassCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Button } from './ui/button';
import { TrendingUp, Clock, Award, Activity, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import type { UserStatsResponse } from '../types';

export function StatsScreen() {
  const { user } = useAuth();
  const { makeRequest } = useApi();
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const loadStats = async () => {
      if (!user) {
        if (isActive) {
          setStats(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const data = await makeRequest<UserStatsResponse>(
        '/stats',
        { method: 'GET' },
        user.accessToken,
        user.id
      );

      if (data && isActive) {
        setStats(data);
      }

      if (isActive) {
        setLoading(false);
      }
    };

    loadStats();

    return () => {
      isActive = false;
    };
  }, [user, makeRequest]);

  const totalMined = stats?.total_earned || 0;
  const totalWatches = stats?.total_watches || 0;
  const totalSessions = stats?.total_sessions || 0;
  const todayWatches = stats?.today_watches || 0;
  const dailyLimit = stats?.daily_limit || 200;
  const avgPerAd = totalWatches > 0 ? totalMined / totalWatches : 0;

  // Helper function to format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Helper function to format ad ID
  const formatAdId = (adId: string) => {
    // Extract last 4 characters or use full if shorter
    return adId.slice(-4).toUpperCase();
  };

  if (loading) {
    return (
      <div className="px-4 pt-6 pb-24 min-h-screen flex items-center justify-center">
        <p className="text-white/60 text-xs uppercase tracking-wider">Loading stats...</p>
      </div>
    );
  }

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

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <GlassCard className="p-3 text-center">
          <Activity size={16} className="text-[#FF0033] mx-auto mb-2" />
          <p className="text-[10px] uppercase text-white/60 mb-1">SESSIONS</p>
          <p className="text-white text-lg">{totalSessions}</p>
          <p className="text-white/40 text-[9px] mt-1">Total logins</p>
        </GlassCard>
        
        <GlassCard className="p-3 text-center">
          <Zap size={16} className="text-[#FF0033] mx-auto mb-2" />
          <p className="text-[10px] uppercase text-white/60 mb-1">ADS VIEWED</p>
          <p className="text-white text-lg">{totalWatches}</p>
          <p className="text-white/40 text-[9px] mt-1">All time</p>
        </GlassCard>

        <GlassCard className="p-3 text-center">
          <Award size={16} className="text-[#FF0033] mx-auto mb-2" />
          <p className="text-[10px] uppercase text-white/60 mb-1">AVG REWARD</p>
          <p className="text-white text-lg">{avgPerAd.toFixed(1)} 🆑</p>
          <p className="text-white/40 text-[9px] mt-1">Per ad</p>
        </GlassCard>
        
        <GlassCard className="p-3 text-center">
          <TrendingUp size={16} className="text-[#FF0033] mx-auto mb-2" />
          <p className="text-[10px] uppercase text-white/60 mb-1">MULTIPLIER</p>
          <p className="text-white text-lg">x{stats?.multiplier || 1}</p>
          <p className="text-white/40 text-[9px] mt-1">Current boost</p>
        </GlassCard>
      </div>

      {/* Mining History */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white/60 text-xs uppercase tracking-wider">RECENT ACTIVITY</p>
          <Clock size={12} className="text-white/40" />
        </div>
        
        {stats?.watch_history && stats.watch_history.length > 0 ? (
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {stats.watch_history.map((session, idx) => (
              <GlassCard key={idx} className="p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[#FF0033]">+{session.reward} 🆑</span>
                    <span className="text-white/40 text-xs">{formatTime(session.created_at)}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white/60 text-xs">#{formatAdId(session.ad_id)}</p>
                    <p className="text-[#FF0033] text-[10px] uppercase">
                      {session.multiplier > 1 ? `X${session.multiplier}` : 'BASE'}
                    </p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <GlassCard className="p-8 text-center">
            <Zap size={24} className="text-white/20 mx-auto mb-2" />
            <p className="text-white/40 text-xs uppercase">No activity yet</p>
            <p className="text-white/30 text-[10px] mt-1">Watch ads to see your history</p>
          </GlassCard>
        )}
      </div>

      {/* CTA Button */}
      <Button 
        onClick={() => window.location.hash = '#mining'}
        className="w-full bg-[#FF0033] hover:bg-[#FF0033]/80 text-white uppercase tracking-wider min-h-[48px] touch-manipulation"
      >
        START MINING NOW
      </Button>
    </div>
  );
}
