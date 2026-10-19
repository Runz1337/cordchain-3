import React from 'react';
import {
  ArrowRight,
  TrendingUp,
  Zap,
  ShieldCheck,
  Users,
  Coins,
  ArrowUpRight,
  Store,
  PieChart,
  Megaphone,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { ServerAsset, MainTab } from '../types';
import { DiscordLogo, ServerIcon, LeagueBadge, HeroIsometricIllustration } from './Icons';
import { GoogleAdView } from './GoogleAdView';

import { fmtPoints } from '../lib/formatters';


interface ProjectLandingViewProps {
  servers: ServerAsset[];
  onSelectTab: (tab: MainTab) => void;
  onSelectServerForTrade: (serverId: string) => void;
  onOpenDiscordLogin: () => void;
}

export const ProjectLandingView: React.FC<ProjectLandingViewProps> = ({
  servers,
  onSelectTab,
  onSelectServerForTrade,
  onOpenDiscordLogin,
}) => {
  // Spotlight the top live gain straight from the CordChain API
  const hero = servers[0] || null;
  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#18181B] select-none space-y-16 pb-20">
      {/* Hero Section */}
      <section className="max-w-[1280px] mx-auto px-6 pt-12 md:pt-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#EAE9E4] text-[11.5px] font-semibold text-[#18181B] shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>THE FIRST DISCORD STOCK MARKET & AD REWARDS NETWORK</span>
            </div>

            <h1 className="text-[38px] md:text-[54px] font-bold leading-[1.08] tracking-[-0.03em] text-[#18181B]">
              Turn Discord Servers
              <br />
              Into Tradable Assets.
              <br />
              <span className="text-[#5865F2]">Earn Real Cash.</span>
            </h1>

            <p className="text-[15px] md:text-[16px] text-[#71717A] max-w-xl leading-relaxed">
              Cordchain empowers community creators to tokenize their Discord servers, raise liquidity, and distribute real USD ad revenues directly to members and shareholders.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                onClick={() => onSelectTab('Dashboard')}
                className="px-6 py-3.5 rounded-2xl bg-[#141416] hover:bg-[#27272A] text-white text-[13.5px] font-semibold transition-all inline-flex items-center gap-2.5 shadow-sm cursor-pointer"
              >
                <span>Open Trading Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onSelectTab('Manage')}
                className="px-6 py-3.5 rounded-2xl bg-white hover:bg-[#FAF9F6] border border-[#DFDDD6] text-[#18181B] text-[13.5px] font-semibold transition-all inline-flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <Store className="w-4 h-4 text-[#5865F2]" />
                <span>Manage Server Stock</span>
              </button>

              <button
                onClick={onOpenDiscordLogin}
                className="px-5 py-3.5 rounded-2xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-[13.5px] font-semibold transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <DiscordLogo className="w-4 h-4 text-white" />
                <span>Login with Discord</span>
              </button>
            </div>

            <div className="flex items-center gap-6 pt-4 text-[12px] text-[#71717A]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                Instant cash payouts
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                Zero server lock-in
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                Verified Discord Bot
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            {hero ? (
              <div className="bg-white border border-[#EAE9E4] rounded-3xl p-8 shadow-sm relative overflow-hidden w-full max-w-md">
                <div className="absolute top-4 right-4">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#10B981] text-[11px] font-semibold">
                    Live Trading
                  </span>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A] mb-1">
                  Featured Server Asset
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <ServerIcon id={hero.id} variant="header" />
                  <div>
                    <h3 className="text-[18px] font-bold text-[#18181B]">{hero.ticker}</h3>
                    <p className="text-[12px] text-[#71717A]">{hero.name} · {hero.members} humans</p>
                  </div>
                </div>

                <div className="space-y-3 py-3 border-y border-[#F3F2EE] font-mono">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#71717A] font-sans">Current Price</span>
                    <span className="font-bold text-[#18181B]">${fmtPoints(hero.priceUsd)} ({hero.change24h >= 0 ? '+' : ''}{hero.change24h.toFixed(1)}%)</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#71717A] font-sans">Market Capitalization</span>
                    <span className="font-bold text-[#18181B]">{hero.marketCapUsd}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#71717A] font-sans">League</span>
                    <span className="font-bold text-[#10B981]">{hero.league} League</span>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-[#71717A]">
                    <Users className="w-3.5 h-3.5" />
                    <span>Live on the CordChain exchange</span>
                  </div>
                  <button
                    onClick={() => onSelectServerForTrade(hero.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#18181B] text-white text-[12px] font-semibold hover:bg-[#27272A] cursor-pointer"
                  >
                    Trade {hero.ticker} →
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#EAE9E4] rounded-3xl p-8 shadow-sm relative overflow-hidden w-full max-w-md text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#5865F2]/10 text-[#5865F2] flex items-center justify-center mx-auto">
                  <Store className="w-6 h-6" />
                </div>
                <h3 className="text-[18px] font-bold text-[#18181B]">Tokenize Your Discord Server</h3>
                <p className="text-[12.5px] text-[#71717A] leading-relaxed">
                  Turn your Discord server into tradable community stock on CordLedger and launch community shares!
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => onSelectTab('Manage')}
                    className="px-5 py-2.5 rounded-xl bg-[#18181B] text-white text-[12.5px] font-semibold hover:bg-[#27272A] inline-flex items-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#EAB308]" />
                    <span>Start Tokenization</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Network Stats Bar */}
      <section className="max-w-[1280px] mx-auto px-6">
        <div className="bg-white border border-[#EAE9E4] rounded-3xl p-7 grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-[#EAE9E4]">
          <div>
            <p className="text-[12px] text-[#71717A] mb-1">Servers Tokenized</p>
            <p className="text-[28px] font-bold text-[#18181B] font-mono">142+</p>
            <p className="text-[11px] text-[#10B981] font-medium mt-0.5">+18 this month</p>
          </div>
          <div className="pt-4 md:pt-0">
            <p className="text-[12px] text-[#71717A] mb-1">Total Trading Volume</p>
            <p className="text-[28px] font-bold text-[#18181B] font-mono">$48.6K</p>
            <p className="text-[11px] text-[#71717A] mt-0.5">Across 4 tiers</p>
          </div>
          <div className="pt-4 md:pt-0">
            <p className="text-[12px] text-[#71717A] mb-1">Community Dividends Paid</p>
            <p className="text-[28px] font-bold text-[#10B981] font-mono">$12.4K</p>
            <p className="text-[11px] text-[#10B981] font-medium mt-0.5">Instant wallet payouts</p>
          </div>
          <div className="pt-4 md:pt-0">
            <p className="text-[12px] text-[#71717A] mb-1">Network Members</p>
            <p className="text-[28px] font-bold text-[#18181B] font-mono">180K+</p>
            <p className="text-[11px] text-[#71717A] mt-0.5">Discord users</p>
          </div>
        </div>
      </section>

      {/* How Cordchain Works: 4 Step Architecture */}
      <section className="max-w-[1280px] mx-auto px-6 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <p className="text-[11.5px] font-semibold text-[#5865F2] uppercase tracking-wider">
            Simple 4-Step Mechanism
          </p>
          <h2 className="text-[32px] font-bold tracking-tight text-[#18181B]">
            How Discord Communities Earn With Cordchain
          </h2>
          <p className="text-[13.5px] text-[#71717A]">
            No crypto wallets or complicated web3 setups required. Trade with $CRED fantasy tokens and withdraw real USD to your wallet.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-white border border-[#EAE9E4] rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EFECE6] flex items-center justify-center font-bold text-[#18181B] text-[15px]">
              01
            </div>
            <h3 className="text-[16px] font-bold text-[#18181B]">Tokenize Your Guild</h3>
            <p className="text-[12.5px] text-[#71717A] leading-relaxed">
              Tokenize your Discord server in seconds. Issue community shares, set initial IPO pricing, and retain owner treasury equity.
            </p>
          </div>

          <div className="bg-white border border-[#EAE9E4] rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EFECE6] flex items-center justify-center font-bold text-[#18181B] text-[15px]">
              02
            </div>
            <h3 className="text-[16px] font-bold text-[#18181B]">Members Boost & Trade</h3>
            <p className="text-[12.5px] text-[#71717A] leading-relaxed">
              Active members boost server stocks daily, increase league rankings, and trade community shares on the real-time order book.
            </p>
          </div>

          <div className="bg-white border border-[#EAE9E4] rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EFECE6] flex items-center justify-center font-bold text-[#18181B] text-[15px]">
              03
            </div>
            <h3 className="text-[16px] font-bold text-[#18181B]">Rewarded Ad Engine</h3>
            <p className="text-[12.5px] text-[#71717A] leading-relaxed">
              Sponsors launch cross-server campaigns. Members view non-intrusive 15s spotlights and receive instant bonus $CRED.
            </p>
          </div>

          <div className="bg-white border border-[#EAE9E4] rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EFECE6] flex items-center justify-center font-bold text-[#18181B] text-[15px]">
              04
            </div>
            <h3 className="text-[16px] font-bold text-[#18181B]">Real Cash Dividends</h3>
            <p className="text-[12.5px] text-[#71717A] leading-relaxed">
              Ad profits stream straight into the shareholder dividend pool. Withdraw earnings to Google Pay, PhonePe, or BHIM UPI in seconds.
            </p>
          </div>
        </div>
      </section>

      {/* Clean Sponsored Placement */}
      <section className="max-w-[1280px] mx-auto px-6">
        <GoogleAdView format="horizontal" label="Featured Partner" />
      </section>

      {/* Featured Community Ticker Grid */}
      <section className="max-w-[1280px] mx-auto px-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[22px] font-bold text-[#18181B]">Trending Discord Server Stocks</h2>
            <p className="text-[13px] text-[#71717A]">Discover high-growth communities available for immediate trading.</p>
          </div>
          <button
            onClick={() => onSelectTab('Dashboard')}
            className="text-[13px] font-semibold text-[#18181B] hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>View All on Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {servers.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-[#EAE9E4] bg-white">
            <Store className="w-8 h-8 text-[#A1A1AA] mx-auto mb-2" />
            <p className="text-[14px] font-bold text-[#18181B]">No Server Stocks Listed Yet</p>
            <p className="text-[12px] text-[#71717A] max-w-sm mx-auto mt-1 mb-4">
              Be the first community founder to tokenize a Discord server and start issuing trading shares.
            </p>
            <button
              onClick={() => onSelectTab('Manage')}
              className="px-4 py-2 rounded-xl bg-[#18181B] text-white text-[12px] font-semibold hover:bg-[#27272A] cursor-pointer"
            >
              Tokenize Server Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {servers.slice(0, 3).map((srv) => (
              <div
                key={srv.id}
                onClick={() => onSelectServerForTrade(srv.id)}
                className="bg-white border border-[#EAE9E4] hover:border-[#D4D3CD] rounded-2xl p-6 transition-all hover:shadow-xs cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <ServerIcon id={srv.id} variant="table" />
                      <div>
                        <h4 className="font-bold text-[15px] text-[#18181B]">{srv.ticker}</h4>
                        <p className="text-[12px] text-[#71717A]">{srv.name}</p>
                      </div>
                    </div>
                    <LeagueBadge league={srv.league} />
                  </div>
                  <p className="text-[12.5px] text-[#52525B] line-clamp-2 mb-4">{srv.description}</p>
                </div>

                <div className="pt-3 border-t border-[#F3F2EE] flex items-center justify-between">
                  <div>
                    <span className="text-[16px] font-bold font-mono text-[#18181B]">${fmtPoints(srv.priceUsd)}</span>
                    <span className="text-[11.5px] font-medium text-[#10B981] ml-2 font-mono">
                      +{srv.change24h.toFixed(1)}%
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectServerForTrade(srv.id);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[#18181B] text-white text-[12px] font-semibold hover:bg-[#27272A]"
                  >
                    Trade
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bottom Conversion Card */}
      <section className="max-w-[1280px] mx-auto px-6">
        <div className="bg-[#18181B] text-white rounded-3xl p-10 md:p-14 text-center space-y-6 relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="text-[32px] md:text-[42px] font-bold tracking-tight">
              Ready to Tokenize Your Discord Server?
            </h2>
            <p className="text-[14px] text-white/70">
              Join hundreds of server admins building sustainable, high-engagement communities with real asset value.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={() => onSelectTab('Manage')}
              className="px-7 py-3.5 rounded-2xl bg-white text-[#18181B] hover:bg-[#F4F4F0] text-[13.5px] font-bold transition-colors cursor-pointer"
            >
              List Server IPO
            </button>
            <button
              onClick={onOpenDiscordLogin}
              className="px-7 py-3.5 rounded-2xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-[13.5px] font-bold transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <DiscordLogo className="w-4 h-4 text-white" />
              <span>Connect with Discord</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
