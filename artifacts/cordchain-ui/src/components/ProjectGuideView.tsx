import React, { useState } from 'react';
import {
  BookOpen,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Zap,
  Coins,
  Cpu,
  Lock,
  Layers,
  Search,
  Copy,
  Check,
  Trophy,
  Flame,
  Scale,
  Calendar,
  Sparkles,
  BarChart3,
  ExternalLink,
  Users,
  CheckCircle2,
  Terminal,
  Activity,
  ChevronRight,
  Info,
} from 'lucide-react';
import { MainTab } from '../types';

interface ProjectGuideViewProps {
  onSelectTab: (tab: MainTab) => void;
  onSelectServerForTrade?: (serverId: string) => void;
}

export const ProjectGuideView: React.FC<ProjectGuideViewProps> = ({
  onSelectTab,
  onSelectServerForTrade,
}) => {
  const [activeSection, setActiveSection] = useState<string>('all');
  const [commandSearch, setCommandSearch] = useState<string>('');
  const [commandCategory, setCommandCategory] = useState<string>('all');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const handleCopy = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const BOT_COMMANDS = [
    { name: '/buy', args: '<ticker> <shares>', desc: 'Buy shares of a listed server using liquid $CRED via the constant-product AMM', cat: 'trading' },
    { name: '/sell', args: '<ticker> <shares>', desc: 'Sell held shares back into the AMM liquidity pool for instant $CRED', cat: 'trading' },
    { name: '/quote', args: '<ticker> <shares>', desc: 'Get an instant AMM price quote, execution cost, and slippage estimate', cat: 'trading' },
    { name: '/server', args: '[ticker]', desc: 'Open the detailed market listing page and fundamentals for a server stock', cat: 'market' },
    { name: '/servers', args: '[search]', desc: 'Browse the full directory of listed community stocks across all leagues', cat: 'market' },
    { name: '/orderbook', args: '[ticker]', desc: 'Inspect the live AMM liquidity depth and bid/ask ladder', cat: 'market' },
    { name: '/tape', args: '[ticker]', desc: 'Inspect executed trade transactions with verified CordLedger receipt links', cat: 'market' },
    { name: '/candle', args: '[ticker] [interval]', desc: 'View ASCII candlestick sparkline charts and 24-hour highs and lows', cat: 'market' },
    { name: '/portfolio', args: '', desc: 'View your net worth, liquid $CRED, stock equity, and daily bonus eligibility', cat: 'portfolio' },
    { name: '/leaderboard traders', args: '', desc: 'Inspect top traders ranked by total portfolio paper net worth', cat: 'portfolio' },
    { name: '/leaderboard servers', args: '', desc: 'Inspect top servers ranked by 24h market-cap percentage gainers', cat: 'portfolio' },
    { name: '/boost', args: '', desc: 'Initiate 12s human attention check (+250 $CRED, +0.8% server price momentum)', cat: 'growth' },
    { name: '/bump', args: '', desc: 'Bump this server stock price (+0.4% momentum, requires holding ≥1 share)', cat: 'growth' },
    { name: '/bumpstatus', args: '', desc: 'Check your remaining cooldown for server bumping', cat: 'growth' },
    { name: '/activity', args: '', desc: 'View live active chatters, messages, and hourly flow metrics for this server', cat: 'growth' },
    { name: '/earnings', args: '[ticker]', desc: 'View weekly Community Score and shareholder fantasy dividend distributions', cat: 'growth' },
    { name: '/quests', args: '[ticker]', desc: 'Inspect collaborative community quests that multiply your Community Score', cat: 'social' },
    { name: '/seasons', args: '', desc: 'View the 30-day competitive season schedule, reset timer, and Hall of Fame', cat: 'social' },
    { name: '/rivalry', args: '', desc: 'View active server vs server community derbies competing on growth rate', cat: 'social' },
    { name: '/predictions', args: '[ticker]', desc: 'View open peer-to-peer prediction markets on server milestones with $CRED', cat: 'social' },
    { name: '/verify', args: '', desc: 'Execute real-time cryptographic verification of the append-only CordLedger', cat: 'ledger' },
    { name: '/tokenize', args: '', desc: 'Launch the server owner tokenization wizard to issue 1,000,000 shares', cat: 'admin' },
    { name: '/ping', args: '', desc: 'Check bot latency and gateway heartbeat ping', cat: 'admin' },
    { name: '/shards', args: '', desc: 'View live Discord gateway shard cluster status and latency', cat: 'admin' },
  ];

  const filteredCommands = BOT_COMMANDS.filter((c) => {
    const matchesCat = commandCategory === 'all' || c.cat === commandCategory;
    const matchesSearch =
      c.name.toLowerCase().includes(commandSearch.toLowerCase()) ||
      c.desc.toLowerCase().includes(commandSearch.toLowerCase()) ||
      c.args.toLowerCase().includes(commandSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#18181B] pb-24 select-none">
      {/* Hero Header */}
      <section className="border-b border-[#EAE9E4] bg-white py-12 px-6">
        <div className="max-w-[1240px] mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FAF9F6] border border-[#EAE9E4] text-[11.5px] font-semibold text-[#18181B] shadow-2xs">
            <BookOpen className="w-3.5 h-3.5 text-[#6366F1]" />
            <span>OFFICIAL CORDCHAIN SYSTEM SPECIFICATION & ARCHITECTURE GUIDE</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <h1 className="text-[34px] md:text-[44px] font-bold tracking-tight text-[#18181B] leading-tight">
                The Discord Community Stock Exchange & CordLedger Economy
              </h1>
              <p className="text-[14.5px] text-[#71717A] leading-relaxed">
                Transform Discord communities into publicly tradable stocks backed by constant-product AMM liquidity,
                bot-resistant activity scoring, weekly fantasy dividends, and a tamper-evident cryptographic ledger.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <button
                onClick={() => onSelectTab('Exchange')}
                className="px-4 py-2.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-white text-[13px] font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <span>Live Exchange</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onSelectTab('CordScan')}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#FAF9F6] border border-[#EAE9E4] text-[#18181B] text-[13px] font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                <span>CordScan Explorer</span>
              </button>
            </div>
          </div>

          {/* Quick Jump Pills */}
          <div className="flex items-center gap-2 pt-4 overflow-x-auto no-scrollbar text-[12px] font-medium text-[#71717A]">
            <span className="shrink-0 text-[#A1A1AA] text-[11px] uppercase tracking-wider font-semibold">Jump to:</span>
            {[
              { id: 'summary', label: '1. Executive Summary' },
              { id: 'economy', label: '2. $CRED Economy' },
              { id: 'pricing', label: '3. Two-Layer Pricing' },
              { id: 'score', label: '4. Community Score' },
              { id: 'cordledger', label: '5. CordLedger' },
              { id: 'social', label: '6. Discord Revolution' },
              { id: 'commands', label: '7. Bot Commands' },
              { id: 'comparison', label: '8. Web3 Comparison' },
            ].map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="px-3 py-1.5 rounded-lg bg-[#FAF9F6] hover:bg-[#F0EFEA] border border-[#EAE9E4] text-[#18181B] whitespace-nowrap transition-colors"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-[1240px] mx-auto px-6 pt-10 space-y-12">
        {/* ======================================================== */}
        {/* SECTION 1: EXECUTIVE SUMMARY & ARCHITECTURAL SHIFT */}
        {/* ======================================================== */}
        <section id="summary" className="space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center font-bold text-[13px]">
              1
            </div>
            <h2 className="text-[20px] font-bold text-[#18181B]">
              Executive Summary & Paradigm Shift
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-[#EAE9E4] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-[#ECFDF5] text-[#059669] flex items-center justify-center mb-1">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="text-[14px] font-bold text-[#18181B]">Discord Communities</h3>
              <p className="text-[12px] text-[#71717A] leading-relaxed">
                Genuine human conversation, voice dwell, and active chatters generate authoritative engagement metrics.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#EAE9E4] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center mb-1">
                <Activity className="w-4 h-4" />
              </div>
              <h3 className="text-[14px] font-bold text-[#18181B]">Community Score</h3>
              <p className="text-[12px] text-[#71717A] leading-relaxed">
                Cheat-proof mathematical score factoring entropy spread, retention, and growth against server baseline.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#EAE9E4] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mb-1">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="text-[14px] font-bold text-[#18181B]">Constant-Product AMM</h3>
              <p className="text-[12px] text-[#71717A] leading-relaxed">
                Uniswap-class automated market maker (x · y = k) guarantees instant liquidity for every server size.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#EAE9E4] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-[#F3E8FF] text-[#9333EA] flex items-center justify-center mb-1">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="text-[14px] font-bold text-[#18181B]">CordLedger Floor</h3>
              <p className="text-[12px] text-[#71717A] leading-relaxed">
                Every trade, boost, and dividend is hash-chained with SHA-256 and signed with Ed25519 in 1-minute blocks.
              </p>
            </div>
          </div>

          {/* Blockchain Shift Alert Card */}
          <div className="p-5 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#166534] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-[13.5px] font-bold text-[#166534]">
                  Why We Dropped the Blockchain for CordLedger
                </h4>
                <p className="text-[12px] text-[#15803D] mt-0.5 leading-relaxed">
                  External EVM chains require browser extensions, testnet faucets, gas tokens, and mobile deep-links.
                  CordChain replaced this friction with <strong>CordLedger</strong>: 100% transparent, tamper-evident SHA-256 accounting with zero gas, zero wallets, and instant 1-click execution.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-white border border-[#BBF7D0] text-[#166534] text-[11px] font-bold whitespace-nowrap shadow-2xs">
              Tamper-Evident Core
            </span>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 2: THE SIMPLIFIED FANTASY ECONOMY */}
        {/* ======================================================== */}
        <section id="economy" className="space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#10B981]/10 text-[#10B981] flex items-center justify-center font-bold text-[13px]">
              2
            </div>
            <h2 className="text-[20px] font-bold text-[#18181B]">
              The Simplified Fantasy Economy ($CRED Only)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-[#EAE9E4]">
              <span className="text-[11px] text-[#71717A] font-semibold uppercase tracking-wider block">Starter Allowance</span>
              <span className="text-[20px] font-bold font-mono text-[#10B981] block mt-1">1,000 $CRED</span>
              <span className="text-[11.5px] text-[#52525B] block mt-1">Auto-granted on first visit to every new trader</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#EAE9E4]">
              <span className="text-[11px] text-[#71717A] font-semibold uppercase tracking-wider block">Daily Login Bonus</span>
              <span className="text-[20px] font-bold font-mono text-[#18181B] block mt-1">+50 $CRED</span>
              <span className="text-[11.5px] text-[#52525B] block mt-1">Claimable once per calendar day in web or bot</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#EAE9E4]">
              <span className="text-[11px] text-[#71717A] font-semibold uppercase tracking-wider block">Daily Earn Cap</span>
              <span className="text-[20px] font-bold font-mono text-[#18181B] block mt-1">250 $CRED</span>
              <span className="text-[11.5px] text-[#52525B] block mt-1">Prevents alt-account bot grinding dominance</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#EAE9E4]">
              <span className="text-[11px] text-[#71717A] font-semibold uppercase tracking-wider block">Fixed Supply Per Server</span>
              <span className="text-[20px] font-bold font-mono text-[#6366F1] block mt-1">1,000,000</span>
              <span className="text-[11.5px] text-[#52525B] block mt-1">Standardized shares for clean market cap comparison</span>
            </div>
          </div>

          {/* Share Allocation Visual Bar */}
          <div className="p-5 rounded-2xl bg-white border border-[#EAE9E4] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#18181B]">
                Standardized 1,000,000 Share Allocation & Vesting
              </h3>
              <span className="text-[11.5px] text-[#71717A] font-mono">100% Fixed Supply</span>
            </div>

            <div className="w-full h-4 rounded-full bg-[#EAE9E4] overflow-hidden flex">
              <div style={{ width: '75%' }} className="bg-[#10B981] h-full" title="75% Public AMM Float" />
              <div style={{ width: '5%' }} className="bg-[#6366F1] h-full" title="5% Creator IPO Unlocked" />
              <div style={{ width: '20%' }} className="bg-[#F59E0B] h-full" title="20% Creator Locked Vesting" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[12px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#10B981] shrink-0" />
                <span><strong>750,000 Shares (75%)</strong>: Public Float in AMM pool</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#6366F1] shrink-0" />
                <span><strong>50,000 Shares (5%)</strong>: Creator Reserve Unlocked at IPO</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#F59E0B] shrink-0" />
                <span><strong>200,000 Shares (20%)</strong>: Locked (5%/month vesting)</span>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 3: TWO-LAYER PRICING & MARKET DEFENSES */}
        {/* ======================================================== */}
        <section id="pricing" className="space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#D97706]/10 text-[#D97706] flex items-center justify-center font-bold text-[13px]">
              3
            </div>
            <h2 className="text-[20px] font-bold text-[#18181B]">
              Two-Layer Pricing & Market Defenses
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Layer 1 */}
            <div className="p-5 rounded-2xl bg-white border border-[#EAE9E4] space-y-3">
              <div className="flex items-center gap-2 text-[#D97706]">
                <TrendingUp className="w-4 h-4" />
                <h3 className="text-[14px] font-bold text-[#18181B]">Layer 1: Market Price (Trading)</h3>
              </div>
              <p className="text-[12.5px] text-[#71717A] leading-relaxed">
                Powered by a constant-product Automated Market Maker (x · y = k). The spot price is mathematically
                determined by the ratio of pool credits to pool shares:
              </p>
              <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] font-mono text-[12.5px] text-center font-bold text-[#18181B]">
                Spot Price = Pool CRED / Pool Shares
              </div>
              <p className="text-[11.5px] text-[#71717A]">
                Guarantees immediate liquidity without waiting for order matches, even for nascent Squad League communities.
              </p>
            </div>

            {/* Layer 2 */}
            <div className="p-5 rounded-2xl bg-white border border-[#EAE9E4] space-y-3">
              <div className="flex items-center gap-2 text-[#10B981]">
                <Coins className="w-4 h-4" />
                <h3 className="text-[14px] font-bold text-[#18181B]">Layer 2: Fair Value Fundamentals</h3>
              </div>
              <p className="text-[12.5px] text-[#71717A] leading-relaxed">
                A weekly earnings report converts each server's Community Score into fantasy $CRED dividends paid to shareholders.
              </p>
              <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] font-mono text-[12.5px] text-center font-bold text-[#18181B]">
                Fair Value = (Annual Dividend per Share) / 0.10
              </div>
              <p className="text-[11.5px] text-[#71717A]">
                Gives fundamental investors a concrete mathematical incentive to research active communities rather than purely chasing hype.
              </p>
            </div>
          </div>

          {/* 3 Market Defenses */}
          <div className="p-5 rounded-2xl bg-white border border-[#EAE9E4] space-y-3">
            <h3 className="text-[13px] font-bold text-[#18181B] uppercase tracking-wider">
              3 Market Microstructure Safeguards
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-1">
                <div className="flex items-center gap-2 font-bold text-[12.5px] text-[#18181B]">
                  <Scale className="w-4 h-4 text-[#EF4444]" />
                  <span>20% Circuit Breaker</span>
                </div>
                <p className="text-[11.5px] text-[#71717A] leading-relaxed">
                  Price movement ≥ 20% within a 15-minute window pauses trading for 30 minutes to eliminate flash manipulation.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-1">
                <div className="flex items-center gap-2 font-bold text-[12.5px] text-[#18181B]">
                  <Lock className="w-4 h-4 text-[#F59E0B]" />
                  <span>10% Position Cap</span>
                </div>
                <p className="text-[11.5px] text-[#71717A] leading-relaxed">
                  Individual accounts can hold at most 100,000 shares (10% of total supply) preventing float cornering.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-1">
                <div className="flex items-center gap-2 font-bold text-[12.5px] text-[#18181B]">
                  <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                  <span>Wash-Trade Guard</span>
                </div>
                <p className="text-[11.5px] text-[#71717A] leading-relaxed">
                  Rapid round-trip buy/sell flips executed within 60 seconds are automatically rejected server-side.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 4: BOT-RESISTANT COMMUNITY SCORE */}
        {/* ======================================================== */}
        <section id="score" className="space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center font-bold text-[13px]">
              4
            </div>
            <h2 className="text-[20px] font-bold text-[#18181B]">
              Bot-Resistant Community Score Formulation
            </h2>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#EAE9E4] space-y-4">
            <div className="p-4 rounded-xl bg-[#18181B] text-white font-mono text-[13px] md:text-[14px] leading-relaxed overflow-x-auto">
              Score = (sqrt(UniqueChatters) * 12 * W_spread * W_retention * (1 + B_growth) + B_voice) * AgeFactor
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
              <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-1">
                <h4 className="text-[12.5px] font-bold text-[#18181B]">1. Unique Active Chatters</h4>
                <p className="text-[11.5px] text-[#71717A] leading-relaxed">
                  Scaled via square-root (√N) with a per-user daily message cap of 25 to disarm spam flooding.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-1">
                <h4 className="text-[12.5px] font-bold text-[#18181B]">2. Conversation Spread</h4>
                <p className="text-[11.5px] text-[#71717A] leading-relaxed">
                  Calculated via normalized Shannon entropy (W_spread). Equal distribution among many users beats 2 accounts spamming.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-1">
                <h4 className="text-[12.5px] font-bold text-[#18181B]">3. Member Retention</h4>
                <p className="text-[11.5px] text-[#71717A] leading-relaxed">
                  Measures the proportion of last week's active chatters that returned this week (W_retention).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-1">
                <h4 className="text-[12.5px] font-bold text-[#18181B]">4. Growth vs. Own Baseline</h4>
                <p className="text-[11.5px] text-[#71717A] leading-relaxed">
                  <strong>The key fairness piece:</strong> A doubling 200-member community can outscore a flat 100,000-member server.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-1">
                <h4 className="text-[12.5px] font-bold text-[#18181B]">5. Voice Minutes Bonus</h4>
                <p className="text-[11.5px] text-[#71717A] leading-relaxed">
                  Square-root scaled voice dwell (B_voice) provides authentic proof of real human conversation.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-1">
                <h4 className="text-[12.5px] font-bold text-[#18181B]">6. Snowflake Age Gate</h4>
                <p className="text-[11.5px] text-[#71717A] leading-relaxed">
                  Decodes Discord account creation age; accounts younger than 14 days are penalized to block burner farms.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 5: CORDLEDGER & CORDSCAN */}
        {/* ======================================================== */}
        <section id="cordledger" className="space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#10B981]/10 text-[#10B981] flex items-center justify-center font-bold text-[13px]">
              5
            </div>
            <h2 className="text-[20px] font-bold text-[#18181B]">
              CordLedger Architecture & CordScan Explorer
            </h2>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#EAE9E4] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[13px] text-[#18181B]">
                  <Layers className="w-4 h-4 text-[#10B981]" />
                  <span>SHA-256 Hash Chain</span>
                </div>
                <p className="text-[12px] text-[#71717A] leading-relaxed">
                  Every row links to the SHA-256 hash of the preceding entry (`prev_hash`). Protected by PostgreSQL WORM triggers preventing UPDATE or DELETE.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[13px] text-[#18181B]">
                  <Cpu className="w-4 h-4 text-[#6366F1]" />
                  <span>1-Minute Merkle Blocks</span>
                </div>
                <p className="text-[12px] text-[#71717A] leading-relaxed">
                  Transactions are batched every 60 seconds into blocks with a pairwise SHA-256 Merkle root and signed with an Ed25519 digital signature.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[13px] text-[#18181B]">
                  <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
                  <span>Public Verification</span>
                </div>
                <p className="text-[12px] text-[#71717A] leading-relaxed">
                  Anyone can audit the ledger in their browser on CordScan (`/scan`) or via the open-source CLI script `scripts/verify_cordchain.py`.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => onSelectTab('CordScan')}
                className="px-4 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-[12.5px] font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span>Open CordScan Explorer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 6: DISCORD-NATIVE SOCIAL MECHANICS */}
        {/* ======================================================== */}
        <section id="social" className="space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#EC4899]/10 text-[#EC4899] flex items-center justify-center font-bold text-[13px]">
              6
            </div>
            <h2 className="text-[20px] font-bold text-[#18181B]">
              Discord-Native Social Mechanics
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-[#EAE9E4] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-[#FDF2F8] text-[#DB2777] flex items-center justify-center mb-1">
                <Trophy className="w-4 h-4" />
              </div>
              <h3 className="text-[14px] font-bold text-[#18181B]">30-Day Seasons</h3>
              <p className="text-[12px] text-[#71717A] leading-relaxed">
                Competitive monthly seasons reset portfolios so newcomers can always compete, while champions are enshrined in the permanent Hall of Fame (`/seasons`).
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#EAE9E4] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center mb-1">
                <Flame className="w-4 h-4" />
              </div>
              <h3 className="text-[14px] font-bold text-[#18181B]">Server Derbies (Rivalries)</h3>
              <p className="text-[12px] text-[#71717A] leading-relaxed">
                Peer communities are paired in 7-day head-to-head derbies competing on growth rate for shared prize pools (`/rivalry`).
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#EAE9E4] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-[#F0FDF4] text-[#16A34A] flex items-center justify-center mb-1">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-[14px] font-bold text-[#18181B]">Community Quests</h3>
              <p className="text-[12px] text-[#71717A] leading-relaxed">
                Collaborative server goals (e.g., reaching 50 unique chatters) boost valuation and expand shareholder payouts (`/quests`).
              </p>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 7: INTERACTIVE BOT COMMAND REFERENCE */}
        {/* ======================================================== */}
        <section id="commands" className="space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center font-bold text-[13px]">
                7
              </div>
              <h2 className="text-[20px] font-bold text-[#18181B]">
                Discord Bot Command Reference
              </h2>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11.5px] font-medium">
              {['all', 'trading', 'market', 'portfolio', 'growth', 'social', 'admin'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCommandCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer capitalize ${
                    commandCategory === cat
                      ? 'bg-[#18181B] text-white border-[#18181B]'
                      : 'bg-white text-[#71717A] border-[#EAE9E4] hover:bg-[#FAF9F6]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#EAE9E4] space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search bot commands (/buy, /quests, /earnings, /seasons)..."
                value={commandSearch}
                onChange={(e) => setCommandSearch(e.target.value)}
                className="w-full bg-[#FAF9F6] border border-[#EAE9E4] rounded-xl pl-10 pr-4 py-2 text-[12.5px] outline-none focus:border-[#6366F1] focus:bg-white text-[#18181B]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
              {filteredCommands.map((c) => (
                <div
                  key={c.name}
                  className="p-3 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] flex items-start justify-between gap-3 group hover:border-[#6366F1]/30 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <code className="text-[12.5px] font-bold font-mono text-[#18181B] bg-white px-2 py-0.5 rounded border border-[#EAE9E4]">
                        {c.name} {c.args}
                      </code>
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-white text-[#71717A] border border-[#EAE9E4]">
                        {c.cat}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-[#52525B] leading-relaxed">{c.desc}</p>
                  </div>

                  <button
                    onClick={() => handleCopy(`${c.name} ${c.args}`.trim())}
                    className="p-1.5 rounded-lg bg-white border border-[#EAE9E4] hover:bg-[#F4F3EE] text-[#71717A] transition-colors shrink-0 cursor-pointer"
                    title="Copy command"
                  >
                    {copiedCmd === `${c.name} ${c.args}`.trim() ? (
                      <Check className="w-3.5 h-3.5 text-[#10B981]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 8: WEB3 VS CORDCHAIN COMPARISON MATRIX */}
        {/* ======================================================== */}
        <section id="comparison" className="space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#059669]/10 text-[#059669] flex items-center justify-center font-bold text-[13px]">
              8
            </div>
            <h2 className="text-[20px] font-bold text-[#18181B]">
              Architectural Comparison Matrix
            </h2>
          </div>

          <div className="rounded-2xl border border-[#EAE9E4] bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#EAE9E4] bg-[#FAF9F6] text-[#71717A] text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Dimension</th>
                    <th className="py-3 px-4">Speculative Web3 Tokens</th>
                    <th className="py-3 px-4">Legacy Testnet Prototype</th>
                    <th className="py-3 px-4 text-[#10B981] font-bold">Modern CordChain</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE9E4] text-[#52525B]">
                  <tr>
                    <td className="py-3 px-4 font-bold text-[#18181B]">Currency</td>
                    <td className="py-3 px-4">Volatile Crypto (ETH/SOL)</td>
                    <td className="py-3 px-4">Dual currency ($CRED + ₹ INR)</td>
                    <td className="py-3 px-4 font-semibold text-[#10B981]">100% Fantasy $CRED</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-[#18181B]">Wallets & Gas</td>
                    <td className="py-3 px-4">MetaMask, seed phrases, gas fees</td>
                    <td className="py-3 px-4">Testnet gas (~0.0001 ETH)</td>
                    <td className="py-3 px-4 font-semibold text-[#10B981]">Zero Wallets & Zero Gas</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-[#18181B]">Trust Model</td>
                    <td className="py-3 px-4">Decentralized consensus</td>
                    <td className="py-3 px-4">EVM Testnet RPC</td>
                    <td className="py-3 px-4 font-semibold text-[#10B981]">Tamper-Evident CordLedger</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-[#18181B]">Transparency</td>
                    <td className="py-3 px-4">Etherscan / Solscan</td>
                    <td className="py-3 px-4">BaseScan</td>
                    <td className="py-3 px-4 font-semibold text-[#10B981]">CordScan Explorer (/scan)</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-[#18181B]">Valuation Basis</td>
                    <td className="py-3 px-4">Pure social media hype</td>
                    <td className="py-3 px-4">Ad clicks</td>
                    <td className="py-3 px-4 font-semibold text-[#10B981]">AMM Spot + Fundamental Yield</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-[#18181B]">Discord Integration</td>
                    <td className="py-3 px-4">None (External dApps)</td>
                    <td className="py-3 px-4">Basic Iframe</td>
                    <td className="py-3 px-4 font-semibold text-[#10B981]">Native Bot, Derbies, Quests</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Footer Actions Banner */}
        <section className="p-8 rounded-3xl bg-[#18181B] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
          <div className="space-y-1.5 text-center md:text-left">
            <h3 className="text-[20px] font-bold">Ready to Trade or Tokenize Your Community?</h3>
            <p className="text-[13px] text-[#A1A1AA]">
              Join the live fantasy exchange floor or explore the transparent CordLedger.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap justify-center">
            <button
              onClick={() => onSelectTab('Exchange')}
              className="px-5 py-2.5 rounded-xl bg-white text-[#18181B] hover:bg-[#F4F3EE] text-[13px] font-bold transition-colors cursor-pointer"
            >
              Open Exchange
            </button>
            <button
              onClick={() => onSelectTab('CordScan')}
              className="px-5 py-2.5 rounded-xl bg-[#27272A] hover:bg-[#3F3F46] text-white text-[13px] font-semibold transition-colors cursor-pointer"
            >
              Inspect CordScan
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
