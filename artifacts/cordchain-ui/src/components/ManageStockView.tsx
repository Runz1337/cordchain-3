import React, { useState, useMemo, useEffect } from 'react';
import {
  Store,
  Sliders,
  DollarSign,
  Users,
  Coins,
  ShieldCheck,
  Plus,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  PieChart,
  Megaphone,
  Zap,
  Sparkles,
  Copy,
  Activity,
  Trash2,
  AlertTriangle,
  X,
  ExternalLink,
  Tag,
  Check,
  Wallet,
  Globe,
} from 'lucide-react';
import { OwnedServerStock, MainTab } from '../types';
import { DiscordLogo, ServerIcon } from './Icons';
import { calculateCommunityAdvantage, generateServerMemberStats } from '../lib/advantageEngine';
import { UpdateGuildPayload } from '../lib/api';
import { shortenAddress } from '../lib/blockchain';

interface ManageStockViewProps {
  ownedServer: OwnedServerStock | null;
  ownedServers?: OwnedServerStock[];
  selectedServerId?: string;
  onSelectOwnedServer?: (guildId: string) => void;
  onUpdateOwnedServer: (guildId: string, updated: UpdateGuildPayload) => Promise<void>;
  onDeleteOwnedServer: (guildId: string) => Promise<void>;
  onOpenTokenizeModal: () => void;
  onSelectTab: (tab: MainTab) => void;
  onTriggerToast: (msg: string) => void;
}

export const ManageStockView: React.FC<ManageStockViewProps> = ({
  ownedServer,
  ownedServers = [],
  selectedServerId,
  onSelectOwnedServer,
  onUpdateOwnedServer,
  onDeleteOwnedServer,
  onOpenTokenizeModal,
  onSelectTab,
  onTriggerToast,
}) => {
  const [activeSection, setActiveSection] = useState<
    'overview' | 'community' | 'dividends' | 'issuance' | 'bot' | 'danger'
  >('overview');
  const [communityTab, setCommunityTab] = useState<'cordchain' | 'discord'>('cordchain');

  // Form states for Identity & Parameters
  const [nameInput, setNameInput] = useState('');
  const [tickerInput, setTickerInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('Community');

  // Dividend sliders
  const [shareholdersSplit, setShareholdersSplit] = useState(60);
  const [treasurySplit, setTreasurySplit] = useState(25);
  const [ownerSplit, setOwnerSplit] = useState(15);
  const [boostMultiplier, setBoostMultiplier] = useState(1.05);
  const [adEnabled, setAdEnabled] = useState(true);

  // Secondary offering form
  const [additionalShares, setAdditionalShares] = useState('10000');
  const [offeringPrice, setOfferingPrice] = useState('25.00');

  // Action status
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Sync state whenever ownedServer changes
  useEffect(() => {
    if (ownedServer) {
      setNameInput(ownedServer.serverName || '');
      setTickerInput(ownedServer.ticker || '');
      setDescriptionInput(ownedServer.description || '');
      setCategoryInput(ownedServer.category || 'Community');
      setShareholdersSplit(ownedServer.dividendSplitShareholders ?? 60);
      setTreasurySplit(ownedServer.dividendSplitTreasury ?? 25);
      setOwnerSplit(ownedServer.dividendSplitOwner ?? 15);
      setBoostMultiplier(ownedServer.boostRewardMultiplier ?? 1.05);
      setAdEnabled(ownedServer.adMonetizationEnabled ?? true);
      setOfferingPrice(String(ownedServer.currentPriceInr || 25));
    }
  }, [ownedServer?.serverId, ownedServer?.ticker, ownedServer?.serverName]);

  const memberStats = useMemo(() => {
    if (!ownedServer) return null;
    if (ownedServer.memberStats) return ownedServer.memberStats;
    return generateServerMemberStats(ownedServer.serverId, ownedServer.membersCount);
  }, [ownedServer]);

  const advantage = useMemo(() => {
    if (!memberStats) return { multiplier: 1.0, breakdown: null };
    return calculateCommunityAdvantage(
      memberStats.cordchainAffiliatedMembers,
      memberStats.activeDailyMembers,
      memberStats.onlineMembers,
      memberStats.totalMembers
    );
  }, [memberStats]);

  // Handle Save Identity / Overview
  const handleSaveOverview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownedServer) return;

    let cleanTicker = tickerInput.trim().toUpperCase();
    if (!cleanTicker.startsWith('$')) cleanTicker = `$${cleanTicker}`;
    if (cleanTicker.length < 3 || cleanTicker.length > 9) {
      onTriggerToast('Ticker must be 2 to 8 alphanumeric characters (e.g. $GUILD).');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateOwnedServer(ownedServer.serverId, {
        name: nameInput.trim() || ownedServer.serverName,
        ticker: cleanTicker,
        description: descriptionInput.trim(),
        category: categoryInput.trim(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Save Dividends & Monetization
  const handleSaveDividends = async () => {
    if (!ownedServer) return;
    const total = shareholdersSplit + treasurySplit + ownerSplit;
    if (total !== 100) {
      onTriggerToast(`Dividend splits must sum to exactly 100% (currently ${total}%)`);
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateOwnedServer(ownedServer.serverId, {
        dividendSplitShareholders: shareholdersSplit,
        dividendSplitTreasury: treasurySplit,
        dividendSplitOwner: ownerSplit,
        boostRewardMultiplier: boostMultiplier,
        adMonetizationEnabled: adEnabled,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Secondary Share Issuance
  const handleIssueShares = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownedServer) return;
    const qty = Number(additionalShares) || 0;
    if (qty <= 0) {
      onTriggerToast('Please enter a valid number of shares to issue.');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateOwnedServer(ownedServer.serverId, {
        additionalShares: qty,
      });
      setAdditionalShares('');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Token Delist & Delete
  const handleConfirmDelete = async () => {
    if (!ownedServer) return;
    const expected = ownedServer.ticker.toUpperCase();
    if (deleteConfirmText.trim().toUpperCase() !== expected) {
      onTriggerToast(`Please type ${expected} exactly to confirm permanent deletion.`);
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteOwnedServer(ownedServer.serverId);
      setShowDeleteModal(false);
      setDeleteConfirmText('');
    } catch {
      // error handled in parent
    } finally {
      setIsDeleting(false);
    }
  };

  // =========================================================================
  // EMPTY STATE: User does not own any tokenized servers
  // =========================================================================
  if (!ownedServer || ownedServers.length === 0) {
    return (
      <div className="max-w-[1440px] mx-auto px-5 py-10 select-none">
        <div className="max-w-2xl mx-auto bg-white border border-[#EAE9E4] rounded-3xl p-8 sm:p-12 text-center shadow-xs space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#F4F3EE] border border-[#EAE9E4] flex items-center justify-center text-[#18181B] mx-auto shadow-2xs">
            <Store className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-[22px] sm:text-[24px] font-bold text-[#18181B] tracking-tight">
              No Tokenized Discord Servers
            </h1>
            <p className="text-[13.5px] text-[#71717A] max-w-md mx-auto leading-relaxed">
              Servers are never auto-tokenized on Cordchain. As a verified Discord server owner, you have exclusive rights to tokenize your community and issue tradable community shares.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={onOpenTokenizeModal}
              className="px-6 py-3 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-white text-[13.5px] font-semibold inline-flex items-center gap-2 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tokenize a Server You Own</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-[#F4F3EE] text-left">
            <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center font-bold text-[12px]">
                1
              </div>
              <h3 className="text-[13px] font-bold text-[#18181B]">CordLedger AMM</h3>
              <p className="text-[11.5px] text-[#71717A] leading-normal">
                Deploy an ERC-20 token with continuous liquidity backed by an automated market maker.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-[#F0FDF4] text-[#15803D] flex items-center justify-center font-bold text-[12px]">
                2
              </div>
              <h3 className="text-[13px] font-bold text-[#18181B]">Ad Revenue Dividends</h3>
              <p className="text-[11.5px] text-[#71717A] leading-normal">
                Earn daily dividends distributed automatically between your treasury and community shareholders.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-[#FFFBEB] text-[#B45309] flex items-center justify-center font-bold text-[12px]">
                3
              </div>
              <h3 className="text-[13px] font-bold text-[#18181B]">Advantage Multiplier</h3>
              <p className="text-[11.5px] text-[#71717A] leading-normal">
                Scale your stock valuation higher as more Discord members participate on Cordchain.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ACTIVE STATE: User has at least 1 tokenized server
  // =========================================================================
  return (
    <div className="max-w-[1440px] mx-auto px-5 py-6 space-y-6 select-none">
      {/* Top Multi-Server Switcher (if user owns more than 1 server) */}
      {ownedServers.length > 1 && (
        <div className="bg-white border border-[#EAE9E4] rounded-2xl p-2.5 flex items-center justify-between gap-3 overflow-x-auto shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-[#71717A] px-2 shrink-0">
              Your Tokenized Servers:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {ownedServers.map((srv) => {
                const isSelected = srv.serverId === ownedServer.serverId;
                return (
                  <button
                    key={srv.serverId}
                    onClick={() => onSelectOwnedServer && onSelectOwnedServer(srv.serverId)}
                    className={`px-3 py-1.5 rounded-xl text-[12px] font-medium inline-flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#18181B] text-white font-semibold shadow-2xs'
                        : 'bg-[#FAF9F6] border border-[#EAE9E4] text-[#18181B] hover:bg-[#F4F3EE]'
                    }`}
                  >
                    <ServerIcon id={srv.serverId} variant="table" className="w-4 h-4 rounded" />
                    <span>{srv.ticker}</span>
                    <span className="text-[10.5px] opacity-75">${srv.currentPriceInr.toFixed(2)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={onOpenTokenizeModal}
            className="px-3 py-1.5 rounded-xl border border-[#EAE9E4] bg-white hover:bg-[#F4F3EE] text-[#18181B] text-[11.5px] font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tokenize Another</span>
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Store className="w-5 h-5 text-[#5865F2]" />
            <h1 className="text-[24px] font-bold text-[#18181B] tracking-tight">
              Manage Server Stock & Listing
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#4F46E5] text-[11px] font-semibold">
              {ownedServer.ticker}
            </span>
          </div>
          <p className="text-[13px] text-[#71717A]">
            Configure token parameters, manage ad revenue dividend splits, secondary share offerings, and community governance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenTokenizeModal}
            className="px-4 py-2 rounded-xl bg-white border border-[#EAE9E4] hover:bg-[#F8F7F4] text-[12.5px] font-semibold text-[#18181B] inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tokenize Another Server</span>
          </button>

          <button
            onClick={() => onSelectTab('Exchange')}
            className="px-4 py-2 rounded-xl bg-[#141416] hover:bg-[#27272A] text-white text-[12.5px] font-semibold inline-flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <span>Trade on Market</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top 4 Server Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#EAE9E4] rounded-2xl p-4.5 shadow-2xs">
          <p className="text-[11.5px] text-[#71717A] mb-1">Stock Ticker & Guild</p>
          <div className="flex items-center gap-2.5 mt-1">
            <ServerIcon id={ownedServer.serverId} variant="header" className="w-9 h-9 rounded-xl" />
            <div className="min-w-0">
              <p className="text-[17px] font-bold text-[#18181B] leading-tight truncate">
                {ownedServer.ticker}
              </p>
              <p className="text-[11px] text-[#71717A] truncate">{ownedServer.serverName}</p>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#F3F2EE] flex items-center justify-between text-[11.5px]">
            <span className="text-[#71717A]">Discord Members:</span>
            <span className="font-semibold text-[#18181B]">
              {ownedServer.membersCount.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#EAE9E4] rounded-2xl p-4.5 shadow-2xs">
          <p className="text-[11.5px] text-[#71717A] mb-1">Current Stock Price</p>
          <p className="text-[24px] font-bold font-mono text-[#18181B] tabular-nums">
            ${ownedServer.currentPriceInr.toFixed(2)}
          </p>
          <p className="text-[11.5px] font-medium text-[#10B981] flex items-center gap-1 mt-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Listing Price: ${ownedServer.initialIpoPriceInr.toFixed(2)}</span>
          </p>
        </div>

        <div className="bg-white border border-[#EAE9E4] rounded-2xl p-4.5 shadow-2xs">
          <p className="text-[11.5px] text-[#71717A] mb-1">Server Treasury Reserve</p>
          <p className="text-[24px] font-bold font-mono text-[#18181B] tabular-nums">
            {ownedServer.treasuryReserve.toLocaleString()}{' '}
            <span className="text-[13px] font-normal text-[#71717A]">shares</span>
          </p>
          <p className="text-[11.5px] text-[#71717A] mt-1">
            Owner Wallet:{' '}
            <span className="font-semibold text-[#18181B] font-mono">
              ${ownedServer.treasuryBalanceInr.toFixed(2)}
            </span>
          </p>
        </div>

        <div className="bg-white border border-[#EAE9E4] rounded-2xl p-4.5 shadow-2xs">
          <p className="text-[11.5px] text-[#71717A] mb-1">Community Advantage</p>
          <p className="text-[24px] font-bold font-mono text-[#4F46E5] tabular-nums">
            {advantage.multiplier.toFixed(2)}x
          </p>
          <p className="text-[11.5px] text-[#71717A] mt-1 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-[#EAB308]" />
            <span>Boosts trade volume & valuation</span>
          </p>
        </div>
      </div>

      {/* Main Workspace: Left Tabs + Right Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Navigation Rail */}
        <aside className="lg:col-span-3 space-y-1">
          {[
            { id: 'overview' as const, label: 'Overview & Ticker Settings', icon: <PieChart className="w-4 h-4" /> },
            { id: 'community' as const, label: 'Community & Advantage', icon: <Zap className="w-4 h-4" /> },
            { id: 'dividends' as const, label: 'Ad Revenue & Dividends', icon: <DollarSign className="w-4 h-4" /> },
            { id: 'issuance' as const, label: 'Secondary Share Issuance', icon: <Coins className="w-4 h-4" /> },
            { id: 'bot' as const, label: 'Discord Bot & Ad Spaces', icon: <DiscordLogo className="w-4 h-4" /> },
            {
              id: 'danger' as const,
              label: 'Delist & Delete Token',
              icon: <Trash2 className="w-4 h-4 text-[#EF4444]" />,
              danger: true,
            },
          ].map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] transition-colors cursor-pointer text-left ${
                  item.danger
                    ? isActive
                      ? 'bg-[#FEF2F2] text-[#DC2626] font-semibold border border-[#FECACA]'
                      : 'text-[#DC2626] hover:bg-[#FEF2F2]/60 hover:text-[#B91C1C]'
                    : isActive
                    ? 'bg-[#EFECE6] text-[#18181B] font-semibold'
                    : 'text-[#52525B] hover:bg-[#EFECE6]/50 hover:text-[#18181B]'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Content Box */}
        <main className="lg:col-span-9 bg-white border border-[#EAE9E4] rounded-2xl p-6 sm:p-7 space-y-6 shadow-xs">
          {/* ================================================================= */}
          {/* SECTION 1: OVERVIEW & TICKER SETTINGS */}
          {/* ================================================================= */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[16px] font-semibold text-[#18181B]">
                  Token Identity & Cap Table
                </h2>
                <p className="text-[12.5px] text-[#71717A]">
                  Configure your server's public stock identity, description, category, and review current share distribution.
                </p>
              </div>

              {/* Editable Identity Form */}
              <form onSubmit={handleSaveOverview} className="p-5 rounded-2xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13.5px] font-bold text-[#18181B]">Server Stock Parameters</h3>
                  <span className="text-[11px] text-[#71717A]">Changes reflect immediately on Cordchain</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11.5px] font-semibold text-[#52525B] mb-1">
                      Stock Ticker Symbol
                    </label>
                    <input
                      type="text"
                      value={tickerInput}
                      onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                      placeholder="$TICKER"
                      className="w-full bg-white border border-[#EAE9E4] rounded-xl px-3.5 py-2 text-[13px] font-mono font-bold text-[#18181B] focus:outline-hidden focus:border-[#18181B]"
                    />
                    <p className="text-[10.5px] text-[#71717A] mt-1">Must be unique across Cordchain (2-8 chars).</p>
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-semibold text-[#52525B] mb-1">
                      Server Display Name
                    </label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Server Name"
                      className="w-full bg-white border border-[#EAE9E4] rounded-xl px-3.5 py-2 text-[13px] text-[#18181B] focus:outline-hidden focus:border-[#18181B]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11.5px] font-semibold text-[#52525B] mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={categoryInput}
                      onChange={(e) => setCategoryInput(e.target.value)}
                      placeholder="e.g. Gaming, Community, Alpha"
                      className="w-full bg-white border border-[#EAE9E4] rounded-xl px-3.5 py-2 text-[13px] text-[#18181B] focus:outline-hidden focus:border-[#18181B]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-semibold text-[#52525B] mb-1">
                      Discord Guild ID
                    </label>
                    <input
                      type="text"
                      disabled
                      value={ownedServer.discordGuildId}
                      className="w-full bg-[#F4F3EE] border border-[#EAE9E4] rounded-xl px-3.5 py-2 text-[12px] font-mono text-[#71717A] cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-[#52525B] mb-1">
                    Community Description
                  </label>
                  <textarea
                    rows={2}
                    value={descriptionInput}
                    onChange={(e) => setDescriptionInput(e.target.value)}
                    placeholder="Short description of your community and community perks..."
                    className="w-full bg-white border border-[#EAE9E4] rounded-xl px-3.5 py-2 text-[12.5px] text-[#18181B] focus:outline-hidden focus:border-[#18181B]"
                  />
                </div>

                <div className="pt-1 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-white text-[12.5px] font-semibold transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Token Parameters</span>
                  </button>
                </div>
              </form>

              {/* Visual Breakdown Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-[12px] font-mono">
                  <span>Circulating Float: {ownedServer.circulatingSupply.toLocaleString()} shares</span>
                  <span>Treasury Reserve: {ownedServer.treasuryReserve.toLocaleString()} shares</span>
                </div>
                <div className="h-3 w-full bg-[#EAE9E4] rounded-full overflow-hidden flex">
                  <div
                    style={{
                      width: `${Math.round(
                        (ownedServer.circulatingSupply / Math.max(1, ownedServer.totalSupply)) * 100
                      )}%`,
                    }}
                    className="bg-[#18181B]"
                  />
                  <div
                    style={{
                      width: `${Math.round(
                        (ownedServer.treasuryReserve / Math.max(1, ownedServer.totalSupply)) * 100
                      )}%`,
                    }}
                    className="bg-[#5865F2]"
                  />
                </div>
              </div>

              {/* Top Shareholders Table */}
              <div className="border border-[#EAE9E4] rounded-2xl overflow-hidden">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-[#FAF9F6] border-b border-[#EAE9E4] text-[11.5px] text-[#71717A]">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Holder Entity</th>
                      <th className="px-4 py-2.5 font-medium">Shares</th>
                      <th className="px-4 py-2.5 font-medium">Stake %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE9E4]">
                    {ownedServer.topHolders.map((h, i) => (
                      <tr key={i} className="hover:bg-[#FAF9F6]">
                        <td className="px-4 py-2.5 font-medium text-[#18181B]">{h.username}</td>
                        <td className="px-4 py-2.5 font-mono text-[#52525B]">{h.shares.toLocaleString()}</td>
                        <td className="px-4 py-2.5 font-mono text-[#52525B]">{h.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* CordLedger Hash Chain Smart Contract Status & Deployment */}
              <div className="p-5 rounded-2xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#4F46E5]" />
                    <h3 className="text-[13.5px] font-bold text-[#18181B]">CordLedger Token Status</h3>
                  </div>
                  <span className="text-[11px] text-[#10B981] font-mono font-semibold">Ledger: CordLedger (SHA-256)</span>
                </div>

                <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-[12.5px] font-bold text-[#166534] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                      <span>Verified CordLedger Community Token</span>
                    </p>
                    <p className="text-[11.5px] text-[#15803D] mt-0.5 font-mono">
                      {ownedServer.tokenContractAddress || `cordledger:token:${ownedServer.ticker.toLowerCase()}`}
                    </p>
                    <p className="text-[11px] text-[#71717A] mt-1">
                      Fixed supply of 1,000,000 shares chained with SHA-256 and signed with Ed25519 in 1-minute Merkle blocks.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={`/scan?token=${encodeURIComponent(ownedServer.serverId)}`}
                      className="px-3.5 py-2 rounded-xl bg-[#166534] hover:bg-[#14532D] text-white text-[11.5px] font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>View on CordScan</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 2: COMMUNITY & ADVANTAGE */}
          {/* ================================================================= */}
          {activeSection === 'community' && memberStats && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[16px] font-semibold text-[#18181B]">
                  Community Metrics & Advantage Engine
                </h2>
                <p className="text-[12.5px] text-[#71717A]">
                  Real-time member lists and the mathematical advantage multiplier scaling your token.
                </p>
              </div>

              {/* 4 Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4]">
                  <p className="text-[10.5px] text-[#71717A] uppercase font-bold tracking-wider">Total Members</p>
                  <p className="text-[20px] font-bold font-mono text-[#18181B] mt-1">
                    {memberStats.totalMembers.toLocaleString()}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4]">
                  <p className="text-[10.5px] text-[#71717A] uppercase font-bold tracking-wider">Online Members</p>
                  <p className="text-[20px] font-bold font-mono text-[#10B981] mt-1">
                    {memberStats.onlineMembers.toLocaleString()}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4]">
                  <p className="text-[10.5px] text-[#71717A] uppercase font-bold tracking-wider">Active Daily</p>
                  <p className="text-[20px] font-bold font-mono text-[#5865F2] mt-1">
                    {memberStats.activeDailyMembers.toLocaleString()}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4]">
                  <p className="text-[10.5px] text-[#71717A] uppercase font-bold tracking-wider">CordChain Users</p>
                  <p className="text-[20px] font-bold font-mono text-[#7C3AED] mt-1">
                    {memberStats.cordchainAffiliatedMembers.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Real-Time Member Lists Toggle */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#EAE9E4] pb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCommunityTab('cordchain')}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                        communityTab === 'cordchain'
                          ? 'bg-[#18181B] text-white font-semibold'
                          : 'text-[#71717A] hover:bg-[#F4F3EE]'
                      }`}
                    >
                      Cordchain Affiliated Members ({memberStats.cordchainMemberList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommunityTab('discord')}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                        communityTab === 'discord'
                          ? 'bg-[#18181B] text-white font-semibold'
                          : 'text-[#71717A] hover:bg-[#F4F3EE]'
                      }`}
                    >
                      Discord Members List ({memberStats.discordMemberList.length})
                    </button>
                  </div>
                </div>

                {communityTab === 'cordchain' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto">
                    {memberStats.cordchainMemberList.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] flex items-center justify-between text-[11.5px]"
                      >
                        <div>
                          <p className="font-semibold text-[#18181B]">{m.username}</p>
                          <p className="text-[10.5px] text-[#71717A]">{m.traderRank}</p>
                        </div>
                        <div className="text-right font-mono">
                          <p className="font-bold text-[#18181B]">{m.sharesHeld.toLocaleString()} shares</p>
                          <p className="text-[10px] text-[#10B981]">+{m.boostCount} boosts</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                    {memberStats.discordMemberList.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] flex items-center justify-between text-[11px]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              m.status === 'online'
                                ? 'bg-[#10B981]'
                                : m.status === 'idle'
                                ? 'bg-[#F59E0B]'
                                : 'bg-[#A1A1AA]'
                            }`}
                          />
                          <span className="font-medium text-[#18181B] truncate">{m.displayName}</span>
                        </div>
                        <span className="text-[9.5px] text-[#71717A] bg-white px-1.5 py-0.5 rounded border border-[#EAE9E4] shrink-0 font-mono">
                          {m.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 3: AD REVENUE & DIVIDENDS */}
          {/* ================================================================= */}
          {activeSection === 'dividends' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[16px] font-semibold text-[#18181B]">
                  Ad Revenue & Dividend Splits
                </h2>
                <p className="text-[12.5px] text-[#71717A]">
                  When sponsors buy ads on your Discord server, configure how earnings are divided between token holders, the treasury, and your wallet.
                </p>
              </div>

              <div className="space-y-5 p-5 rounded-2xl bg-[#FAF9F6] border border-[#EAE9E4]">
                <div>
                  <div className="flex justify-between text-[13px] mb-2">
                    <span className="font-semibold text-[#18181B]">1. Shareholders Dividend Pool</span>
                    <span className="font-mono font-bold text-[#10B981]">{shareholdersSplit}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={shareholdersSplit}
                    onChange={(e) => setShareholdersSplit(Number(e.target.value))}
                    className="w-full accent-[#10B981] cursor-pointer"
                  />
                  <p className="text-[11px] text-[#71717A] mt-1">
                    Distributed pro-rata to all community members holding {ownedServer.ticker} shares.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between text-[13px] mb-2">
                    <span className="font-semibold text-[#18181B]">2. Server Treasury Fund</span>
                    <span className="font-mono font-bold text-[#5865F2]">{treasurySplit}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    value={treasurySplit}
                    onChange={(e) => setTreasurySplit(Number(e.target.value))}
                    className="w-full accent-[#5865F2] cursor-pointer"
                  />
                  <p className="text-[11px] text-[#71717A] mt-1">
                    Accumulates in treasury reserve for events, giveaways, prize pools, or buybacks.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between text-[13px] mb-2">
                    <span className="font-semibold text-[#18181B]">3. Server Owner Pool</span>
                    <span className="font-mono font-bold text-[#18181B]">{ownerSplit}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="40"
                    value={ownerSplit}
                    onChange={(e) => setOwnerSplit(Number(e.target.value))}
                    className="w-full accent-[#18181B] cursor-pointer"
                  />
                  <p className="text-[11px] text-[#71717A] mt-1">
                    Withdrawable directly to your UPI/bank wallet via the Wallet tab.
                  </p>
                </div>

                <div className="pt-2 text-right">
                  <span
                    className={`text-[12px] font-mono font-semibold ${
                      shareholdersSplit + treasurySplit + ownerSplit === 100
                        ? 'text-[#10B981]'
                        : 'text-[#EF4444]'
                    }`}
                  >
                    Total Allocated: {shareholdersSplit + treasurySplit + ownerSplit}% / 100%
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveDividends}
                  disabled={isSaving || shareholdersSplit + treasurySplit + ownerSplit !== 100}
                  className="px-6 py-2.5 rounded-xl bg-[#141416] hover:bg-[#27272A] text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Dividend Rules</span>
                </button>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 4: SECONDARY ISSUANCE */}
          {/* ================================================================= */}
          {activeSection === 'issuance' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[16px] font-semibold text-[#18181B]">
                  Secondary Share Issuance
                </h2>
                <p className="text-[12.5px] text-[#71717A]">
                  Mint additional community shares into your Server Treasury Reserve to fund expansion or community projects.
                </p>
              </div>

              <form onSubmit={handleIssueShares} className="p-5 rounded-2xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-4">
                <h3 className="text-[14px] font-bold text-[#18181B]">Issue New Secondary Shares</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11.5px] font-semibold text-[#71717A] mb-1">
                      New Shares to Mint
                    </label>
                    <input
                      type="number"
                      min="100"
                      value={additionalShares}
                      onChange={(e) => setAdditionalShares(e.target.value)}
                      placeholder="10000"
                      className="w-full bg-white border border-[#EAE9E4] rounded-xl px-3.5 py-2 text-[13px] font-mono focus:outline-hidden focus:border-[#18181B]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-semibold text-[#71717A] mb-1">
                      Current Stock Price (USD)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={`$${ownedServer.currentPriceInr.toFixed(2)}`}
                      className="w-full bg-[#F4F3EE] border border-[#EAE9E4] rounded-xl px-3.5 py-2 text-[13px] font-mono text-[#71717A] cursor-not-allowed"
                    />
                  </div>
                </div>

                <p className="text-[11.5px] text-[#71717A]">
                  Implied Capital Value:{' '}
                  <span className="font-mono font-bold text-[#18181B]">
                    ${((Number(additionalShares) || 0) * ownedServer.currentPriceInr).toLocaleString()}
                  </span>
                </p>

                <button
                  type="submit"
                  disabled={isSaving || !additionalShares}
                  className="px-5 py-2.5 rounded-xl bg-[#18181B] text-white text-[12.5px] font-semibold hover:bg-[#27272A] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Mint & Release to Treasury</span>
                </button>
              </form>
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 5: DISCORD BOT & AD SPACES */}
          {/* ================================================================= */}
          {activeSection === 'bot' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[16px] font-semibold text-[#18181B]">
                  Discord Bot & Monetization Settings
                </h2>
                <p className="text-[12.5px] text-[#71717A]">
                  Manage bot integration and user attention monetization on Cordchain.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#F4F5FF] border border-[#DFE2FE] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#5865F2] text-white flex items-center justify-center">
                    <DiscordLogo className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[13.5px] font-bold text-[#18181B]">Cordchain Verified Bot</p>
                    <p className="text-[11.5px] text-[#52525B]">Connected to {ownedServer.serverName}</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] text-[11px] font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block"></span>
                  <span>Online</span>
                </span>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-3.5 rounded-xl border border-[#EAE9E4] bg-[#FAF9F6] cursor-pointer">
                  <div>
                    <p className="text-[13px] font-semibold text-[#18181B]">Rewarded Sponsor Ad Monetization</p>
                    <p className="text-[11.5px] text-[#71717A]">
                      Allow members to boost your ticker by viewing verified sponsor ads, crediting the dividend pool.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={adEnabled}
                    onChange={(e) => setAdEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#18181B] cursor-pointer"
                  />
                </label>

                <div className="p-3.5 rounded-xl border border-[#EAE9E4] bg-[#FAF9F6]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[13px] font-semibold text-[#18181B]">
                      Community Boost Reward Multiplier
                    </span>
                    <span className="font-mono font-bold text-[#5865F2]">{boostMultiplier}x</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="2.5"
                    step="0.05"
                    value={boostMultiplier}
                    onChange={(e) => setBoostMultiplier(Number(e.target.value))}
                    className="w-full accent-[#5865F2] cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveDividends}
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-[#141416] hover:bg-[#27272A] text-white text-[13px] font-semibold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Bot & Ad Settings</span>
                </button>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 6: DELIST & DELETE TOKEN (DANGER ZONE) */}
          {/* ================================================================= */}
          {activeSection === 'danger' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[16px] font-semibold text-[#DC2626] flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
                  <span>Delist and Permanently Delete Token</span>
                </h2>
                <p className="text-[12.5px] text-[#71717A]">
                  Permanent management options to remove your token and cancel all exchange listings.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] space-y-4">
                <div className="space-y-2">
                  <h3 className="text-[14px] font-bold text-[#991B1B]">
                    Are you sure you want to delist {ownedServer.ticker}?
                  </h3>
                  <p className="text-[12.5px] text-[#7F1D1D] leading-relaxed">
                    Delisting will permanently delete <strong>{ownedServer.ticker}</strong> ({ownedServer.serverName}) from Cordchain.
                  </p>
                  <ul className="text-[12px] text-[#991B1B] list-disc list-inside space-y-1 pt-1">
                    <li>The token pair will be removed from the Cordchain Exchange market.</li>
                    <li>All trading history, order books, and pending bids/asks will be cleared.</li>
                    <li>Community check-in logs and user holdings will be deleted.</li>
                    <li>This action cannot be undone and is restricted to the verified Discord owner.</li>
                  </ul>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmText('');
                      setShowDeleteModal(true);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[13px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-2 shadow-xs"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delist & Delete {ownedServer.ticker}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ===================================================================== */}
      {/* CONFIRMATION MODAL: PERMANENT DELIST & DELETE */}
      {/* ===================================================================== */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none animate-in fade-in duration-150">
          <div className="bg-white border border-[#EAE9E4] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#F4F3EE] pb-3">
              <div className="flex items-center gap-2 text-[#DC2626]">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-[16px] font-bold">Confirm Token Delisting</h3>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-1 rounded-lg hover:bg-[#F4F3EE] text-[#71717A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[13px] text-[#52525B] leading-relaxed">
              You are about to permanently delist and delete{' '}
              <strong className="text-[#18181B] font-mono">{ownedServer.ticker}</strong> ({ownedServer.serverName}).
              To prevent accidental deletion, please type the ticker symbol{' '}
              <strong className="text-[#18181B] font-mono">{ownedServer.ticker}</strong> below:
            </p>

            <div>
              <label className="block text-[11.5px] font-semibold text-[#71717A] mb-1">
                Type {ownedServer.ticker} to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                placeholder={ownedServer.ticker}
                className="w-full bg-[#FAF9F6] border border-[#EAE9E4] rounded-xl px-3.5 py-2 text-[14px] font-mono font-bold text-[#18181B] focus:outline-hidden focus:border-[#DC2626]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl bg-white border border-[#EAE9E4] hover:bg-[#F4F3EE] text-[#18181B] text-[12.5px] font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting || deleteConfirmText.trim().toUpperCase() !== ownedServer.ticker.toUpperCase()}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[12.5px] font-semibold disabled:opacity-40 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Permanently Delist</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
