import React, { useState } from 'react';
import {
  Home,
  Zap,
  TrendingUp,
  Wallet,
  Megaphone,
  ArrowRight,
  Play,
  ArrowUpRight,
  ArrowDownRight,
  User,
  ShieldCheck,
  Scissors,
  Gamepad2,
  ArrowUpFromLine,
  Sparkles,
  LayoutDashboard,
  Compass,
  Store,
  Check,
} from 'lucide-react';
import { ServerAsset, ActivityItem, HomeSideNav, MainTab } from '../types';
import { ServerIcon, LeagueBadge, HeroIsometricIllustration } from './Icons';
import { AdvancedHomeView } from './AdvancedHomeView';
import { GoogleAdView } from './GoogleAdView';
import type { ApiWalletSummary } from '../lib/api';

import { fmtPoints } from '../lib/formatters';


interface HomeViewProps {
  servers: ServerAsset[];
  ipoServers: ServerAsset[];
  activities: ActivityItem[];
  credBalance: number;
  inrBalance: number;
  wallet?: ApiWalletSummary | null;
  isLoggedIn?: boolean;
  ownedServerIds?: string[];
  bumpPendingId?: string | null;
  onBumpServer?: (serverId: string) => void;
  onUpdateGuildListing?: (guildId: string, payload: Record<string, unknown>) => Promise<void>;
  activeSideNav: HomeSideNav;
  onSelectSideNav: (nav: HomeSideNav) => void;
  onSelectTab: (tab: MainTab) => void;
  onSelectServerForTrade: (serverId: string) => void;
  onOpenBoostModal: (targetServerTicker?: string) => void;
  onOpenVideoModal: () => void;
  onOpenWithdrawModal: () => void;
  onOpenAdModal: () => void;
  onOpenDiscordLogin: () => void;
  joinedServers: string[];
  onToggleJoinServer: (serverId: string) => void;
  onOpenTokenizeModal?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  servers,
  ipoServers,
  activities,
  credBalance,
  inrBalance,
  wallet,
  isLoggedIn,
  ownedServerIds,
  bumpPendingId,
  onBumpServer,
  onUpdateGuildListing,
  activeSideNav,
  onSelectSideNav,
  onSelectTab,
  onSelectServerForTrade,
  onOpenBoostModal,
  onOpenVideoModal,
  onOpenWithdrawModal,
  onOpenAdModal,
  onOpenDiscordLogin,
  joinedServers,
  onToggleJoinServer,
  onOpenTokenizeModal,
}) => {
  const [homeMode, setHomeMode] = useState<'dashboard' | 'advanced'>('dashboard');

  // Real portfolio KPIs from the live wallet (falls back to balances only)
  const portfolioValue = wallet ? Number(wallet.wallets.portfolioStockValueCred || 0) : 0;
  const netWorth = wallet ? Number(wallet.wallets.totalNetWorthCred || credBalance) : credBalance;
  const holdingsCount = wallet ? wallet.holdings.filter((h) => h.shares > 0).length : 0;

  const sidebarServers = servers
    .slice()
    .sort((a, b) => b.change24h - a.change24h)
    .slice(0, 5);

  const navItems: { id: HomeSideNav; label: string; icon: React.ReactNode }[] = [
    { id: 'Dashboard', label: 'Dashboard', icon: <Home className="w-[16px] h-[16px]" strokeWidth={1.9} /> },
    { id: 'Boost Server', label: 'Boost Server', icon: <Zap className="w-[16px] h-[16px]" strokeWidth={1.9} /> },
    { id: 'Exchange', label: 'Exchange', icon: <TrendingUp className="w-[16px] h-[16px]" strokeWidth={1.9} /> },
    { id: 'Wallet', label: 'Wallet', icon: <Wallet className="w-[16px] h-[16px]" strokeWidth={1.9} /> },
    { id: 'Manage', label: 'Manage Stocks', icon: <Store className="w-[16px] h-[16px]" strokeWidth={1.9} /> },
    { id: 'Ad Creator', label: 'Ad Creator', icon: <Megaphone className="w-[16px] h-[16px]" strokeWidth={1.9} /> },
  ];

  const handleNavClick = (id: HomeSideNav) => {
    onSelectSideNav(id);
    if (id === 'Exchange') {
      onSelectTab('Exchange');
    } else if (id === 'Wallet') {
      onSelectTab('Wallet');
    } else if (id === 'Manage') {
      onSelectTab('Manage');
    } else if (id === 'Boost Server') {
      onOpenBoostModal();
    } else if (id === 'Ad Creator') {
      onOpenAdModal();
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-header Switch between Standard Dashboard & Advanced Hub */}
      <div className="max-w-[1440px] mx-auto px-5 pt-3 flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-[#EFECE6] rounded-full text-[12px] font-medium">
          <button
            onClick={() => setHomeMode('dashboard')}
            className={`px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 transition-all cursor-pointer ${
              homeMode === 'dashboard'
                ? 'bg-white text-[#18181B] font-semibold shadow-xs'
                : 'text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard View</span>
          </button>
          <button
            onClick={() => setHomeMode('advanced')}
            className={`px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 transition-all cursor-pointer ${
              homeMode === 'advanced'
                ? 'bg-white text-[#18181B] font-semibold shadow-xs'
                : 'text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Discover Top.gg Directory</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[12px] text-[#71717A]">
          <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span>Real-time Discord network pricing synced</span>
        </div>
      </div>

      {homeMode === 'advanced' ? (
        <AdvancedHomeView
          servers={servers}
          ipoServers={ipoServers}
          onSelectTab={onSelectTab}
          onSelectServerForTrade={onSelectServerForTrade}
          onOpenBoostModal={onOpenBoostModal}
          onOpenVideoModal={onOpenVideoModal}
          onOpenDiscordLogin={onOpenDiscordLogin}
          onOpenAdModal={onOpenAdModal}
          onOpenTokenizeModal={onOpenTokenizeModal}
          joinedServers={joinedServers}
          onToggleJoinServer={onToggleJoinServer}
          isLoggedIn={isLoggedIn}
          ownedServerIds={ownedServerIds}
          bumpPendingId={bumpPendingId}
          onBumpServer={onBumpServer}
          onUpdateGuildListing={onUpdateGuildListing}
        />
      ) : (
        <div className="max-w-[1440px] mx-auto px-5 py-2 flex gap-5 items-start">
          {/* LEFT SIDEBAR */}
          <aside className="w-[212px] shrink-0 flex flex-col justify-between min-h-[calc(100vh-140px)] select-none">
            <div>
              {/* Primary Navigation */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = activeSideNav === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#EFECE6] text-[#18181B] font-semibold'
                          : 'text-[#52525B] hover:bg-[#EFECE6]/50 hover:text-[#18181B] font-medium'
                      }`}
                    >
                      <span className={isActive ? 'text-[#18181B]' : 'text-[#52525B]'}>{item.icon}</span>
                      <span className="whitespace-nowrap">{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <hr className="my-5 border-[#EAE9E4]" />

              {/* Your Servers */}
              <div>
                <h2 className="text-[12px] font-medium text-[#71717A] px-2 mb-3">Your Servers</h2>
                <div className="space-y-3">
                  {sidebarServers.map((server) => {
                    const isUp = server.sidebarChange24h >= 0;
                    return (
                      <button
                        key={server.id}
                        onClick={() => onSelectServerForTrade(server.id)}
                        className="w-full flex items-center justify-between px-2 py-1 rounded-xl hover:bg-[#EFECE6]/60 transition-colors text-left group cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ServerIcon id={server.id} variant="sidebar" />
                          <div className="leading-tight">
                            <p className="text-[12.5px] font-semibold text-[#18181B] group-hover:text-black">
                              {server.ticker}
                            </p>
                            <p
                              className={`text-[11px] font-medium flex items-center gap-0.5 mt-0.5 tabular-nums ${
                                isUp ? 'text-[#10B981]' : 'text-[#EF4444]'
                              }`}
                            >
                              {isUp ? (
                                <ArrowUpRight className="w-3 h-3" strokeWidth={2.2} />
                              ) : (
                                <ArrowDownRight className="w-3 h-3" strokeWidth={2.2} />
                              )}
                              {isUp ? '+' : ''}
                              {server.sidebarChange24h.toFixed(1)}%
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-[#71717A] tabular-nums shrink-0">
                          <User className="w-3 h-3 text-[#A1A1AA]" strokeWidth={2} />
                          <span>{server.members.toLowerCase()}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Promo Box */}
            <div className="mt-8 bg-[#EFECE6]/75 border border-[#E5E4DF] rounded-2xl p-4">
              <div className="w-6 h-6 rounded-md border border-[#A1A1AA] flex items-center justify-center text-[#52525B] mb-2.5">
                <TrendingUp className="w-3.5 h-3.5" strokeWidth={2} />
              </div>
              <p className="text-[12px] text-[#52525B] leading-[1.45] mb-3">
                Turn your Discord community into a growing asset.
              </p>
              <button
                onClick={() => onOpenBoostModal()}
                className="text-[12px] font-semibold text-[#27272A] hover:text-black inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Learn more</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </aside>

          {/* CENTER MAIN COLUMN */}
          <main className="flex-1 min-w-0 space-y-4">
            {/* Hero Banner Card */}
            <section className="bg-white border border-[#EAE9E4] rounded-2xl px-8 py-6 flex items-center justify-between gap-6 relative overflow-hidden">
              <div className="max-w-[440px] z-10">
                <p className="text-[10.5px] font-semibold tracking-[0.14em] text-[#71717A] uppercase mb-2.5">
                  CROSS-SERVER STOCK MARKET & AD REWARDS
                </p>
                <h1 className="text-[31px] leading-[1.18] font-semibold text-[#18181B] tracking-[-0.02em] mb-3">
                  Grow Your Discord
                  <br />
                  Community. Earn Real Value.
                </h1>
                <p className="text-[13px] text-[#71717A] leading-[1.55] mb-5">
                  Watch ads, boost server stocks, trade on the exchange, and earn $CRED & real USD. All in one place.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onOpenBoostModal()}
                    className="bg-[#141416] hover:bg-[#27272A] text-white text-[12.5px] font-medium px-4 py-2.5 rounded-xl inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>Boost Server Stock</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={onOpenVideoModal}
                    className="bg-white hover:bg-[#F7F6F3] text-[#18181B] border border-[#E4E3DE] text-[12.5px] font-medium px-4 py-2.5 rounded-xl inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Watch Video</span>
                  </button>
                </div>
              </div>

              <div className="hidden sm:flex items-center justify-end shrink-0">
                <HeroIsometricIllustration />
              </div>
            </section>

            {/* 4-Column KPI Summary Strip */}
            <section className="bg-white border border-[#EAE9E4] rounded-2xl p-5 grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#EAE9E4]">
              <div className="pr-5">
                <p className="text-[12px] text-[#71717A] mb-1.5">Total Net Worth</p>
                <p className="text-[22px] font-semibold text-[#18181B] tabular-nums tracking-tight mb-1">
                  $ {netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[11.5px] font-medium text-[#A1A1AA] tabular-nums">
                  {portfolioValue > 0
                    ? `$ ${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} in stock`
                    : 'No stock positions yet'}
                </p>
              </div>

              <div className="lg:px-6">
                <p className="text-[12px] text-[#71717A] mb-1.5">$CRED Balance</p>
                <p className="text-[22px] font-semibold text-[#18181B] tabular-nums tracking-tight mb-1">
                  {credBalance.toLocaleString()}
                </p>
                <p className="text-[11.5px] font-medium text-[#10B981] tabular-nums">
                  <span>Boosts claim +250 $CRED</span>
                </p>
              </div>

              <div className="lg:px-6 pt-3 lg:pt-0">
                <p className="text-[12px] text-[#71717A] mb-1.5">Available for Withdrawal</p>
                <p className="text-[22px] font-semibold text-[#18181B] tabular-nums tracking-tight mb-1">
                  $ {inrBalance.toFixed(2)}
                </p>
                <p className="text-[11.5px] text-[#A1A1AA]">(min. $10.00)</p>
              </div>

              <div className="lg:pl-6 pt-3 lg:pt-0">
                <p className="text-[12px] text-[#71717A] mb-1.5">Servers Held</p>
                <p className="text-[22px] font-semibold text-[#18181B] tabular-nums tracking-tight mb-1">{holdingsCount}</p>
                <p className="text-[11.5px] text-[#A1A1AA]">
                  {holdingsCount === 0 ? 'Buy a share to get started' : 'Shareholder bump rights active'}
                </p>
              </div>
            </section>

            {/* Top Gainers Table */}
            <section className="bg-white border border-[#EAE9E4] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15.5px] font-semibold text-[#18181B]">Top Gainers</h2>
                <button
                  onClick={() => onSelectTab('Exchange')}
                  className="text-[12px] text-[#71717A] hover:text-[#18181B] inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>View all</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#F0EFEA] text-[11.5px] font-normal text-[#A1A1AA]">
                      <th className="py-2.5 pl-1 pr-3 font-normal w-8">#</th>
                      <th className="py-2.5 px-3 font-normal">Server</th>
                      <th className="py-2.5 px-3 font-normal">League</th>
                      <th className="py-2.5 px-3 font-normal">Advantage</th>
                      <th className="py-2.5 px-3 font-normal">Price</th>
                      <th className="py-2.5 px-3 font-normal">24h Change</th>
                      <th className="py-2.5 pl-3 pr-1 font-normal text-right">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F4F3EE] text-[13px]">
                    {servers.map((server, idx) => {
                      const isPositive = server.change24h >= 0;
                      return (
                        <tr
                          key={server.id}
                          onClick={() => onSelectServerForTrade(server.id)}
                          className="hover:bg-[#FAF9F6] transition-colors cursor-pointer group"
                        >
                          <td className="py-3.5 pl-1 pr-3 text-[#71717A] tabular-nums text-[12.5px]">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-3">
                              <ServerIcon id={server.id} variant="table" />
                              <div>
                                <p className="font-semibold text-[#18181B] text-[13px] leading-tight group-hover:underline">
                                  {server.ticker}
                                </p>
                                <p className="text-[11.5px] text-[#A1A1AA] mt-0.5">{server.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <LeagueBadge league={server.league} />
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF6EE] border border-[#EFE8D6] text-[#8C734B] text-[11px] font-mono font-semibold"
                              title="CordChain Community Advantage Multiplier"
                            >
                              <Zap className="w-3 h-3 text-[#B45309]" />
                              <span>{server.advantageMultiplier ? `${server.advantageMultiplier.toFixed(2)}x` : '1.12x'}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-[#18181B] tabular-nums text-[13px]">
                            ${fmtPoints(server.priceUsd)}
                          </td>
                          <td className="py-3.5 px-3 tabular-nums">
                            <span
                              className={`inline-flex items-center gap-1 text-[12.5px] font-medium ${
                                isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'
                              }`}
                            >
                              {isPositive ? (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowDownRight className="w-3.5 h-3.5" />
                              )}
                              {isPositive ? '+' : ''}
                              {server.change24h.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3.5 pl-3 pr-1 text-right text-[#71717A] tabular-nums text-[12.5px]">
                            {server.volume24h}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Clean Sponsored Placement */}
            <GoogleAdView format="horizontal" />

            {/* Featured IPO Servers */}
            <section className="bg-white border border-[#EAE9E4] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15.5px] font-semibold text-[#18181B]">Featured IPO Servers</h2>
                <button
                  onClick={() => onSelectTab('Exchange')}
                  className="text-[12px] text-[#71717A] hover:text-[#18181B] inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>View all</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {ipoServers.map((ipo) => {
                  const isJoined = joinedServers.includes(ipo.id);
                  return (
                    <div
                      key={ipo.id}
                      className="border border-[#EAE9E4] rounded-2xl p-4 flex flex-col justify-between hover:border-[#D4D3CD] transition-colors bg-[#FDFDFC]"
                    >
                      <div className="flex items-start justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2.5">
                          <ServerIcon id={ipo.id} variant="table" />
                          <div>
                            <p className="text-[13px] font-semibold text-[#18181B] leading-tight">
                              {ipo.ticker}
                            </p>
                            <p className="text-[11px] text-[#A1A1AA] mt-0.5">{ipo.name}</p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-[#F5F2EB] text-[#8C7B60] text-[10px] font-semibold uppercase tracking-wide">
                          IPO
                        </span>
                      </div>

                      <div className="flex items-end justify-between mt-1">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[14.5px] font-semibold text-[#18181B] tabular-nums">
                              ${fmtPoints(ipo.priceUsd)}
                            </span>
                            <span className="text-[11.5px] font-medium text-[#10B981] inline-flex items-center gap-0.5 tabular-nums">
                              <ArrowUpRight className="w-3 h-3" />+{ipo.change24h.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => onToggleJoinServer(ipo.id)}
                          className={`px-3 py-1.5 rounded-lg border text-[11.5px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer ${
                            isJoined
                              ? 'bg-[#18181B] text-white border-[#18181B]'
                              : 'bg-white text-[#27272A] border-[#E4E3DE] hover:bg-[#F5F4F0]'
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            {isJoined ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-white" />
                                <span>Joined</span>
                              </>
                            ) : (
                              <span>Join Server</span>
                            )}
                          </span>
                          {!isJoined && <ArrowRight className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </main>

          {/* RIGHT SIDEBAR COLUMN */}
          <aside className="w-[312px] shrink-0 space-y-4">
            {/* Wallets Card */}
            <section className="bg-white border border-[#EAE9E4] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-[#18181B]">Wallets</h2>
                <button
                  onClick={() => onSelectTab('Wallet')}
                  className="text-[12px] text-[#71717A] hover:text-[#18181B] inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>View all</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* $CRED (Fantasy) Sub-card */}
              <div className="bg-[#F2F9F5] border border-[#DFEFE5] rounded-xl p-3.5 mb-3 flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#DCEEE2] text-[#15803D] flex items-center justify-center font-semibold text-[13px] shrink-0 mt-0.5">
                    <span className="w-5 h-5 rounded-full border border-[#15803D] flex items-center justify-center text-[11px]">
                      $
                    </span>
                  </div>
                  <div>
                    <p className="text-[11.5px] font-semibold text-[#18181B]">
                      $CRED <span className="font-normal text-[#71717A]">(Fantasy)</span>
                    </p>
                    <p className="text-[20px] font-semibold text-[#18181B] tabular-nums leading-tight my-0.5">
                      {credBalance.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-[#71717A] tabular-nums">≈ $ 0.00</p>
                  </div>
                </div>

                <button
                  onClick={() => onSelectTab('Exchange')}
                  className="bg-white hover:bg-[#F8FAF9] text-[#18181B] border border-[#D5E6DC] rounded-lg px-3.5 py-1.5 text-[12px] font-medium transition-colors cursor-pointer"
                >
                  Trade
                </button>
              </div>

              {/* USD (Real Cash) Sub-card */}
              <div className="bg-[#F9F9F7] border border-[#EAE9E4] rounded-xl p-3.5 mb-4 flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#EFECE6] text-[#52525B] flex items-center justify-center font-semibold text-[13px] shrink-0 mt-0.5">
                    $
                  </div>
                  <div>
                    <p className="text-[11.5px] font-semibold text-[#18181B]">
                      USD <span className="font-normal text-[#71717A]">(Real Cash)</span>
                    </p>
                    <p className="text-[20px] font-semibold text-[#18181B] tabular-nums leading-tight mt-0.5">
                      $ {inrBalance.toFixed(2)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onOpenWithdrawModal}
                  className="bg-white hover:bg-[#F4F3EF] text-[#18181B] border border-[#E2E1DC] rounded-lg px-3.5 py-1.5 text-[12px] font-medium transition-colors cursor-pointer"
                >
                  Withdraw
                </button>
              </div>

              {/* Next Withdrawal Progress */}
              <div>
                <div className="flex items-center justify-between text-[11.5px] mb-2">
                  <span className="text-[#52525B] font-medium">Next Withdrawal</span>
                  <span className="tabular-nums font-semibold text-[#18181B]">
                    $ {Math.round(inrBalance)}{' '}
                    <span className="text-[#A1A1AA] font-normal">/ $ 10</span>
                  </span>
                </div>
                <div className="h-[5px] w-full bg-[#EAE9E4] rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-[#18181B] rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (inrBalance / 10) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between px-0.5">
                  {Array.from({ length: 28 }).map((_, i) => (
                    <span key={i} className="w-[1px] h-1.5 bg-[#DFDED9]" />
                  ))}
                </div>
              </div>
            </section>

            {/* Recent Activity Card */}
            <section className="bg-white border border-[#EAE9E4] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-[#18181B]">Recent Activity</h2>
                <button
                  onClick={() => onSelectTab('Wallet')}
                  className="text-[12px] text-[#71717A] hover:text-[#18181B] inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>View all</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-[#F5F4F0]">
                {activities.map((item) => {
                  const renderActivityBadge = () => {
                    switch (item.type) {
                      case 'boost':
                        return (
                          <div className="w-8 h-8 rounded-full bg-[#E8F6EE] text-[#10B981] flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                        );
                      case 'buy':
                        return (
                          <div className="w-8 h-8 rounded-full bg-[#FDECEC] text-[#EF4444] flex items-center justify-center shrink-0">
                            <Scissors className="w-4 h-4" />
                          </div>
                        );
                      case 'sell':
                        return (
                          <div className="w-8 h-8 rounded-full bg-[#FCECF2] text-[#EC4899] flex items-center justify-center shrink-0">
                            <Gamepad2 className="w-4 h-4" />
                          </div>
                        );
                      case 'ad':
                        return (
                          <div className="w-8 h-8 rounded-full bg-[#F3F2EE] text-[#52525B] flex items-center justify-center shrink-0">
                            <Megaphone className="w-4 h-4" />
                          </div>
                        );
                      case 'withdraw':
                        return (
                          <div className="w-8 h-8 rounded-full bg-[#F3F2EE] text-[#52525B] flex items-center justify-center shrink-0">
                            <ArrowUpFromLine className="w-4 h-4" />
                          </div>
                        );
                    }
                  };

                  return (
                    <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {renderActivityBadge()}
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-medium text-[#18181B] truncate">
                            {item.title}
                          </p>
                          <p
                            className={`text-[11.5px] font-medium tabular-nums mt-0.5 ${
                              item.isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'
                            }`}
                          >
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] text-[#A1A1AA] shrink-0 tabular-nums">
                        {item.timeAgo}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Ad Campaign Promo Card */}
            <section className="bg-[#F2F1ED] border border-[#E5E4DF] rounded-2xl p-5 flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-xl bg-[#EAE9E3] text-[#18181B] flex items-center justify-center shrink-0 mt-0.5">
                <ArrowUpFromLine className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[12.5px] text-[#3F3F46] leading-[1.5] mb-2.5">
                  Spend <span className="font-semibold text-[#18181B]">500+ $CRED</span> to{' '}
                  <span className="font-semibold text-[#18181B]">launch</span> your own ad campaign and promote your Discord server.
                </p>
                <button
                  onClick={onOpenAdModal}
                  className="text-[12px] font-semibold text-[#27272A] hover:text-black inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Create Ad</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </section>

            {/* Clean Sidebar AdSense Placement */}
            <GoogleAdView format="sidebar" label="Partner Sponsored" className="mt-4" />
          </aside>
        </div>
      )}
    </div>
  );
};
