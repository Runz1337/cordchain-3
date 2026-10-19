import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowRight,
  Zap,
  ShieldCheck,
  Users,
  Copy,
  Check,
  Code2,
  Sliders,
  Eye,
  Flame,
  Search,
  Plus,
  Compass,
  Store,
  Filter,
  Rocket,
  Link2,
  Lock,
  Save,
  Info,
  ExternalLink,
} from 'lucide-react';
import { ServerAsset, MainTab } from '../types';
import { ServerIcon, LeagueBadge, DiscordLogo } from './Icons';
import { normalizeDiscordInvite, type UpdateGuildPayload } from '../lib/api';

import { fmtPoints } from '../lib/formatters';


interface AdvancedHomeViewProps {
  servers: ServerAsset[];
  ipoServers: ServerAsset[];
  onSelectTab: (tab: MainTab) => void;
  onSelectServerForTrade: (serverId: string) => void;
  onOpenBoostModal: (targetServerTicker?: string) => void;
  onOpenVideoModal: () => void;
  onOpenDiscordLogin: () => void;
  onOpenAdModal: () => void;
  onOpenTokenizeModal?: () => void;
  joinedServers?: string[];
  onToggleJoinServer?: (serverId: string) => void;
  isLoggedIn?: boolean;
  ownedServerIds?: string[];
  bumpPendingId?: string | null;
  onBumpServer?: (serverId: string) => void;
  onUpdateGuildListing?: (guildId: string, payload: UpdateGuildPayload) => Promise<void>;
}

type DiscoverSubTab = 'discover' | 'studio';
type WidgetSize = 'banner' | 'card' | 'pill' | 'embed' | 'leaderboard';
type WidgetTheme = 'discord_dark' | 'obsidian' | 'cream_light' | 'emerald' | 'cyber';
type SortOption = 'bump' | 'gain' | 'members' | 'advantage' | 'newest';

const BUMP_FRESH_WINDOW_MS = 4 * 60 * 60 * 1000;

const timeAgoShort = (iso?: string): string => {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
};

export const AdvancedHomeView: React.FC<AdvancedHomeViewProps> = ({
  servers,
  ipoServers,
  onSelectTab,
  onSelectServerForTrade,
  onOpenBoostModal,
  onOpenVideoModal: _onOpenVideoModal,
  onOpenDiscordLogin,
  onOpenAdModal,
  onOpenTokenizeModal,
  joinedServers = [],
  onToggleJoinServer,
  isLoggedIn = false,
  ownedServerIds = [],
  bumpPendingId = null,
  onBumpServer,
  onUpdateGuildListing,
}) => {
  void onOpenAdModal;
  void _onOpenVideoModal;

  // Combine all verified live servers (Strictly NO fake fallback data)
  const allServers = useMemo(() => {
    const map = new Map<string, ServerAsset>();
    for (const s of servers) map.set(s.id, s);
    for (const s of ipoServers) {
      if (!map.has(s.id)) map.set(s.id, s);
    }
    return Array.from(map.values());
  }, [servers, ipoServers]);

  // Main Discover View Mode
  const [subTab, setSubTab] = useState<DiscoverSubTab>('discover');

  // Search & Filters for Top.gg style directory
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('bump');

  const categories = [
    'All',
    'Gaming',
    'Anime',
    'Crypto & Web3',
    'Tech & AI',
    'Community',
    'Social',
    'Music',
    'Economy',
  ];

  const filteredAndSortedServers = useMemo(() => {
    const list = allServers.filter((s) => {
      if (selectedCategory !== 'All') {
        const matchesCat =
          s.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
          s.tags.some((t) => t.toLowerCase().includes(selectedCategory.toLowerCase()));
        if (!matchesCat) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          s.name.toLowerCase().includes(q) ||
          s.ticker.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }
      return true;
    });

    const bumpedScore = (s: ServerAsset): number => {
      if (!s.lastBumpedAt) return 0;
      const t = Date.parse(s.lastBumpedAt);
      if (Number.isNaN(t)) return 0;
      const age = Date.now() - t;
      return age <= BUMP_FRESH_WINDOW_MS ? (s.bumpCount ?? 1) * 1000 - age / 1000 : 0;
    };

    return list.sort((a, b) => {
      if (sortBy === 'bump') {
        const scoreDiff = bumpedScore(b) - bumpedScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return ((b.bumpCount ?? 0) - (a.bumpCount ?? 0)) || (b.change24h - a.change24h);
      }
      if (sortBy === 'gain') return b.change24h - a.change24h;
      if (sortBy === 'members') {
        return (b.memberStats?.totalMembers ?? b.membersCount ?? 0) - (a.memberStats?.totalMembers ?? a.membersCount ?? 0);
      }
      if (sortBy === 'advantage') {
        return (b.advantageMultiplier ?? 1.0) - (a.advantageMultiplier ?? 1.0);
      }
      return b.rank - a.rank;
    });
  }, [allServers, selectedCategory, searchQuery, sortBy]);

  // Selected server for promotion studio
  const [selectedServerId, setSelectedServerId] = useState<string>('');

  // Keep studio selection valid once live servers stream in
  useEffect(() => {
    if (!allServers.length) return;
    if (!selectedServerId || !allServers.some((s) => s.id === selectedServerId)) {
      const owned = allServers.find((s) => ownedServerIds.includes(s.id));
      setSelectedServerId((owned || allServers[0]).id);
    }
  }, [allServers, ownedServerIds, selectedServerId]);

  const activeServer = useMemo(
    () => allServers.find((s) => s.id === selectedServerId) || allServers[0] || null,
    [allServers, selectedServerId]
  );

  const isOwnedServer = Boolean(activeServer && ownedServerIds.includes(activeServer.id));
  const canEditListing = isOwnedServer && Boolean(onUpdateGuildListing);

  // ---------------- Backend listing editor (invite URL + description + category) ----------------
  const [listingDescription, setListingDescription] = useState('');
  const [listingCategory, setListingCategory] = useState('');
  const [listingInvite, setListingInvite] = useState('');
  const [listingDirty, setListingDirty] = useState(false);
  const [savingListing, setSavingListing] = useState(false);
  const [listingSavedAt, setListingSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!activeServer) return;
    setListingDescription(activeServer.description || '');
    setListingCategory(activeServer.tags[0] || activeServer.category.split(' · ')[0] || 'Community');
    setListingInvite(activeServer.discordInviteUrl || '');
    setListingDirty(false);
    setListingSavedAt(null);
  }, [activeServer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const listingInviteValid = listingInvite.trim() === '' || Boolean(normalizeDiscordInvite(listingInvite));
  const canSaveListing = canEditListing && listingDirty && listingInviteValid && !savingListing;

  const handleSaveListing = async () => {
    if (!activeServer || !canSaveListing || !onUpdateGuildListing) return;
    setSavingListing(true);
    try {
      const payload: UpdateGuildPayload = {
        description: listingDescription.trim() || undefined,
        category: listingCategory || undefined,
      };
      const normalized = normalizeDiscordInvite(listingInvite);
      if (normalized && normalized !== activeServer.discordInviteUrl) {
        payload.inviteUrl = normalized;
      }
      await onUpdateGuildListing(activeServer.id, payload);
      setListingDirty(false);
      setListingSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      console.warn('Listing update failed', err);
    } finally {
      setSavingListing(false);
    }
  };

  // Widget customization states
  const [widgetSize, setWidgetSize] = useState<WidgetSize>('banner');
  const [widgetTheme, setWidgetTheme] = useState<WidgetTheme>('discord_dark');
  const [customTagline, setCustomTagline] = useState<string>(
    'Join our community for weekly gaming tournaments, nitro drops, and community dividends!'
  );
  const [showPrice, setShowPrice] = useState(true);
  const [showMembers, setShowMembers] = useState(true);
  const [showAdvantage, setShowAdvantage] = useState(true);
  const [showJoinBtn, setShowJoinBtn] = useState(true);

  // Copy code feedback
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  const themeStyles = {
    discord_dark: {
      bg: 'bg-[#2B2D31]',
      border: 'border-[#1E1F22]',
      text: 'text-white',
      subtext: 'text-[#949BA4]',
      accentBtn: 'bg-[#5865F2] hover:bg-[#4752C4] text-white',
    },
    obsidian: {
      bg: 'bg-[#09090B]',
      border: 'border-[#27272A]',
      text: 'text-[#F4F4F5]',
      subtext: 'text-[#A1A1AA]',
      accentBtn: 'bg-white hover:bg-[#E4E4E7] text-[#09090B]',
    },
    cream_light: {
      bg: 'bg-[#FAF9F6]',
      border: 'border-[#EAE9E4]',
      text: 'text-[#18181B]',
      subtext: 'text-[#71717A]',
      accentBtn: 'bg-[#18181B] hover:bg-[#27272A] text-white',
    },
    emerald: {
      bg: 'bg-[#064E3B]',
      border: 'border-[#047857]',
      text: 'text-white',
      subtext: 'text-[#A7F3D0]',
      accentBtn: 'bg-[#10B981] hover:bg-[#059669] text-white',
    },
    cyber: {
      bg: 'bg-[#1E1B4B]',
      border: 'border-[#4338CA]',
      text: 'text-white',
      subtext: 'text-[#C7D2FE]',
      accentBtn: 'bg-[#6366F1] hover:bg-[#4F46E5] text-white',
    },
  } as const;

  const currentTheme = themeStyles[widgetTheme];

  const handleCopyCode = (format: string, snippet: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(snippet);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2400);
    }
  };

  const handleAddServerClick = () => {
    if (onOpenTokenizeModal) {
      onOpenTokenizeModal();
    } else {
      onSelectTab('Manage');
    }
  };

  // Bump eligibility per card: must be member of CordChain with 1+ shares (owners OK)
  const bumpEligibility = (srv: ServerAsset): { eligible: boolean; reason: string } => {
    const holdsShares = typeof srv.holdings === 'number' && srv.holdings > 0;
    const owned = ownedServerIds.includes(srv.id);
    if (!isLoggedIn) return { eligible: false, reason: 'Sign in with Discord, then hold 1+ share of this server to bump it up the directory' };
    if (!holdsShares && !owned) return { eligible: false, reason: 'Hold at least 1 share of this server stock to unlock bumping' };
    if (bumpPendingId === srv.id) return { eligible: false, reason: 'Bump in progress…' };
    return { eligible: true, reason: 'Bump this server to the top of the directory (+0.4% stock momentum)' };
  };

  const renderBumpButton = (srv: ServerAsset, size: 'sm' | 'lg' = 'sm') => {
    const { eligible, reason } = bumpEligibility(srv);
    const pending = bumpPendingId === srv.id;
    if (!onBumpServer) return null;
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!isLoggedIn) {
            onOpenDiscordLogin();
            return;
          }
          if (eligible) onBumpServer(srv.id);
        }}
        disabled={!eligible || pending}
        title={reason}
        className={`inline-flex items-center justify-center gap-1.5 transition-all ${
          size === 'sm' ? 'px-2.5 h-[30px] rounded-lg text-[11.5px]' : 'px-4 h-[38px] rounded-xl text-[12.5px]'
        } font-semibold ${
          eligible && !pending
            ? 'bg-[#E95F5F] hover:bg-[#DC4C4C] text-white shadow-xs cursor-pointer'
            : 'bg-[#F4F3EE] text-[#A1A1AA] cursor-not-allowed'
        }`}
      >
        <Rocket className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        <span className="font-mono">{srv.bumpCount ?? 0}</span>
      </button>
    );
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 space-y-6 select-none">
      {/* ================================================================= */}
      {/* TOP.GG INSPIRED DISCOVER HEADER BAR & ACTION CORNER */}
      {/* ================================================================= */}
      <div className="bg-white border border-[#EAE9E4] rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#5865F2]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EEF2FF] border border-[#C7D2FE] text-[11px] font-bold text-[#4F46E5]">
              <Compass className="w-3.5 h-3.5" />
              <span>DISCORD COMMUNITY DIRECTORY & EXCHANGE</span>
            </div>
            <h1 className="text-[24px] sm:text-[30px] font-bold tracking-tight text-[#18181B] leading-tight">
              Explore Verified Discord Communities
            </h1>
            <p className="text-[13px] text-[#71717A] leading-relaxed">
              Shareholders bump listings up the directory. Join servers, boost their stock, and trade community shares.
            </p>
          </div>

          {/* SMALL TOP CORNER "ADD SERVER" BUTTON */}
          <button
            onClick={handleAddServerClick}
            className="px-3.5 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-[12px] shadow-sm flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
            title="Add your Discord server to the public listing & tokenize shares"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Server</span>
          </button>
        </div>

        {/* SUBTAB NAVIGATION (DISCOVER DIRECTORY vs PROMOTION STUDIO) */}
        <div className="flex items-center gap-2 pt-4 mt-4 border-t border-[#F4F3EE]">
          <button
            onClick={() => setSubTab('discover')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12.5px] font-semibold transition-all cursor-pointer ${
              subTab === 'discover'
                ? 'bg-[#18181B] text-white shadow-xs'
                : 'text-[#52525B] hover:bg-[#F4F3EF] hover:text-[#18181B]'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Top Communities ({allServers.length})</span>
          </button>

          <button
            onClick={() => setSubTab('studio')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12.5px] font-semibold transition-all cursor-pointer ${
              subTab === 'studio'
                ? 'bg-[#18181B] text-white shadow-xs'
                : 'text-[#52525B] hover:bg-[#F4F3EF] hover:text-[#18181B]'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Listing & Promotion Studio</span>
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MODE 1: TOP.GG STYLE DISCOVER DIRECTORY */}
      {/* ================================================================= */}
      {subTab === 'discover' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* SEARCH, CATEGORIES, & SORTING CONTROLS */}
          <div className="bg-white border border-[#EAE9E4] rounded-2xl p-4 shadow-xs space-y-3.5">
            <div className="relative">
              <Search className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Discord servers by name, $TICKER, game tags, or perks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] text-[#18181B] placeholder-[#A1A1AA] text-[13px] focus:outline-hidden focus:border-[#5865F2] focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#71717A] hover:text-[#18181B] font-semibold"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-[#18181B] text-white font-semibold'
                        : 'bg-[#F4F3EF] text-[#52525B] hover:bg-[#EAE9E4]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11.5px] text-[#71717A] font-medium flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Sort:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-2.5 py-1.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] text-[#18181B] text-[12px] font-medium focus:outline-hidden focus:border-[#5865F2] cursor-pointer"
                >
                  <option value="bump">Recently Bumped (Trending)</option>
                  <option value="gain">Top Gainers (24h Price)</option>
                  <option value="members">Most Members</option>
                  <option value="advantage">Highest Advantage Multiplier</option>
                  <option value="newest">Newest Listings</option>
                </select>
              </div>
            </div>
          </div>

          {/* SERVER LISTINGS (COMPACT TOP.GG STYLE LIST) */}
          {filteredAndSortedServers.length === 0 ? (
            <div className="bg-white border border-dashed border-[#D4D3CD] rounded-3xl p-10 sm:p-12 text-center max-w-xl mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center mx-auto shadow-xs">
                <Store className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-[17px] font-bold text-[#18181B]">
                  {searchQuery || selectedCategory !== 'All'
                    ? 'No Communities Match Your Filters'
                    : 'No Discord Communities Listed Yet'}
                </h3>
                <p className="text-[12.5px] text-[#71717A] leading-relaxed max-w-md mx-auto">
                  {searchQuery || selectedCategory !== 'All'
                    ? 'Try adjusting your search terms or category filter to discover other verified Discord community stocks.'
                    : 'Be the first server owner to list and tokenize your Discord community! Connect your server to auto-calculate your Advantage score and issue tradable community shares.'}
                </p>
              </div>

              <div>
                <button
                  onClick={handleAddServerClick}
                  className="px-4 py-2 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-white font-bold text-[12px] inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Your Server</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredAndSortedServers.map((srv, idx) => {
                const totalM = srv.memberStats?.totalMembers ?? srv.membersCount ?? 0;
                const advantage = srv.advantageMultiplier;
                const bumpedAgo = timeAgoShort(srv.lastBumpedAt);
                const bumpedFresh =
                  srv.lastBumpedAt &&
                  Date.now() - Date.parse(srv.lastBumpedAt) <= BUMP_FRESH_WINDOW_MS;
                const isJoined = joinedServers.includes(srv.id);
                const inviteUrl = srv.discordInviteUrl;

                return (
                  <div
                    key={srv.id}
                    onClick={() => onSelectServerForTrade(srv.id)}
                    className="bg-white border border-[#EAE9E4] hover:border-[#5865F2]/40 rounded-2xl p-3.5 transition-all hover:shadow-md cursor-pointer flex flex-col justify-between gap-2.5 group"
                  >
                    {/* Row 1: Icon, Names, League */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <ServerIcon id={srv.id} variant="table" />
                          {bumpedFresh && (
                            <span className="absolute -top-1.5 -right-1.5 px-1 py-0.5 rounded-full bg-[#E95F5F] text-white text-[8px] font-bold uppercase tracking-wide flex items-center gap-0.5">
                              <Flame className="w-2 h-2" />
                              <span>Bump</span>
                            </span>
                          )}
                          <span className="absolute -bottom-1 -right-1 px-1 py-[1px] rounded-full bg-[#18181B] text-white text-[8px] font-bold font-mono">
                            #{idx + 1}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-[13.5px] text-[#18181B] truncate group-hover:text-[#5865F2] transition-colors">
                              {srv.name}
                            </h4>
                            {ownedServerIds.includes(srv.id) && (
                              <span title="You own this server" className="shrink-0">
                                <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[10.5px]">
                            <span className="font-bold text-[#5865F2]">{srv.ticker}</span>
                            <span className="text-[#71717A] inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                              {(srv.memberStats?.onlineMembers ?? Math.max(1, Math.round(totalM * 0.35))).toLocaleString()} online
                            </span>
                          </div>
                        </div>
                      </div>
                      <LeagueBadge league={srv.league} />
                    </div>

                    {/* Row 2: Inline compact meta */}
                    <p className="text-[11px] text-[#71717A] flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {totalM.toLocaleString()} members
                      </span>
                      <span className="text-[#D4D3CD]">·</span>
                      <span className="font-semibold text-[#18181B]">${fmtPoints(srv.priceUsd)}</span>
                      <span className={`font-mono font-semibold ${srv.change24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {srv.change24h >= 0 ? '+' : ''}
                        {srv.change24h.toFixed(1)}%
                      </span>
                      {advantage && (
                        <>
                          <span className="text-[#D4D3CD]">·</span>
                          <span className="text-[#4F46E5] font-semibold font-mono">{advantage.toFixed(2)}x adv</span>
                        </>
                      )}
                      {bumpedAgo && (
                        <>
                          <span className="text-[#D4D3CD]">·</span>
                          <span className="text-[#E95F5F] font-semibold">bumped {bumpedAgo}</span>
                        </>
                      )}
                    </p>

                    {/* Row 3: One-line description */}
                    <p className="text-[11.5px] text-[#52525B] truncate leading-relaxed">
                      {srv.description || `${srv.name} Discord community stock on CordChain.`}
                    </p>

                    {/* Row 4: Tag pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded-md bg-[#FAF9F6] border border-[#EAE9E4] text-[9.5px] font-semibold text-[#52525B]">
                        {srv.category}
                      </span>
                      {srv.tags.slice(0, 2).map((t) => (
                        <span
                          key={t}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCategory(t);
                          }}
                          className="px-1.5 py-0.5 rounded-md bg-[#FAF9F6] border border-[#EAE9E4] text-[9.5px] text-[#71717A] hover:text-[#18181B] hover:border-[#18181B] transition-colors cursor-pointer"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>

                    {/* Row 5: Action strip — Join / Bump / Boost / Trade */}
                    <div className="pt-2.5 border-t border-[#F3F2EE] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {inviteUrl ? (
                          <a
                            href={inviteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-3 h-[30px] rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-[11.5px] font-semibold transition-colors cursor-pointer"
                            title={`Join the ${srv.name} Discord server`}
                          >
                            <DiscordLogo className="w-3 h-3 fill-current" />
                            <span>{isJoined ? 'Rejoin' : 'Join'}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                          </a>
                        ) : onToggleJoinServer ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleJoinServer(srv.id);
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 h-[30px] rounded-lg text-[11.5px] font-semibold transition-colors cursor-pointer ${
                              isJoined
                                ? 'bg-[#18181B] text-white'
                                : 'bg-white border border-[#E4E3DE] text-[#27272A] hover:bg-[#F5F4F0]'
                            }`}
                            title={inviteUrl ? 'Join via Discord invite' : 'Track this community'}
                          >
                            <Check className="w-3 h-3" />
                            <span>{isJoined ? 'Joined' : 'Track'}</span>
                          </button>
                        ) : null}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenBoostModal(srv.ticker);
                          }}
                          className="p-[7px] rounded-lg border border-[#EAE9E4] hover:bg-[#F4F3EE] text-[#52525B] hover:text-[#18181B] transition-colors cursor-pointer"
                          title={`Boost $${srv.ticker.replace('$', '')} — watch a sponsored ad for +250 $CRED & stock momentum`}
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>

                        {renderBumpButton(srv)}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectServerForTrade(srv.id);
                        }}
                        className="px-3 h-[30px] rounded-lg bg-[#18181B] text-white hover:bg-[#27272A] text-[11.5px] font-bold transition-all cursor-pointer shadow-xs shrink-0"
                      >
                        Trade
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* MODE 2: LISTING SETTINGS & PROMOTION STUDIO */}
      {/* ================================================================= */}
      {subTab === 'studio' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {allServers.length === 0 ? (
            <div className="bg-white border border-dashed border-[#D4D3CD] rounded-3xl p-10 text-center max-w-md mx-auto space-y-3">
              <Store className="w-10 h-10 text-[#A1A1AA] mx-auto" />
              <h3 className="text-[16px] font-bold text-[#18181B]">No Community Stocks Available</h3>
              <p className="text-[12px] text-[#71717A]">
                You must tokenize or list a Discord server before customising its listing and generating promotional widgets.
              </p>
              <button
                onClick={handleAddServerClick}
                className="px-4 py-2 rounded-xl bg-[#5865F2] text-white text-[12.5px] font-bold hover:bg-[#4752C4] cursor-pointer"
              >
                + Add Server to Listing
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT COLUMN: LISTING SETTINGS (OWNERS ONLY) + CONTROLS */}
              <div className="lg:col-span-5 space-y-5">
                {/* ---- Listing settings ---- */}
                <div className="bg-white border border-[#EAE9E4] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
                  <div>
                    <h3 className="text-[15.5px] font-bold text-[#18181B] flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-[#5865F2]" />
                      <span>Listing Settings</span>
                    </h3>
                    <p className="text-[12px] text-[#71717A] mt-0.5">
                      {canEditListing
                        ? `Edit how ${activeServer?.name} appears in the public directory.`
                        : 'Only the verified Discord server owner can edit a listing.'}
                    </p>
                  </div>

                  {/* Owner selector */}
                  <div>
                    <label className="block text-[11.5px] font-medium text-[#52525B] mb-1.5">Server listing</label>
                    <select
                      value={selectedServerId}
                      onChange={(e) => setSelectedServerId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] text-[#18181B] text-[12.5px] font-medium cursor-pointer focus:outline-hidden focus:border-[#5865F2]"
                    >
                      {allServers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.ticker} — {s.name} (${fmtPoints(s.priceUsd)}){ownedServerIds.includes(s.id) ? ' · yours' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {canEditListing ? (
                    <div className="space-y-3.5">
                      {/* Invite URL */}
                      <div>
                        <label className="block text-[11.5px] font-medium text-[#52525B] mb-1.5">
                          Discord Invite Link <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={listingInvite}
                            onChange={(e) => {
                              setListingInvite(e.target.value);
                              setListingDirty(true);
                            }}
                            placeholder="https://discord.gg/your-permanent-invite"
                            className={`w-full px-3 py-2 rounded-xl border bg-[#FAF9F6] text-[12px] focus:outline-hidden transition-colors ${
                              listingInvite && !listingInviteValid
                                ? 'border-red-300 focus:border-red-500'
                                : 'border-[#EAE9E4] focus:border-[#5865F2]'
                            }`}
                          />
                        </div>
                        {listingInvite && !listingInviteValid && (
                          <p className="text-[10.5px] text-red-500 mt-1 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            Must be a public invite: discord.gg/..., discord.com/invite/... or dsc.gg/...
                          </p>
                        )}
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-[11.5px] font-medium text-[#52525B] mb-1.5">Listing description</label>
                        <textarea
                          value={listingDescription}
                          onChange={(e) => {
                            setListingDescription(e.target.value);
                            setListingDirty(true);
                          }}
                          rows={2}
                          maxLength={280}
                          className="w-full px-3 py-2 rounded-xl border border-[#EAE9E4] bg-[#FAF9F6] text-[12px] focus:outline-hidden focus:border-[#5865F2] resize-none"
                        />
                        <p className="text-[10px] text-[#A1A1AA] mt-0.5 text-right">{listingDescription.length}/280</p>
                      </div>

                      {/* Category */}
                      <div>
                        <label className="block text-[11.5px] font-medium text-[#52525B] mb-1.5">Category</label>
                        <select
                          value={listingCategory}
                          onChange={(e) => {
                            setListingCategory(e.target.value);
                            setListingDirty(true);
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] text-[12px] cursor-pointer focus:outline-hidden focus:border-[#5865F2]"
                        >
                          {categories.filter((c) => c !== 'All').map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={handleSaveListing}
                        disabled={!canSaveListing}
                        className={`w-full h-[38px] rounded-xl text-[12.5px] font-bold inline-flex items-center justify-center gap-2 transition-all ${
                          canSaveListing
                            ? 'bg-[#18181B] hover:bg-[#27272A] text-white cursor-pointer'
                            : 'bg-[#F4F3EE] text-[#A1A1AA] cursor-not-allowed'
                        }`}
                      >
                        <Save className="w-4 h-4" />
                        <span>{savingListing ? 'Saving listing…' : 'Save Listing'}</span>
                      </button>
                      {listingSavedAt && (
                        <p className="text-[11px] text-[#10B981] font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Listing updated at {listingSavedAt}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-[#F9F9F7] border border-[#EAE9E4] rounded-xl p-4 flex items-start gap-3">
                      <Lock className="w-4 h-4 text-[#71717A] shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <p className="text-[12px] text-[#52525B] leading-relaxed">
                          {isLoggedIn
                            ? `You do not own ${activeServer?.ticker}. Only the verified Discord server owner can edit this listing.`
                            : 'Sign in with the Discord account that owns this server to edit its listing.'}
                        </p>
                        {!isLoggedIn && (
                          <button
                            onClick={onOpenDiscordLogin}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-[12px] font-bold transition-colors cursor-pointer"
                          >
                            <DiscordLogo className="w-3.5 h-3.5 fill-current" />
                            <span>Sign in with Discord</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bump block */}
                  {activeServer && onBumpServer && (
                    <div className="bg-red-50/60 border border-red-100 rounded-xl p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[12px] font-bold text-[#B91C1C] flex items-center gap-1.5">
                          <Rocket className="w-3.5 h-3.5" />
                          <span>Community bumps: {activeServer.bumpCount ?? 0}</span>
                        </p>
                        <p className="text-[11px] text-[#7F1D1D]/70 mt-0.5">
                          {bumpedAgoText(activeServer.lastBumpedAt)}
                        </p>
                      </div>
                      {renderBumpButton(activeServer, 'lg')}
                    </div>
                  )}
                </div>

                {/* ---- Widget generator controls ---- */}
                <div className="bg-white border border-[#EAE9E4] rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
                  <div>
                    <h3 className="text-[15.5px] font-bold text-[#18181B]">Widget Generator</h3>
                    <p className="text-[12px] text-[#71717A]">
                      Promotional cards for {activeServer?.name || 'your community'} to share on Discord and the web.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-medium text-[#52525B] mb-1.5">
                      1. Component Format & Size
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'banner', label: 'Hero Banner', size: '800 × 260' },
                        { id: 'card', label: 'Server Card', size: '460 × 260' },
                        { id: 'pill', label: 'Compact Pill', size: '360 × 68' },
                        { id: 'embed', label: 'Discord Embed', size: 'Native Bot' },
                        { id: 'leaderboard', label: 'Rank Widget', size: '320 × 300' },
                      ].map((fmt) => (
                        <button
                          key={fmt.id}
                          onClick={() => setWidgetSize(fmt.id as WidgetSize)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            widgetSize === fmt.id
                              ? 'bg-[#18181B] text-white border-[#18181B] shadow-xs'
                              : 'bg-white hover:bg-[#FAF9F6] border-[#EAE9E4] text-[#18181B]'
                          }`}
                        >
                          <p className="text-[11.5px] font-bold truncate">{fmt.label}</p>
                          <p className={`text-[9.5px] ${widgetSize === fmt.id ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
                            {fmt.size}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-medium text-[#52525B] mb-1.5">
                      2. Color Palette & Theme
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'discord_dark', label: 'Discord Dark', color: '#5865F2' },
                        { id: 'obsidian', label: 'Obsidian Night', color: '#18181B' },
                        { id: 'cream_light', label: 'Cordchain Light', color: '#F7F6F3' },
                        { id: 'emerald', label: 'Emerald Alpha', color: '#10B981' },
                        { id: 'cyber', label: 'Cyber Indigo', color: '#6366F1' },
                      ].map((th) => (
                        <button
                          key={th.id}
                          onClick={() => setWidgetTheme(th.id as WidgetTheme)}
                          className={`p-2 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                            widgetTheme === th.id
                              ? 'bg-[#18181B] text-white border-[#18181B] shadow-xs font-semibold'
                              : 'bg-white hover:bg-[#FAF9F6] border-[#EAE9E4] text-[#52525B]'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: th.color }} />
                          <span className="text-[11px] truncate">{th.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-medium text-[#52525B] mb-1.5">
                      3. Custom Promo Headline
                    </label>
                    <input
                      type="text"
                      value={customTagline}
                      onChange={(e) => setCustomTagline(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] text-[#18181B] text-[12px] focus:outline-hidden focus:border-[#5865F2]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-medium text-[#52525B] mb-1.5">
                      4. Component Features
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                      <label className="flex items-center gap-2 p-2 rounded-lg border border-[#EAE9E4] cursor-pointer hover:bg-[#FAF9F6]">
                        <input
                          type="checkbox"
                          checked={showPrice}
                          onChange={(e) => setShowPrice(e.target.checked)}
                          className="rounded accent-[#18181B]"
                        />
                        <span>Show Live Stock Price</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-lg border border-[#EAE9E4] cursor-pointer hover:bg-[#FAF9F6]">
                        <input
                          type="checkbox"
                          checked={showJoinBtn}
                          onChange={(e) => setShowJoinBtn(e.target.checked)}
                          className="rounded accent-[#18181B]"
                        />
                        <span>Show Join Server Button</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-lg border border-[#EAE9E4] cursor-pointer hover:bg-[#FAF9F6]">
                        <input
                          type="checkbox"
                          checked={showMembers}
                          onChange={(e) => setShowMembers(e.target.checked)}
                          className="rounded accent-[#18181B]"
                        />
                        <span>Show Member Stats</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-lg border border-[#EAE9E4] cursor-pointer hover:bg-[#FAF9F6]">
                        <input
                          type="checkbox"
                          checked={showAdvantage}
                          onChange={(e) => setShowAdvantage(e.target.checked)}
                          className="rounded accent-[#18181B]"
                        />
                        <span>Show Advantage Multiplier</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: LIVE COMPONENT PREVIEW & EXPORT CODE */}
              <div className="lg:col-span-7 space-y-5">
                <div className="bg-white border border-[#EAE9E4] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#F4F3EE]">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-[#5865F2]" />
                      <h4 className="font-bold text-[14px] text-[#18181B]">Live Component Preview</h4>
                    </div>
                    <span className="text-[11px] text-[#71717A] uppercase font-mono">
                      {widgetSize} · {widgetTheme.replace('_', ' ')}
                    </span>
                  </div>

                  {activeServer && (
                    <div className={`p-6 rounded-2xl ${currentTheme.bg} ${currentTheme.border} border transition-all shadow-sm`}>
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <ServerIcon id={activeServer.id} variant="table" />
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`text-[17px] font-bold ${currentTheme.text}`}>
                                {activeServer.name}
                              </h3>
                              <span className="px-2 py-0.5 rounded-full bg-[#18181B]/30 text-[10.5px] font-bold font-mono">
                                {activeServer.ticker}
                              </span>
                            </div>
                            <p className={`text-[12px] ${currentTheme.subtext} mt-0.5 max-w-md`}>
                              {customTagline}
                            </p>
                          </div>
                        </div>

                        <LeagueBadge league={activeServer.league} />
                      </div>

                      <div className="flex items-center gap-4 py-3 my-3 border-y border-white/10 text-[12px]">
                        {showPrice && (
                          <div>
                            <span className={`block text-[10px] uppercase ${currentTheme.subtext}`}>Share Price</span>
                            <span className={`font-mono font-bold text-[16px] ${currentTheme.text}`}>
                              ${fmtPoints(activeServer.priceUsd)}
                            </span>
                          </div>
                        )}
                        {showMembers && (
                          <div>
                            <span className={`block text-[10px] uppercase ${currentTheme.subtext}`}>Members</span>
                            <span className={`font-mono font-bold text-[14px] ${currentTheme.text}`}>
                              {(activeServer.memberStats?.totalMembers ?? activeServer.membersCount ?? 0).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {showAdvantage && (
                          <div>
                            <span className={`block text-[10px] uppercase ${currentTheme.subtext}`}>Advantage</span>
                            <span className="font-mono font-bold text-[14px] text-[#10B981]">
                              {(activeServer.advantageMultiplier ?? 1.15).toFixed(2)}x
                            </span>
                          </div>
                        )}
                        {showJoinBtn && activeServer.bumpCount ? (
                          <div>
                            <span className={`block text-[10px] uppercase ${currentTheme.subtext}`}>Bumps</span>
                            <span className="font-mono font-bold text-[14px] text-[#FCA5A5]">
                              {activeServer.bumpCount}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className={`text-[10px] ${currentTheme.subtext}`}>Powered by CordChain Protocol</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onSelectServerForTrade(activeServer.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-[12px] transition-colors cursor-pointer"
                          >
                            Trade Stock
                          </button>
                          {showJoinBtn && (
                            <button
                              onClick={() => {
                                if (activeServer.discordInviteUrl) {
                                  window.open(activeServer.discordInviteUrl, '_blank');
                                }
                              }}
                              disabled={!activeServer.discordInviteUrl}
                              title={
                                activeServer.discordInviteUrl
                                  ? 'Open the Discord invite'
                                  : 'No public invite link on this listing yet'
                              }
                              className={`px-3.5 py-1.5 rounded-xl ${currentTheme.accentBtn} font-bold text-[12px] transition-colors flex items-center gap-1.5 ${
                                activeServer.discordInviteUrl ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
                              }`}
                            >
                              <DiscordLogo className="w-3.5 h-3.5 fill-current" />
                              <span>Join Server</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* One-Click Export Code Snippets */}
                  <div className="pt-4 border-t border-[#F4F3EE] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-bold text-[#18181B] flex items-center gap-1.5">
                        <Code2 className="w-4 h-4 text-[#5865F2]" />
                        <span>One-Click Export Code</span>
                      </span>
                      {activeServer?.discordInviteUrl && (
                        <button
                          onClick={() => handleCopyCode('invite', activeServer.discordInviteUrl!)}
                          className="text-[11.5px] text-[#5865F2] hover:text-[#4752C4] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedFormat === 'invite' ? 'Invite copied!' : 'Copy invite link'}</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                      <button
                        onClick={() =>
                          handleCopyCode(
                            'html',
                            `<iframe src="https://cordchain.app/embed/${activeServer?.id}?theme=${widgetTheme}&size=${widgetSize}" width="100%" height="220" frameborder="0"></iframe>`
                          )
                        }
                        className="p-3 rounded-xl border border-[#EAE9E4] hover:border-[#18181B] bg-[#FAF9F6] text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between font-bold text-[#18181B] mb-1">
                          <span>HTML & Website Embed</span>
                          {copiedFormat === 'html' ? (
                            <Check className="w-3.5 h-3.5 text-[#10B981]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-[#71717A]" />
                          )}
                        </div>
                        <p className="text-[10.5px] text-[#71717A]">
                          {copiedFormat === 'html' ? 'Copied to clipboard!' : 'Copy iframe code for websites & docs'}
                        </p>
                      </button>

                      <button
                        onClick={() =>
                          handleCopyCode(
                            'markdown',
                            `[![${activeServer?.name}](https://cordchain.app/api/badge/${activeServer?.id}.svg)](https://cordchain.app/trade/${activeServer?.ticker})`
                          )
                        }
                        className="p-3 rounded-xl border border-[#EAE9E4] hover:border-[#18181B] bg-[#FAF9F6] text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between font-bold text-[#18181B] mb-1">
                          <span>GitHub Markdown Badge</span>
                          {copiedFormat === 'markdown' ? (
                            <Check className="w-3.5 h-3.5 text-[#10B981]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-[#71717A]" />
                          )}
                        </div>
                        <p className="text-[10.5px] text-[#71717A]">
                          {copiedFormat === 'markdown' ? 'Copied to clipboard!' : 'Copy badge for README.md'}
                        </p>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Owner quick actions */}
                <div className="bg-white border border-[#EAE9E4] rounded-2xl p-5 shadow-xs">
                  <h4 className="font-bold text-[14px] text-[#18181B] mb-3 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-[#5865F2]" />
                    <span>More promotion tools</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      onClick={() => onSelectTab('Exchange')}
                      className="p-3 rounded-xl border border-[#EAE9E4] hover:border-[#18181B] bg-[#FAF9F6] text-left transition-colors cursor-pointer"
                    >
                      <p className="font-bold text-[12.5px] text-[#18181B]">Open Exchange</p>
                      <p className="text-[10.5px] text-[#71717A] mt-0.5">Track your listing order book</p>
                    </button>
                    <button
                      onClick={handleAddServerClick}
                      className="p-3 rounded-xl border border-[#EAE9E4] hover:border-[#18181B] bg-[#FAF9F6] text-left transition-colors cursor-pointer"
                    >
                      <p className="font-bold text-[12.5px] text-[#18181B]">List Another Server</p>
                      <p className="text-[10.5px] text-[#71717A] mt-0.5">Tokenize a second community</p>
                    </button>
                    <button
                      onClick={() => onSelectTab('Manage')}
                      className="p-3 rounded-xl border border-[#EAE9E4] hover:border-[#18181B] bg-[#FAF9F6] text-left transition-colors cursor-pointer"
                    >
                      <p className="font-bold text-[12.5px] text-[#18181B]">Manage Stock Params</p>
                      <p className="text-[10.5px] text-[#71717A] mt-0.5">Splits, supply & bot settings</p>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const bumpedAgoText = (iso?: string): string => {
  const ago = timeAgoShort(iso);
  return ago ? `Last bumped ${ago} — bumps place the server at the top of the directory` : 'Not bumped yet — bumps place the server at the top of the directory';
};
