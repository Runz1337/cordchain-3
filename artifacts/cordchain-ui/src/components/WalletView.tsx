import React, { useState } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Scissors,
  Gamepad2,
  ExternalLink,
  Sparkles,
  Lock,
  Unlock,
  Coins,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { ActivityItem, ServerAsset, MainTab } from '../types';
import { ServerIcon, LeagueBadge } from './Icons';
import type { ApiWalletSummary } from '../lib/api';
import { toNum, claimDailyAllowance } from '../lib/api';

const fmtCred = (n: number): string =>
  n > 0 && n < 10 ? `${n.toFixed(5)} $CRED` : `${n.toFixed(2)} $CRED`;

interface WalletViewProps {
  credBalance: number;
  inrBalance?: number;
  servers: ServerAsset[];
  activities: ActivityItem[];
  wallet?: ApiWalletSummary | null;
  onSelectTab: (tab: MainTab) => void;
  onSelectServerForTrade: (serverId: string) => void;
  onOpenWithdrawModal?: () => void;
  onOpenVideoModal?: () => void;
  onOpenAdModal?: () => void;
  userId?: string;
  onTriggerToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRefreshWallet?: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({
  credBalance,
  servers,
  activities,
  wallet,
  onSelectTab,
  onSelectServerForTrade,
  userId = '750015265135263835',
  onTriggerToast,
  onRefreshWallet,
}) => {
  const [claimingAllowance, setClaimingAllowance] = useState(false);
  const [claimedToday, setClaimedToday] = useState(false);

  const handleClaimBonus = async () => {
    setClaimingAllowance(true);
    try {
      const res = await claimDailyAllowance(userId);
      setClaimedToday(true);
      if (onTriggerToast) {
        onTriggerToast(`+${res.credAwarded} $CRED daily allowance claimed! Settled on CordLedger.`, 'success');
      }
      onRefreshWallet?.();
    } catch (err: any) {
      if (onTriggerToast) {
        onTriggerToast(err.message || 'Daily allowance already claimed for today.', 'info');
      }
      setClaimedToday(true);
    } finally {
      setClaimingAllowance(false);
    }
  };

  const totalPortfolioValue =
    credBalance +
    (wallet
      ? toNum(wallet.wallets.portfolioStockValueCred)
      : servers.reduce((acc, s) => acc + (s.holdings ?? 0) * s.priceUsd, 0));

  const creatorVestingEntries = wallet?.creatorVesting ? Object.entries(wallet.creatorVesting) : [];

  return (
    <div className="max-w-[1440px] mx-auto px-5 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-[22px] font-bold text-[#18181B]">
              $CRED Fantasy Vault & Portfolio
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[11px] font-semibold border border-[#A7F3D0]">
              CordLedger Verified
            </span>
          </div>
          <p className="text-[13px] text-[#71717A]">
            Single-currency fantasy market. Transparent append-only ledger · 0 gas fees · No wallet friction.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onSelectTab('CordScan')}
            className="bg-white hover:bg-[#F5F4F0] text-[#18181B] border border-[#E4E3DE] text-[12.5px] font-medium px-4 py-2 rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <ShieldCheck className="w-4 h-4 text-[#059669]" />
            <span>Open CordScan</span>
          </button>
          <button
            onClick={() => onSelectTab('Exchange')}
            className="bg-[#18181B] hover:bg-[#27272A] text-white text-[12.5px] font-medium px-4 py-2 rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Coins className="w-4 h-4" />
            <span>Trade Markets</span>
          </button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Liquid CRED */}
        <div className="bg-[#F2F9F5] border border-[#DFEFE5] rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold text-[#15803D] uppercase tracking-wider font-mono">
                Liquid Balance
              </p>
              <Coins className="w-4 h-4 text-[#15803D]" />
            </div>
            <p className="text-[34px] font-bold text-[#18181B] tabular-nums mt-2">
              {credBalance.toLocaleString()}{' '}
              <span className="text-[18px] font-medium text-[#71717A]">$CRED</span>
            </p>
            <p className="text-[12px] text-[#52525B] mt-1">
              Initial 1,000 $CRED starter allowance granted upon signup.
            </p>
          </div>

          <div className="pt-4 mt-2 border-t border-[#D5E6DC] flex items-center justify-between">
            <button
              onClick={handleClaimBonus}
              disabled={claimingAllowance || claimedToday}
              className={`px-3.5 py-1.5 rounded-xl text-[12px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                claimedToday
                  ? 'bg-[#E2E8F0] text-[#64748B] cursor-not-allowed'
                  : 'bg-[#15803D] hover:bg-[#166534] text-white shadow-xs'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{claimedToday ? 'Daily Bonus Claimed' : 'Claim Daily Bonus (+50)'}</span>
            </button>
            <span className="text-[11px] text-[#15803D] font-mono font-medium">
              Cap: 250/day
            </span>
          </div>
        </div>

        {/* Card 2: Net Worth */}
        <div className="bg-white border border-[#EAE9E4] rounded-2xl p-6 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold text-[#71717A] uppercase tracking-wider font-mono">
                Total Portfolio Net Worth
              </p>
              <Wallet className="w-4 h-4 text-[#71717A]" />
            </div>
            <p className="text-[34px] font-bold text-[#18181B] tabular-nums mt-2">
              {totalPortfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
              <span className="text-[18px] font-medium text-[#71717A]">$CRED</span>
            </p>
            <p className="text-[12px] text-[#71717A] mt-1">
              Liquid funds + holdings valued at live AMM pool mark.
            </p>
          </div>

          <div className="pt-4 mt-2 border-t border-[#F0EFEA] flex items-center justify-between text-[11.5px] text-[#71717A]">
            <span>Position Limit: Max 10% (100k shares)</span>
            <span className="font-semibold text-[#18181B]">Circuit Breaker: 20%</span>
          </div>
        </div>

        {/* Card 3: Fair Value & Community Earnings */}
        <div className="bg-white border border-[#EAE9E4] rounded-2xl p-6 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold text-[#71717A] uppercase tracking-wider font-mono">
                Weekly Community Earnings
              </p>
              <ShieldCheck className="w-4 h-4 text-[#059669]" />
            </div>
            <p className="text-[15px] font-bold text-[#18181B] mt-2">
              Engagement Fundamentals
            </p>
            <p className="text-[12px] text-[#52525B] mt-1">
              Weekly server reports convert bot-resistant Community Scores into fantasy $CRED dividends for shareholders.
            </p>
          </div>

          <div className="pt-4 mt-2 border-t border-[#F0EFEA] flex items-center justify-between">
            <button
              onClick={() => onSelectTab('CordScan')}
              className="text-[12px] text-[#059669] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Inspect Weekly Ledger Payouts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Creator Reserve & Vesting Tracker (if user has vested allocations) */}
      {creatorVestingEntries.length > 0 && (
        <div className="bg-[#FAF9F6] border border-[#EAE9E4] rounded-2xl p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#8B5CF6]" />
              <h2 className="text-[15px] font-bold text-[#18181B]">
                Creator Reserve Vesting Tracker
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#71717A]">
              Ledger-Enforced 5% Monthly Unlock
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {creatorVestingEntries.map(([gid, v]) => (
              <div key={gid} className="bg-white border border-[#EAE9E4] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#18181B] font-mono">Server {gid.slice(0, 6)}...</span>
                  <span className="text-[11px] text-[#059669] font-bold font-mono">
                    {((v.vested / (v.total || 1)) * 100).toFixed(0)}% Vested
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    className="h-full bg-[#10B981]"
                    style={{ width: `${(v.vested / (v.total || 1)) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#71717A] font-mono">
                  <span>Vested: {v.vested.toLocaleString()}</span>
                  <span>Locked: {v.locked.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Section: Holdings & Transaction History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-white border border-[#EAE9E4] rounded-2xl p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15.5px] font-semibold text-[#18181B]">
              Your Stock Portfolio ({wallet ? wallet.holdings.length : servers.filter((s) => (s.holdings ?? 0) > 0).length})
            </h2>
            <button
              onClick={() => onSelectTab('Exchange')}
              className="text-[12px] text-[#71717A] hover:text-[#18181B] inline-flex items-center gap-1 cursor-pointer font-medium"
            >
              <span>Explore All Listings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#F0EFEA] text-[11.5px] text-[#A1A1AA] font-mono uppercase">
                  <th className="py-2.5 font-normal">Server Stock</th>
                  <th className="py-2.5 font-normal">League</th>
                  <th className="py-2.5 font-normal">Shares Owned</th>
                  <th className="py-2.5 font-normal">Avg. Buy</th>
                  <th className="py-2.5 font-normal">Pool Spot</th>
                  <th className="py-2.5 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F3EE] text-[13px]">
                {wallet && wallet.holdings.length > 0 ? (
                  wallet.holdings.map((h) => {
                    const srv = servers.find((s) => s.id === h.guildId);
                    const cur = toNum(h.currentPrice);
                    const avg = toNum(h.avgBuyPrice);
                    const pnl = toNum(h.unrealizedPnlCred);

                    return (
                      <tr key={h.guildId} className="hover:bg-[#FAF9F6] transition-colors">
                        <td className="py-3.5">
                          <div className="flex items-center gap-3">
                            <ServerIcon id={srv?.id ?? h.ticker} variant="table" />
                            <div>
                              <p className="font-semibold text-[#18181B]">{h.ticker}</p>
                              <p className="text-[11px] text-[#A1A1AA]">{h.serverName}</p>
                              <button
                                onClick={() => onSelectTab('CordScan')}
                                className="text-[10px] text-[#059669] hover:underline inline-flex items-center gap-0.5 mt-0.5 font-mono cursor-pointer"
                              >
                                <span>CordScan Receipt</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5">{srv && <LeagueBadge league={srv.league} />}</td>
                        <td className="py-3.5 font-mono font-semibold text-[#18181B] tabular-nums">
                          {h.shares.toLocaleString()}
                        </td>
                        <td className="py-3.5 font-mono tabular-nums text-[#52525B]">
                          {avg.toFixed(4)} $CRED
                        </td>
                        <td className="py-3.5 font-mono tabular-nums font-semibold text-[#18181B]">
                          {cur.toFixed(4)} $CRED
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => onSelectServerForTrade(h.guildId)}
                            className="px-3 py-1.5 rounded-lg border border-[#E4E3DE] hover:bg-[#F5F4F0] text-[12px] font-semibold text-[#18181B] cursor-pointer"
                          >
                            Trade
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  servers
                    .filter((s) => (s.holdings ?? 0) > 0)
                    .map((srv) => (
                      <tr key={srv.id} className="hover:bg-[#FAF9F6] transition-colors">
                        <td className="py-3.5">
                          <div className="flex items-center gap-3">
                            <ServerIcon id={srv.id} variant="table" />
                            <div>
                              <p className="font-semibold text-[#18181B]">{srv.ticker}</p>
                              <p className="text-[11px] text-[#A1A1AA]">{srv.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5">
                          <LeagueBadge league={srv.league} />
                        </td>
                        <td className="py-3.5 font-mono font-semibold text-[#18181B] tabular-nums">
                          {(srv.holdings ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 font-mono tabular-nums text-[#52525B]">
                          {fmtCred(srv.avgBuyPriceUsd ?? srv.priceUsd * 0.92)}
                        </td>
                        <td className="py-3.5 font-mono tabular-nums font-semibold text-[#18181B]">
                          {fmtCred(srv.priceUsd)}
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => onSelectServerForTrade(srv.id)}
                            className="px-3 py-1.5 rounded-lg border border-[#E4E3DE] hover:bg-[#F5F4F0] text-[12px] font-semibold text-[#18181B] cursor-pointer"
                          >
                            Trade
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction History */}
        <div className="lg:col-span-4 bg-white border border-[#EAE9E4] rounded-2xl p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15.5px] font-semibold text-[#18181B]">Ledger Fills</h2>
            <button
              onClick={() => onSelectTab('CordScan')}
              className="text-[11.5px] text-[#059669] hover:underline font-mono font-semibold cursor-pointer"
            >
              Verify Hashes
            </button>
          </div>
          <div className="divide-y divide-[#F5F4F0]">
            {activities.slice(0, 7).map((item) => {
              const iconMap = {
                boost: <ShieldCheck className="w-4 h-4 text-[#10B981]" />,
                buy: <Scissors className="w-4 h-4 text-[#EF4444]" />,
                sell: <Gamepad2 className="w-4 h-4 text-[#EC4899]" />,
                ad: <Sparkles className="w-4 h-4 text-[#52525B]" />,
                withdraw: <Coins className="w-4 h-4 text-[#52525B]" />,
              };
              return (
                <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#F5F4F0] flex items-center justify-center shrink-0">
                      {iconMap[item.type] || <Coins className="w-4 h-4 text-[#10B981]" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium text-[#18181B] truncate">{item.title}</p>
                      <p
                        className={`text-[11.5px] font-medium tabular-nums ${
                          item.isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'
                        }`}
                      >
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#A1A1AA] shrink-0 font-mono">{item.timeAgo}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
