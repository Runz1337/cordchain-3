import React, { useState } from 'react';
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  ArrowRight,
  ArrowLeft,
  Download,
  Plus,
  Zap,
} from 'lucide-react';
import { ServerAsset, MainTab } from '../types';
import { ServerIcon, LeagueBadge } from './Icons';

import { fmtPoints } from '../lib/formatters';


interface PortfolioViewProps {
  servers: ServerAsset[];
  credBalance: number;
  inrBalance: number;
  onSelectTab: (tab: MainTab) => void;
  onSelectServerForTrade: (serverId: string) => void;
  onOpenWithdrawModal: () => void;
  onOpenBoostModal: () => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  servers,
  credBalance,
  inrBalance,
  onSelectTab,
  onSelectServerForTrade,
  onOpenWithdrawModal,
  onOpenBoostModal,
}) => {
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '1Y' | 'ALL'>('1M');

  // Compute total holdings in USD and INR
  const totalHoldingsValueUsd = servers.reduce((acc, s) => {
    const qty = s.holdings ?? 0;
    return acc + qty * s.priceUsd;
  }, 0);

  const totalCostUsd = servers.reduce((acc, s) => {
    const qty = s.holdings ?? 0;
    const avg = s.avgBuyPriceUsd ?? s.priceUsd * 0.85;
    return acc + qty * avg;
  }, 0);

  const unrealizedProfitUsd = totalHoldingsValueUsd - totalCostUsd;
  const unrealizedRoiPct = totalCostUsd > 0 ? (unrealizedProfitUsd / totalCostUsd) * 100 : 0;

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
            <PieChart className="w-5 h-5 text-[#18181B]" />
            <h1 className="text-[24px] font-bold text-[#18181B] tracking-tight">Your Portfolio</h1>
          </div>
          <p className="text-[13px] text-[#71717A]">
            Overview of your Discord community shareholdings, earned dividends, and cash balances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenBoostModal}
            className="px-4 py-2 rounded-xl bg-white border border-[#E4E3DE] hover:bg-[#F7F6F3] text-[12.5px] font-medium text-[#18181B] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-[#EAB308]" />
            <span>Boost Server</span>
          </button>
          <button
            onClick={onOpenWithdrawModal}
            className="px-4 py-2 rounded-xl bg-[#141416] hover:bg-[#27272A] text-white text-[12.5px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Withdraw Cash</span>
          </button>
        </div>
      </div>

      {/* Top 3 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-[#EAE9E4] rounded-2xl p-6">
          <p className="text-[12px] text-[#71717A] mb-1">Total Portfolio Value</p>
          <p className="text-[30px] font-bold text-[#18181B] tabular-nums font-mono">
            $ 2,843.50
          </p>
          <div className="flex items-center gap-1 text-[12px] font-medium text-[#10B981] mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+$312.40 (+12.4%)</span>
            <span className="text-[#A1A1AA] font-normal">this month</span>
          </div>
        </div>

        <div className="bg-white border border-[#EAE9E4] rounded-2xl p-6">
          <p className="text-[12px] text-[#71717A] mb-1">Unrealized Net Profit</p>
          <p className="text-[30px] font-bold text-[#10B981] tabular-nums font-mono">
            +${unrealizedProfitUsd.toFixed(2)}
          </p>
          <div className="flex items-center gap-1 text-[12px] font-medium text-[#10B981] mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{unrealizedRoiPct.toFixed(1)}% ROI</span>
            <span className="text-[#A1A1AA] font-normal">on all 5 servers</span>
          </div>
        </div>

        <div className="bg-white border border-[#EAE9E4] rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <p className="text-[12px] text-[#71717A] mb-1">Available Liquidity</p>
            <div className="flex items-baseline gap-4">
              <div>
                <span className="text-[20px] font-bold font-mono text-[#18181B]">
                  {credBalance.toLocaleString()}
                </span>
                <span className="text-[11px] text-[#71717A] ml-1">$CRED</span>
              </div>
              <div className="text-[#DFDED9]">|</div>
              <div>
                <span className="text-[20px] font-bold font-mono text-[#18181B]">
                  ${inrBalance.toFixed(2)}
                </span>
                <span className="text-[11px] text-[#71717A] ml-1">USD Cash</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => onSelectTab('Exchange')}
            className="text-[12px] font-semibold text-[#18181B] hover:underline inline-flex items-center gap-1 mt-3 cursor-pointer"
          >
            <span>Trade on Exchange</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Asset Allocation & Performance Bar */}
      <div className="bg-white border border-[#EAE9E4] rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-[15.5px] font-semibold text-[#18181B]">Asset Allocation</h2>
          <div className="flex items-center gap-1 bg-[#F5F4F0] p-1 rounded-xl text-[11px]">
            {(['1D', '1W', '1M', '1Y', 'ALL'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  timeframe === tf ? 'bg-white text-[#18181B] shadow-2xs' : 'text-[#71717A]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Visual Multi-Segment Bar */}
        <div className="h-3 w-full bg-[#EAE9E4] rounded-full overflow-hidden flex mb-4">
          <div style={{ width: '45%' }} className="bg-[#18181B]" title="$SQUAD (45%)" />
          <div style={{ width: '22%' }} className="bg-[#374086]" title="$AI (22%)" />
          <div style={{ width: '15%' }} className="bg-[#27272A]" title="$CODE (15%)" />
          <div style={{ width: '10%' }} className="bg-[#10B981]" title="$GAMING (10%)" />
          <div style={{ width: '8%' }} className="bg-[#EF4444]" title="$VALO (8%)" />
        </div>

        <div className="flex flex-wrap items-center gap-6 text-[12px]">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#18181B]" />
            <span className="font-semibold text-[#18181B]">$SQUAD</span> 45%
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#374086]" />
            <span className="font-semibold text-[#18181B]">$AI</span> 22%
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#27272A]" />
            <span className="font-semibold text-[#18181B]">$CODE</span> 15%
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
            <span className="font-semibold text-[#18181B]">$GAMING</span> 10%
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
            <span className="font-semibold text-[#18181B]">$VALO</span> 8%
          </span>
        </div>
      </div>

      {/* Holdings Detailed Table */}
      <div className="bg-white border border-[#EAE9E4] rounded-2xl p-6 overflow-x-auto">
        <h2 className="text-[15.5px] font-semibold text-[#18181B] mb-4">Your Active Server Holdings</h2>
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-[#F0EFEA] text-[11.5px] text-[#A1A1AA]">
              <th className="py-3 px-3 font-normal">Server Stock</th>
              <th className="py-3 px-3 font-normal">League</th>
              <th className="py-3 px-3 font-normal">Shares Owned</th>
              <th className="py-3 px-3 font-normal">Avg. Buy Price</th>
              <th className="py-3 px-3 font-normal">Current Price</th>
              <th className="py-3 px-3 font-normal">Current Value</th>
              <th className="py-3 px-3 font-normal">P&L</th>
              <th className="py-3 px-3 font-normal text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F4F3EE] text-[13px]">
            {servers.map((srv) => {
              const qty = srv.holdings ?? 1000;
              const avg = srv.avgBuyPriceUsd ?? +(srv.priceUsd * 0.82).toFixed(2);
              const val = qty * srv.priceUsd;
              const gain = val - qty * avg;
              const gainPct = +((gain / (qty * avg)) * 100).toFixed(1);
              const isProfit = gain >= 0;

              return (
                <tr key={srv.id} className="hover:bg-[#FAF9F6] transition-colors">
                  <td className="py-4 px-3">
                    <div className="flex items-center gap-3">
                      <ServerIcon id={srv.id} variant="table" />
                      <div>
                        <p className="font-semibold text-[#18181B] text-[13px]">{srv.ticker}</p>
                        <p className="text-[11px] text-[#A1A1AA]">{srv.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-3">
                    <LeagueBadge league={srv.league} />
                  </td>
                  <td className="py-4 px-3 font-mono font-semibold text-[#18181B] tabular-nums">
                    {qty.toLocaleString()}
                  </td>
                  <td className="py-4 px-3 font-mono tabular-nums text-[#52525B]">
                    ${fmtPoints(avg)}
                  </td>
                  <td className="py-4 px-3 font-mono font-semibold text-[#18181B] tabular-nums">
                    ${fmtPoints(srv.priceUsd)}
                  </td>
                  <td className="py-4 px-3 font-mono font-semibold text-[#18181B] tabular-nums">
                    ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-3 font-mono font-semibold tabular-nums">
                    <span
                      className={`inline-flex items-center gap-0.5 ${
                        isProfit ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}
                    >
                      {isProfit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {isProfit ? '+' : ''}${gain.toFixed(2)} ({isProfit ? '+' : ''}{gainPct}%)
                    </span>
                  </td>
                  <td className="py-4 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onSelectServerForTrade(srv.id)}
                        className="px-3 py-1.5 rounded-lg border border-[#E4E3DE] hover:bg-white text-[11.5px] font-medium text-[#18181B] cursor-pointer"
                      >
                        Trade
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
