import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  ChevronDown,
  Check,
  Sparkles,
  ArrowUpRight,
  Settings,
  Trophy,
  PieChart,
  LogOut,
  Sliders,
  Store,
  Wallet,
  ExternalLink,
  Copy,
  Plus,
  BookOpen,
} from 'lucide-react';
import { MainTab, ServerAsset, UserProfile } from '../types';
import { AyushAvatar, ServerIcon, DiscordLogo } from './Icons';
import {

  Web3WalletState,
  shortenAddress,
} from '../lib/blockchain';
import { fmtPoints } from '../lib/formatters';

interface TopBarProps {
  onSelectTab: (tab: MainTab) => void;
  servers: ServerAsset[];
  onSelectServer: (serverId: string) => void;
  credBalance: number;
  inrBalance: number;
  user: UserProfile;
  apiOnline?: boolean | null;
  lastSync?: Date | null;
  onOpenDiscordLogin: () => void;
  onLogout: () => void;
  web3Wallet?: Web3WalletState | null;
  onConnectWeb3?: () => void;
  onDisconnectWeb3?: () => void;
  onOpenTokenizeModal?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onSelectTab,
  servers,
  onSelectServer,
  credBalance,
  inrBalance,
  user,
  apiOnline,
  lastSync,
  onOpenDiscordLogin,
  onLogout,
  web3Wallet,
  onConnectWeb3,
  onDisconnectWeb3,
  onOpenTokenizeModal,
}) => {
  const [secondsOffset, setSecondsOffset] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsOffset((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatClock = (offset: number) => {
    const baseSeconds = 21 * 3600 + 42 * 60 + 17 + offset;
    const h = Math.floor((baseSeconds / 3600) % 24);
    const m = Math.floor((baseSeconds % 3600) / 60);
    const s = baseSeconds % 60;
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
  };

  const isLoggedIn = user.isLoggedIn;

  const filteredServers = servers.filter(
    (s) =>
      s.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.league.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <header className="h-[62px] bg-[#F7F6F3] border-b border-[#EAE9E4] px-6 flex items-center justify-between sticky top-0 z-30 select-none">
        {/* Left Brand & Live Clock */}
        <div className="flex items-center gap-3.5 shrink-0">
          <button
            onClick={() => onSelectTab('Home')}
            className="text-[13.5px] font-bold tracking-[0.24em] text-[#18181B] uppercase hover:opacity-80 transition-opacity whitespace-nowrap cursor-pointer"
          >
            CORDCHAIN
          </button>

          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                apiOnline === false
                  ? 'bg-[#EF4444]'
                  : apiOnline === null
                    ? 'bg-[#A1A1AA] animate-pulse'
                    : 'bg-[#10B981]'
              }`}
            />
            <span className="text-[11px] font-semibold tracking-[0.08em] text-[#52525B] uppercase">
              {apiOnline === false ? 'BACKEND OFFLINE' : 'LIVE'}
            </span>
            {lastSync && apiOnline !== false && (
              <span className="text-[10px] text-[#A1A1AA] font-mono">
                {lastSync.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>

          <span className="h-3.5 w-[1px] bg-[#DFDED9] mx-0.5" />

          {/* Live wallet chip wired to the CordChain FastAPI wallet endpoint */}
          {isLoggedIn && (
            <div className="hidden md:flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-[#F2F9F5] border border-[#DFEFE5] font-mono text-[11.5px] font-semibold text-[#15803D] tabular-nums">
                {credBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} $CRED
              </span>
            </div>
          )}

          <span className="h-3.5 w-[1px] bg-[#DFDED9] mx-0.5" />

          <span className="font-mono text-[12px] text-[#71717A] tabular-nums tracking-tight">
            {formatClock(secondsOffset)}
          </span>
        </div>

        {/* Right Actions & Profile */}
        <div className="flex items-center gap-3 shrink-0 relative">
          {isLoggedIn && (
            <>
              <button
                onClick={() => {
                  setSearchOpen(true);
                  setNotifOpen(false);
                  setProfileOpen(false);
                }}
                aria-label="Search servers"
                className="p-1.5 rounded-lg text-[#27272A] hover:bg-[#ECEBE6] transition-colors cursor-pointer"
              >
                <Search className="w-[17px] h-[17px]" strokeWidth={2} />
              </button>

              <div className="relative">
                <button
                  onClick={() => {
                    setNotifOpen(!notifOpen);
                    setProfileOpen(false);
                  }}
                  aria-label="Notifications"
                  className="p-1.5 rounded-lg text-[#27272A] hover:bg-[#ECEBE6] transition-colors relative cursor-pointer"
                >
                  <Bell className="w-[17px] h-[17px]" strokeWidth={2} />
                </button>

                {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-[#EAE9E4] rounded-2xl shadow-lg p-4 z-50">
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#F0EFEA]">
                  <span className="text-[13px] font-semibold text-[#18181B]">Notifications</span>
                  <span className="text-[11px] text-[#10B981] font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" /> All caught up
                  </span>
                </div>
                <div className="space-y-2.5 text-[12px]">
                  <div className="p-2.5 rounded-xl bg-[#F8F8F6] flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[#18181B]">$SQUAD surged +12.4%</p>
                      <p className="text-[#71717A] text-[11px] mt-0.5">Rank #2 in Arena League · 18m ago</p>
                    </div>
                    <span className="text-[#10B981] font-mono font-medium text-[11px]">+$240</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F8F8F6] flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[#18181B]">Daily Boost Reward Credited</p>
                      <p className="text-[#71717A] text-[11px] mt-0.5">+250 $CRED added to trading balance</p>
                    </div>
                    <Sparkles className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <span className="h-5 w-[1px] bg-[#E2E1DC]" />

          {/* Tokenize Discord Server Action */}
          {onOpenTokenizeModal && (
            <button
              onClick={onOpenTokenizeModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#18181B] text-white hover:bg-[#27272A] text-[12px] font-semibold transition-all shadow-xs cursor-pointer shrink-0"
              title="Tokenize a new Discord Server on CordLedger"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tokenize</span>
            </button>
          )}

          {/* CordScan Explorer Pill */}
          <button
            onClick={() => onSelectTab('CordScan')}
            className="flex items-center gap-2 py-1.5 px-3 rounded-full bg-white hover:bg-[#F7F6F3] border border-[#E4E3DE] hover:border-[#10B981] transition-all text-[12px] font-mono cursor-pointer shadow-xs"
            title="Inspect CordLedger blocks, receipts, and verify hashes"
          >
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="font-semibold text-[#18181B]">CordScan</span>
            <span className="hidden sm:inline px-1.5 py-0.5 rounded text-[10px] bg-[#ECFDF5] text-[#059669] font-sans font-semibold">
              Explorer
            </span>
          </button>

          {/* Guide Pill */}
          <button
            onClick={() => onSelectTab('Guide')}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-white hover:bg-[#F7F6F3] border border-[#E4E3DE] hover:border-[#5865F2] transition-all text-[12px] font-medium text-[#18181B] cursor-pointer shadow-xs"
            title="Read the CordChain System Guide & Whitepaper"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#5865F2]" />
            <span className="font-semibold text-[#18181B]">Guide</span>
          </button>

          <span className="h-5 w-[1px] bg-[#E2E1DC]" />

          {/* User Profile Pill & Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setProfileOpen(!profileOpen);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2 py-1 pl-1 pr-1.5 rounded-full hover:bg-[#ECEBE6]/70 transition-colors cursor-pointer"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <AyushAvatar className="w-8 h-8" />
              )}
              <span className="text-[13px] font-medium text-[#18181B]">{user.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#71717A]" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-[#EAE9E4] rounded-2xl shadow-xl p-3 z-50">
                <div className="pb-3 mb-2 border-b border-[#F0EFEA]">
                  <p className="text-[13px] font-semibold text-[#18181B]">{user.name} (@{user.username})</p>
                  <p className="text-[11px] text-[#71717A] mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                    <span>Discord Connected</span>
                  </p>
                </div>

                <div className="space-y-1 text-[12px] mb-2">
                  <button
                    onClick={() => {
                      onSelectTab('Portfolio');
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#F7F6F3] text-left text-[#3F3F46] cursor-pointer"
                  >
                    <PieChart className="w-4 h-4 text-[#71717A]" />
                    <span>My Portfolio</span>
                  </button>

                  <button
                    onClick={() => {
                      onSelectTab('Leaderboard');
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#F7F6F3] text-left text-[#3F3F46] cursor-pointer"
                  >
                    <Trophy className="w-4 h-4 text-[#71717A]" />
                    <span>Trader Leaderboard</span>
                  </button>

                  <button
                    onClick={() => {
                      onSelectTab('Manage');
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#F7F6F3] text-left text-[#3F3F46] cursor-pointer"
                  >
                    <Store className="w-4 h-4 text-[#71717A]" />
                    <span>Manage Server Stocks</span>
                  </button>

                  <button
                    onClick={() => {
                      onSelectTab('Guide');
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#F7F6F3] text-left text-[#3F3F46] cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-[#71717A]" />
                    <span>System Guide (/guide)</span>
                  </button>

                  <button
                    onClick={() => {
                      onSelectTab('Settings');
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#F7F6F3] text-left text-[#3F3F46] cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-[#71717A]" />
                    <span>Settings & Preferences</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-[#F0EFEA] space-y-1.5">
                  <button
                    onClick={() => {
                      onLogout();
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-[#FDF2F2] text-[#B91C1C] text-[12px] font-medium transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                  <button
                    onClick={() => {
                      onOpenDiscordLogin();
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl bg-[#5865F2]/10 hover:bg-[#5865F2]/15 text-[#5865F2] text-[12px] font-medium transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <DiscordLogo className="w-3.5 h-3.5 text-[#5865F2]" />
                      <span>Switch Discord ID</span>
                    </div>
                    <span className="text-[10px]">OAuth</span>
                  </button>
                </div>
                </div>
              )}
            </div>
            </>
          )}
          {!isLoggedIn && (
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onSelectTab('Guide')}
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-white hover:bg-[#F7F6F3] border border-[#E4E3DE] hover:border-[#5865F2] transition-all text-[12px] font-medium text-[#18181B] cursor-pointer shadow-xs"
                title="Read the CordChain System Guide & Whitepaper"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#5865F2]" />
                <span className="font-semibold text-[#18181B]">Guide</span>
              </button>
              <button
                onClick={() => onSelectTab('CordScan')}
                className="flex items-center gap-2 py-1.5 px-3 rounded-full bg-white hover:bg-[#F7F6F3] border border-[#E4E3DE] hover:border-[#10B981] transition-all text-[12px] font-mono cursor-pointer shadow-xs"
                title="Inspect CordLedger blocks, receipts, and verify hashes"
              >
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="font-semibold text-[#18181B]">CordScan</span>
              </button>
              <button
                onClick={onOpenDiscordLogin}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white text-[12px] font-semibold transition-colors cursor-pointer"
              >
                <DiscordLogo className="w-3.5 h-3.5 text-white" />
                <span>Login with Discord</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Quick Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 bg-black/25 backdrop-blur-[1px] z-50 flex items-start justify-center pt-20 px-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="bg-white border border-[#EAE9E4] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#EAE9E4]">
              <Search className="w-4 h-4 text-[#71717A]" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search servers, leaderboards, settings, or tools..."
                className="w-full text-[13px] text-[#18181B] placeholder-[#A1A1AA] focus:outline-none"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="text-[11px] text-[#71717A] px-2 py-0.5 rounded bg-[#F4F4F1] hover:text-[#18181B] cursor-pointer"
              >
                ESC
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto p-2 divide-y divide-[#F5F5F2]">
              {/* Quick links */}
              <div className="p-2 flex gap-2">
                <button
                  onClick={() => {
                    onSelectTab('Leaderboard');
                    setSearchOpen(false);
                  }}
                  className="px-3 py-1 rounded-lg bg-[#F5F4F0] text-[11.5px] font-medium text-[#18181B] hover:bg-[#EAE9E4]"
                >
                  Leaderboards
                </button>
                <button
                  onClick={() => {
                    onSelectTab('Portfolio');
                    setSearchOpen(false);
                  }}
                  className="px-3 py-1 rounded-lg bg-[#F5F4F0] text-[11.5px] font-medium text-[#18181B] hover:bg-[#EAE9E4]"
                >
                  My Portfolio
                </button>
                <button
                  onClick={() => {
                    onSelectTab('Settings');
                    setSearchOpen(false);
                  }}
                  className="px-3 py-1 rounded-lg bg-[#F5F4F0] text-[11.5px] font-medium text-[#18181B] hover:bg-[#EAE9E4]"
                >
                  Settings
                </button>
              </div>

              {filteredServers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onSelectServer(s.id);
                    onSelectTab('Exchange');
                    setSearchOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#F7F6F3] transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <ServerIcon id={s.id} variant="table" />
                    <div>
                      <p className="text-[13px] font-semibold text-[#18181B]">{s.ticker}</p>
                      <p className="text-[11.5px] text-[#71717A]">{s.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right font-mono">
                      <p className="text-[13px] font-semibold text-[#18181B]">${fmtPoints(s.priceUsd)}</p>
                      <p className={`text-[11px] ${s.change24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {s.change24h >= 0 ? '+' : ''}
                        {s.change24h.toFixed(1)}%
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-[#A1A1AA]" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
