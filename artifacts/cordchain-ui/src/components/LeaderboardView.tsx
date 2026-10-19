import React, { useState } from 'react';
import { Trophy, TrendingUp, Zap, ArrowUpRight, Flame, ArrowRight, ArrowLeft, Medal, Award } from 'lucide-react';
import {
  TraderLeaderboardEntry,
  ServerLeaderboardEntry,
  LeagueType,
  MainTab,
} from '../types';
import { LeagueBadge, ServerIcon, DiscordLogo } from './Icons';

interface LeaderboardViewProps {
  traders: TraderLeaderboardEntry[];
  servers: ServerLeaderboardEntry[];
  onSelectServerForTrade: (ticker: string) => void;
  onOpenBoostModal: (ticker: string) => void;
  onSelectTab: (tab: MainTab) => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  traders,
  servers,
  onSelectServerForTrade,
  onOpenBoostModal,
  onSelectTab,
}) => {
  const [activeTab, setActiveTab] = useState<'traders' | 'servers'>('traders');
  const [leagueFilter, setLeagueFilter] = useState<'All' | LeagueType>('All');
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | 'All Time'>('7d');

  const filteredServers = servers.filter((s) =>
    leagueFilter === 'All' ? true : s.league === leagueFilter
  );

  return (
    <div className="max-w-[1440px] mx-auto px-5 py-6 space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            onClick={() => onSelectTab('Dashboard')}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#71717A] hover:text-[#18181B] transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-5 h-5 text-[#8C734B]" />
            <h1 className="text-[24px] font-bold text-[#18181B] tracking-tight">Cordchain Leaderboard</h1>
          </div>
          <p className="text-[13px] text-[#71717A]">
            Top Discord communities and server stock traders ranked by boost volume, market cap, and ROI.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="bg-[#EFECE6] p-1 rounded-full flex items-center">
            <button
              onClick={() => setActiveTab('traders')}
              className={`px-5 py-1.5 rounded-full text-[12.5px] font-medium transition-all cursor-pointer ${
                activeTab === 'traders'
                  ? 'bg-white text-[#18181B] shadow-[0_1px_2px_rgba(0,0,0,0.06)] font-semibold'
                  : 'text-[#71717A] hover:text-[#18181B]'
              }`}
            >
              Top Traders
            </button>
            <button
              onClick={() => setActiveTab('servers')}
              className={`px-5 py-1.5 rounded-full text-[12.5px] font-medium transition-all cursor-pointer ${
                activeTab === 'servers'
                  ? 'bg-white text-[#18181B] shadow-[0_1px_2px_rgba(0,0,0,0.06)] font-semibold'
                  : 'text-[#71717A] hover:text-[#18181B]'
              }`}
            >
              Top Discord Servers
            </button>
          </div>

          <div className="hidden sm:flex items-center bg-white border border-[#EAE9E4] rounded-xl p-1 text-[11.5px]">
            {(['24h', '7d', '30d', 'All Time'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  timeframe === tf ? 'bg-[#18181B] text-white' : 'text-[#71717A] hover:text-[#18181B]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Your Rank Banner */}
      <div className="bg-[#FAF8F5] border border-[#EAE7DF] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#18181B] text-white flex flex-col items-center justify-center font-bold font-mono">
            <span className="text-[10px] text-[#A1A1AA] uppercase">Rank</span>
            <span className="text-[18px] leading-none">#4</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-[#18181B]">Ayush (@ayushduoking)</span>
              <span className="px-2 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] text-[10.5px] font-semibold">
                Arena Tier Trader
              </span>
            </div>
            <p className="text-[12px] text-[#71717A] mt-0.5">
              Top Asset: <span className="font-semibold text-[#18181B]">$SQUAD</span> · Total Profit:{' '}
              <span className="font-semibold text-[#10B981] font-mono">+$6,843.50</span> · ROI:{' '}
              <span className="font-semibold text-[#10B981] font-mono">+142.4%</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectTab('Exchange')}
            className="px-4 py-2 rounded-xl bg-[#18181B] text-white text-[12px] font-medium hover:bg-[#27272A] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>Trade to Rank Up</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* League Filter if in servers tab */}
      {activeTab === 'servers' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[12px] text-[#71717A] mr-1">League:</span>
          {(['All', 'Titan', 'Arena', 'Club', 'Squad'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLeagueFilter(l)}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                leagueFilter === l
                  ? 'bg-[#18181B] text-white'
                  : 'bg-white border border-[#EAE9E4] text-[#52525B] hover:bg-[#F7F6F3]'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white border border-[#EAE9E4] rounded-2xl p-6 shadow-xs overflow-x-auto">
        {activeTab === 'traders' ? (
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-[#F0EFEA] text-[11.5px] text-[#A1A1AA]">
                <th className="py-3 px-3 font-normal w-14">Rank</th>
                <th className="py-3 px-3 font-normal">Trader</th>
                <th className="py-3 px-3 font-normal">ROI ({timeframe})</th>
                <th className="py-3 px-3 font-normal">Total Profit</th>
                <th className="py-3 px-3 font-normal">Win Rate</th>
                <th className="py-3 px-3 font-normal">Top Asset</th>
                <th className="py-3 px-3 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F3EE] text-[13px]">
              {traders.map((trader) => {
                const isYou = trader.isCurrentUser;
                return (
                  <tr
                    key={trader.username}
                    className={`transition-colors ${
                      isYou ? 'bg-[#FAF8F3] font-medium' : 'hover:bg-[#FAF9F6]'
                    }`}
                  >
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-1.5 font-mono font-bold">
                        {trader.rank === 1 && <Trophy className="w-4 h-4 text-[#EAB308]" />}
                        {trader.rank === 2 && <Medal className="w-4 h-4 text-[#94A3B8]" />}
                        {trader.rank === 3 && <Award className="w-4 h-4 text-[#B45309]" />}
                        <span className="text-[#18181B] text-[13px]">#{trader.rank}</span>
                      </div>
                    </td>
                    <td className="py-4 px-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#18181B]">{trader.username}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-[#F4F3EF] text-[#71717A]">
                            {trader.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#A1A1AA] font-mono mt-0.5">{trader.discordTag}</p>
                      </div>
                    </td>
                    <td className="py-4 px-3 font-mono font-semibold text-[#10B981] tabular-nums">
                      <span className="inline-flex items-center gap-0.5">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        +{trader.roiPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-4 px-3 font-mono font-semibold text-[#18181B] tabular-nums">
                      ${trader.profitUsd.toLocaleString()}
                    </td>
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[#EAE9E4] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#10B981] rounded-full"
                            style={{ width: `${trader.winRate}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11.5px] text-[#52525B]">{trader.winRate}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-3">
                      <span className="px-2.5 py-1 rounded-lg bg-[#EFECE6] text-[#18181B] text-[11.5px] font-semibold">
                        {trader.topAsset}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-right">
                      <button
                        onClick={() => {
                          const tickerClean = trader.topAsset.replace('$', '').toLowerCase();
                          onSelectServerForTrade(tickerClean);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-[#E4E3DE] hover:bg-white text-[11.5px] font-medium text-[#18181B] cursor-pointer"
                      >
                        Trade {trader.topAsset}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-[#F0EFEA] text-[11.5px] text-[#A1A1AA]">
                <th className="py-3 px-3 font-normal w-14">Rank</th>
                <th className="py-3 px-3 font-normal">Discord Server</th>
                <th className="py-3 px-3 font-normal">League</th>
                <th className="py-3 px-3 font-normal">Market Cap</th>
                <th className="py-3 px-3 font-normal">Boost Power</th>
                <th className="py-3 px-3 font-normal">Dividend Yield</th>
                <th className="py-3 px-3 font-normal">7d Change</th>
                <th className="py-3 px-3 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F3EE] text-[13px]">
              {filteredServers.map((srv) => (
                <tr key={srv.ticker} className="hover:bg-[#FAF9F6] transition-colors">
                  <td className="py-4 px-3">
                    <span className="font-mono font-bold text-[#18181B]">#{srv.rank}</span>
                  </td>
                  <td className="py-4 px-3">
                    <div className="flex items-center gap-3">
                      <ServerIcon id={srv.ticker.replace('$', '').toLowerCase()} variant="table" />
                      <div>
                        <p className="font-semibold text-[#18181B] text-[13px]">{srv.ticker}</p>
                        <p className="text-[11px] text-[#A1A1AA]">{srv.name} · {srv.members}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-3">
                    <LeagueBadge league={srv.league} />
                  </td>
                  <td className="py-4 px-3 font-mono font-semibold text-[#18181B] tabular-nums">
                    {srv.marketCapUsd}
                  </td>
                  <td className="py-4 px-3">
                    <span className="font-mono font-semibold text-[#18181B] inline-flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-[#EAB308]" />
                      {srv.boostPower.toLocaleString()} pts
                    </span>
                  </td>
                  <td className="py-4 px-3 font-mono text-[#10B981] font-semibold tabular-nums">
                    {srv.dividendYield}
                  </td>
                  <td className="py-4 px-3 font-mono font-semibold text-[#10B981] tabular-nums">
                    +{srv.change7d.toFixed(1)}%
                  </td>
                  <td className="py-4 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onOpenBoostModal(srv.ticker.replace('$', '').toLowerCase())}
                        className="px-2.5 py-1.5 rounded-lg bg-[#EFECE6] hover:bg-[#E5E2DC] text-[11px] font-semibold text-[#18181B] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Zap className="w-3 h-3 text-[#EAB308]" />
                        <span>Boost</span>
                      </button>
                      <button
                        onClick={() => onSelectServerForTrade(srv.ticker.replace('$', '').toLowerCase())}
                        className="px-3 py-1.5 rounded-lg border border-[#E4E3DE] hover:bg-white text-[11px] font-medium text-[#18181B] cursor-pointer"
                      >
                        Trade
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
