import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Plus,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Coins,
  Store,
  Layers,
  Flame,
  Zap,
  Trophy,
  Crown,
  Star,
  Users,
  ExternalLink,
  Sliders,
  DollarSign,
  ArrowRight,
  UserCheck,
  Activity,
  Radio,
  Lock,
  Check,
  RefreshCw,
  Bot,
  Copy,
  Wallet,
  Globe,
  FileCode,
  Link2,
} from 'lucide-react';
import { ServerAsset, LeagueType, DiscordMemberEntry, CordchainAffiliatedMemberEntry } from '../types';
import {
  PRESET_OWNED_DISCORD_SERVERS,
  ConnectedOwnedServer,
  calculateCommunityAdvantage,
  generateServerMemberStats,
  AdvantageBreakdown,
} from '../lib/advantageEngine';
import { tokenizeGuildApi, normalizeDiscordInvite } from '../lib/api';
import { DiscordLogo, ServerIcon } from './Icons';
import {
  deployCommunityTokenOnBaseSepolia,
  verifyBaseSepoliaToken,
  addTokenToMetaMask,
  type VerifiedOnChainToken,
} from '../lib/erc20Service';
import { BASE_SEPOLIA_EXPLORER, shortenAddress } from '../lib/blockchain';

interface TokenizeServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingServers: ServerAsset[];
  onTokenize: (newServer: ServerAsset) => void;
  discordGuilds?: Array<{
    id: string;
    name: string;
    iconUrl: string | null;
    owner?: boolean;
    permissions?: string;
    approximateMemberCount?: number;
    approximatePresenceCount?: number;
  }>;
  botClientId?: string;
  installedGuildIds?: string[];
  onConnectDiscord?: () => void;
  onRefreshDiscordGuilds?: () => Promise<void>;
  isLoggedIn?: boolean;
  username?: string;
}

const ICON_PRESETS = [
  { id: 'discord', label: 'Discord Blue', color: '#5865F2' },
  { id: 'emerald', label: 'Emerald Alpha', color: '#10B981' },
  { id: 'amber', label: 'Golden Trophy', color: '#F59E0B' },
  { id: 'flame', label: 'Flame Red', color: '#EF4444' },
  { id: 'purple', label: 'Cyber Violet', color: '#8B5CF6' },
  { id: 'cyan', label: 'Neon Cyan', color: '#06B6D4' },
];

export const TokenizeServerModal: React.FC<TokenizeServerModalProps> = ({
  isOpen,
  onClose,
  existingServers,
  onTokenize,
  discordGuilds = [],
  botClientId = '1436329063250100346',
  installedGuildIds = [],
  onConnectDiscord,
  onRefreshDiscordGuilds,
  isLoggedIn = false,
  username = 'Ayush',
}) => {
  const [isRefreshingGuilds, setIsRefreshingGuilds] = useState(false);

  const handleRefresh = async () => {
    if (!onRefreshDiscordGuilds || isRefreshingGuilds) return;
    setIsRefreshingGuilds(true);
    try {
      await onRefreshDiscordGuilds();
    } catch (err) {
      console.error('Failed to sync Discord guilds:', err);
    } finally {
      setIsRefreshingGuilds(false);
    }
  };

  // Map connected Discord OAuth guilds, reading authoritative Discord API counts
  const availableOwnedServers = useMemo(() => {
    const list: ConnectedOwnedServer[] = [];
    if (discordGuilds.length > 0) {
      discordGuilds.forEach((dg) => {
        const isOwner = Boolean(dg.owner);
        // Authoritative Discord API measurements:
        // approximate_member_count = total members in guild
        // approximate_presence_count = online / active presence in guild
        const total = dg.approximateMemberCount ?? (isOwner ? 1 : 0);
        const online = Math.min(total, dg.approximatePresenceCount ?? (isOwner ? 1 : 0));
        const active = Math.min(total, Math.max(online, Math.round(total * 0.4)));
        const cordchain = Math.min(total, isOwner ? 1 : 0);
        const cleanName = dg.name.replace(/[^a-zA-Z0-9]/g, '');
        const ticker = `$${(cleanName.slice(0, 5) || 'TOKEN').toUpperCase()}`;
        list.push({
          id: `oauth-guild-${dg.id}`,
          name: dg.name,
          iconUrl: dg.iconUrl || undefined,
          guildId: dg.id,
          isOwner,
          role: isOwner ? 'Owner' : 'Member',
          suggestedTicker: ticker,
          suggestedPriceUsd: 25.00,
          totalMembers: total,
          onlineMembers: online,
          activeMembers: active,
          cordchainMembers: cordchain,
          category: 'Discord Community',
          description: `${dg.name} Discord community stock on CordChain.`,
          tags: ['Community', 'Discord', 'CordLedger'],
        });
      });
    }
    return list;
  }, [discordGuilds]);

  // Strict eligibility: only servers the user OWNS with the CordChain bot installed
  // can be tokenized. Non-eligible servers are hidden from the listing entirely.
  const eligibleServers = useMemo(
    () =>
      availableOwnedServers.filter(
        (s) => s.isOwner && installedGuildIds.includes(s.guildId)
      ),
    [availableOwnedServers, installedGuildIds]
  );

  // Owned guilds that still miss the bot install (surfaced as add-bot helpers)
  const ownedMissingBot = useMemo(
    () =>
      availableOwnedServers.filter(
        (s) => s.isOwner && !installedGuildIds.includes(s.guildId)
      ),
    [availableOwnedServers, installedGuildIds]
  );

  const displayedServers = eligibleServers;

  // Selected server: prioritize an eligible (owned + bot installed) server by default
  const [selectedServer, setSelectedServer] = useState<ConnectedOwnedServer | null>(() => {
    return eligibleServers[0] || availableOwnedServers.find((s) => s.isOwner) || availableOwnedServers[0] || null;
  });

  useEffect(() => {
    if (availableOwnedServers.length > 0) {
      setSelectedServer((prev) => {
        if (prev && eligibleServers.some((s) => s.id === prev.id)) {
          return eligibleServers.find((s) => s.id === prev.id) || prev;
        }
        return eligibleServers[0] || null;
      });
    } else {
      setSelectedServer(null);
    }
  }, [availableOwnedServers, eligibleServers]);

  // Tokenization & IPO customizable states
  const [tickerRaw, setTickerRaw] = useState<string>(() => selectedServer?.suggestedTicker?.replace('$', '') || '');
  const [totalSupply, setTotalSupply] = useState<number>(1000000);
  const [publicFloatPct, setPublicFloatPct] = useState<number>(75); // 75% public AMM float
  const [creatorReservePct, setCreatorReservePct] = useState<number>(25); // 25% creator reserve with 5% monthly vesting
  const [selectedIconPreset, setSelectedIconPreset] = useState<string>(ICON_PRESETS[0].id);
  const [description, setDescription] = useState<string>(() => selectedServer?.description || '');
  const [tagsInput, setTagsInput] = useState<string>(() => selectedServer?.tags.join(', ') || 'Community, Discord');
  const [activeRosterTab, setActiveRosterTab] = useState<'cordchain' | 'discord'>('cordchain');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Compulsory public Discord invite link for the directory listing
  const [inviteUrlInput, setInviteUrlInput] = useState<string>('');

  // When selected server changes, update the defaults automatically without asking the user
  useEffect(() => {
    if (selectedServer) {
      setTickerRaw(selectedServer.suggestedTicker.replace('$', ''));
      setDescription(selectedServer.description);
      setTagsInput(selectedServer.tags.join(', '));
      setSubmitError(null);
      setInviteUrlInput('');
    }
  }, [selectedServer]);

  // Clean ticker code
  const cleanTickerCode = useMemo(() => {
    return tickerRaw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }, [tickerRaw]);

  // Real-time unicity check for rare ticker name
  const tickerValidation = useMemo(() => {
    if (!cleanTickerCode) {
      return { valid: false, error: 'Token ticker symbol is required' };
    }
    if (cleanTickerCode.length < 2) {
      return { valid: false, error: 'Ticker must be at least 2 characters' };
    }
    if (cleanTickerCode.length > 8) {
      return { valid: false, error: 'Ticker must not exceed 8 characters' };
    }

    const isDuplicate = existingServers.some(
      (s) => s.ticker.toUpperCase().replace('$', '') === cleanTickerCode
    );

    if (isDuplicate) {
      return {
        valid: false,
        error: `Ticker $${cleanTickerCode} is already registered! All CordChain tokens must have rare, unique names.`,
      };
    }

    return { valid: true, error: null };
  }, [cleanTickerCode, existingServers]);

  // Invite link validation (must normalize to a public, permanent discord.gg invite)
  const inviteValidation = useMemo(() => {
    const raw = inviteUrlInput.trim();
    if (!raw) {
      return {
        valid: false,
        normalized: null as string | null,
        error: 'Public Discord invite link is required for your listing',
      };
    }
    const normalized = normalizeDiscordInvite(raw);
    if (!normalized) {
      return {
        valid: false,
        normalized: null,
        error: 'Use a public invite: discord.gg/..., discord.com/invite/... or dsc.gg/...',
      };
    }
    return { valid: true, normalized, error: null as string | null };
  }, [inviteUrlInput]);

  // Real-time advantage multiplier calculation
  const advantage: AdvantageBreakdown = useMemo(() => {
    if (!selectedServer) {
      return calculateCommunityAdvantage(0, 0, 0, 1);
    }
    return calculateCommunityAdvantage(
      selectedServer.cordchainMembers,
      selectedServer.activeMembers,
      selectedServer.onlineMembers,
      selectedServer.totalMembers
    );
  }, [selectedServer]);

  // Generate realistic live member rosters for both lists
  const memberStats = useMemo(() => {
    if (!selectedServer) {
      return generateServerMemberStats('none', 1, 0, 0, 0);
    }
    return generateServerMemberStats(
      selectedServer.id,
      selectedServer.totalMembers,
      selectedServer.cordchainMembers,
      selectedServer.activeMembers,
      selectedServer.onlineMembers
    );
  }, [selectedServer]);

  // Dynamic calculations for IPO
  const numericPrice = 0.0001; // Activity-Valued IPO — the protocol prices the listing
  const publicSharesCount = Math.round((totalSupply * publicFloatPct) / 100);
  const creatorSharesCount = Math.round((totalSupply * creatorReservePct) / 100);
  const treasurySharesCount = Math.max(0, totalSupply - publicSharesCount - creatorSharesCount);

  // League calculation from members
  const computedLeague: LeagueType = useMemo(() => {
    if (!selectedServer) return 'Squad';
    if (selectedServer.totalMembers >= 25000) return 'Titan';
    if (selectedServer.totalMembers >= 10000) return 'Arena';
    if (selectedServer.totalMembers >= 2500) return 'Club';
    return 'Squad';
  }, [selectedServer?.totalMembers]);

  // CordLedger Tokenization
  const [tokenType, setTokenType] = useState<'deploy_onchain' | 'existing_contract' | 'virtual_stock'>('virtual_stock');
  const [deployStep, setDeployStep] = useState<'idle' | 'deploying' | 'confirming' | 'success' | 'error'>('idle');
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployedContract, setDeployedContract] = useState<{
    address: string;
    txHash: string;
    blockNumber: bigint;
  } | null>(null);

  // Existing Contract Verification
  const [existingContractInput, setExistingContractInput] = useState<string>('');
  const [verifiedToken, setVerifiedToken] = useState<VerifiedOnChainToken | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [addedToMetaMask, setAddedToMetaMask] = useState(false);
  const [copiedContract, setCopiedContract] = useState(false);

  const handleDeployOnChain = async () => {
    if (!selectedServer || !tickerValidation.valid) return;
    setDeployStep('deploying');
    setDeployError(null);
    try {
      const result = await deployCommunityTokenOnBaseSepolia({
        name: selectedServer.name,
        symbol: cleanTickerCode,
        totalSupply,
        guildId: selectedServer.guildId,
      });
      setDeployedContract({
        address: result.contractAddress,
        txHash: result.transactionHash,
        blockNumber: result.blockNumber,
      });
      setDeployStep('success');
    } catch (err: any) {
      setDeployError(err.message || 'On-chain deployment failed. Ensure your Web3 wallet is connected to CordLedger.');
      setDeployStep('error');
    }
  };

  const handleVerifyExistingContract = async () => {
    if (!existingContractInput) return;
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const vt = await verifyBaseSepoliaToken(existingContractInput.trim());
      setVerifiedToken(vt);
    } catch (err: any) {
      setVerifyError(err.message || 'Could not verify contract on CordLedger. Ensure address is a valid ERC-20 token.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleAddToMetaMask = async () => {
    const targetAddr = deployedContract?.address || verifiedToken?.address;
    if (!targetAddr) return;
    const added = await addTokenToMetaMask(targetAddr, cleanTickerCode, selectedServer?.iconUrl || undefined);
    if (added) setAddedToMetaMask(true);
  };

  const isServerOwner = Boolean(selectedServer?.isOwner);
  const hasOnChainReady =
    tokenType === 'deploy_onchain'
      ? Boolean(deployedContract?.address)
      : tokenType === 'existing_contract'
      ? Boolean(verifiedToken?.address)
      : true;

  const canSubmit =
    isServerOwner &&
    tickerValidation.valid &&
    inviteValidation.valid &&
    numericPrice > 0 &&
    totalSupply >= 10000 &&
    hasOnChainReady;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedServer || !selectedServer.isOwner) return;

    const finalContractAddress =
      tokenType === 'deploy_onchain'
        ? deployedContract?.address
        : tokenType === 'existing_contract'
        ? verifiedToken?.address
        : undefined;

    const finalTxHash =
      tokenType === 'deploy_onchain' ? deployedContract?.txHash : undefined;

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await tokenizeGuildApi({
        guildId: selectedServer.guildId,
        name: selectedServer.name,
        ticker: `$${cleanTickerCode}`,
        description: description.trim() || selectedServer.description,
        initialPriceUsd: numericPrice,
        totalSupply,
        publicFloatPct,
        creatorReservePct,
        iconUrl: selectedServer.iconUrl,
        memberCount: selectedServer.totalMembers,
        onlineCount: selectedServer.onlineMembers,
        inviteUrl: inviteValidation.normalized!,
        tokenContractAddress: finalContractAddress,
        deploymentTxHash: finalTxHash,
      });
    } catch (err: any) {
      setSubmitError(err.message || 'Tokenization failed on CordChain backend.');
      setIsSubmitting(false);
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const newAsset: ServerAsset = {
      id: selectedServer.guildId,
      ticker: `$${cleanTickerCode}`,
      name: selectedServer.name,
      category: selectedServer.category,
      league: computedLeague,
      rank: existingServers.length + 1,
      members:
        selectedServer.totalMembers >= 1000
          ? `${(selectedServer.totalMembers / 1000).toFixed(1)}k`
          : String(selectedServer.totalMembers),
      priceInr: numericPrice,
      priceUsd: numericPrice,
      change24h: 0.0,
      sidebarChange24h: 0.0,
      volume24h: '$0.00',
      high24hUsd: numericPrice,
      low24hUsd: numericPrice,
      marketCapUsd: `$${(numericPrice * totalSupply).toFixed(2)}`,
      description: description.trim() || selectedServer.description,
      tags: tags.length ? tags : selectedServer.tags,
      isIpo: true,
      holdings: creatorSharesCount,
      avgBuyPriceUsd: numericPrice,
      tokenContractAddress: finalContractAddress,
      tokenExplorerUrl: finalContractAddress
        ? `/scan?token=${encodeURIComponent(finalContractAddress)}`
        : undefined,
      blockchainNetwork: 'CordLedger',
      advantageMultiplier: advantage.multiplier,
      discordServerId: selectedServer.guildId,
      discordInviteUrl: inviteValidation.normalized || selectedServer.inviteUrl,
      memberStats,
      ipoDetails: {
        totalSupply,
        publicFloatPct,
        creatorAllocationPct: creatorReservePct,
        treasuryReservePct: Math.round((treasurySharesCount / totalSupply) * 100),
        initialIpoPriceUsd: numericPrice,
        shareholdersSplit: 60,
        treasurySplit: 25,
        ownerSplit: 15,
      },
    };

    setIsSubmitting(false);
    onTokenize(newAsset);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="bg-white border border-[#EAE9E4] rounded-2xl w-full max-w-4xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Fixed Header */}
        <div className="px-6 py-4 border-b border-[#EAE9E4] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#18181B] flex items-center justify-center text-white shadow-xs">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-bold text-[#18181B] leading-tight">
                  Tokenize Owned Discord Server & Launch IPO
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[10.5px] font-semibold">
                  CordLedger AMM
                </span>
              </div>
              <p className="text-[11.5px] text-[#71717A] mt-0.5">
                Connect your Discord server to auto-import members, calculate CordChain Advantage, and issue shares.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F7F6F3] text-[#71717A] hover:text-[#18181B] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* ======================================================== */}
          {/* SECTION 1: CONNECT TO SERVERS THEY OWN (STRICT OWNERSHIP) */}
          {/* ======================================================== */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-[12px] font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-[#EAB308]" />
                  <span>1. Select an Owned Discord Server</span>
                </h3>
                <p className="text-[11.5px] text-[#71717A]">
                  Only verified Discord Server Owners can tokenize a community and issue shares. All metrics are auto-extracted.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Eligibility note */}
                <span className="px-2.5 py-1 rounded-xl bg-white border border-[#EAE9E4] text-[11px] text-[#71717A] flex items-center gap-1.5 shadow-2xs">
                  <Crown className="w-3 h-3 text-[#EAB308]" />
                  <span>
                    Eligible: owned + bot installed ({eligibleServers.length}/{availableOwnedServers.length} guilds)
                  </span>
                </span>

                {isLoggedIn && onRefreshDiscordGuilds && (
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshingGuilds}
                    className="px-2.5 py-1 rounded-xl bg-white border border-[#EAE9E4] text-[#18181B] hover:bg-[#F4F3EE] text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                    title="Re-query Discord API for owned guilds and member counts"
                  >
                    <RefreshCw className={`w-3 h-3 text-[#71717A] ${isRefreshingGuilds ? 'animate-spin' : ''}`} />
                    <span>{isRefreshingGuilds ? 'Syncing...' : 'Sync Discord'}</span>
                  </button>
                )}

                {onConnectDiscord && (
                  <button
                    type="button"
                    onClick={onConnectDiscord}
                    className="px-2.5 py-1 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
                    title={isLoggedIn ? 'Re-authorize Discord OAuth with identify & guilds scopes' : 'Login with Discord'}
                  >
                    <DiscordLogo className="w-3.5 h-3.5" />
                    <span>{isLoggedIn ? 'Re-Auth' : 'Login with Discord'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Servers Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedServers.length === 0 ? (
                <div className="col-span-full py-8 px-4 text-center rounded-2xl border border-dashed border-[#EAE9E4] bg-[#FAF9F6]">
                  <Crown className="w-8 h-8 text-[#A1A1AA] mx-auto mb-2" />
                  <p className="text-[13px] font-bold text-[#18181B]">
                    {availableOwnedServers.length === 0
                      ? 'No Discord Guilds Found'
                      : 'No Eligible Servers To Tokenize'}
                  </p>
                  <p className="text-[11.5px] text-[#71717A] max-w-md mx-auto mt-1">
                    {availableOwnedServers.length === 0
                      ? 'Connect your Discord account to see your servers.'
                      : isLoggedIn
                      ? 'Tokenizing requires a Discord server you own with the CordChain bot installed.'
                      : 'Connect your Discord to select one of your owned servers.'}
                  </p>
                  {!isLoggedIn ? (
                    <button
                      type="button"
                      onClick={onConnectDiscord}
                      className="mt-3 px-4 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-[12px] font-semibold inline-flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                      <DiscordLogo className="w-4 h-4" />
                      <span>Connect Discord to Discover Servers</span>
                    </button>
                  ) : ownedMissingBot.length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      {ownedMissingBot.map((srv) => (
                        <a
                          key={srv.guildId}
                          href={`https://discord.com/oauth2/authorize?client_id=${botClientId}&scope=bot%20applications.commands&permissions=8&guild_id=${srv.guildId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          <span>Add bot to {srv.name.length > 24 ? `${srv.name.slice(0, 24)}…` : srv.name}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                displayedServers.map((srv) => {
                  const isSelected = selectedServer?.id === srv.id;
                  const adv = calculateCommunityAdvantage(
                    srv.cordchainMembers,
                    srv.activeMembers,
                    srv.onlineMembers,
                    srv.totalMembers
                  );
                  return (
                    <div
                      key={srv.id}
                      onClick={() => setSelectedServer(srv)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? srv.isOwner
                            ? 'border-[#18181B] bg-[#FAF9F6] shadow-sm ring-1 ring-[#18181B]'
                            : 'border-[#EF4444] bg-[#FEF2F2]/40 shadow-sm ring-1 ring-[#EF4444]'
                          : srv.isOwner
                          ? 'border-[#EAE9E4] bg-white hover:bg-[#FAF9F6]/60 hover:border-[#D4D4D8]'
                          : 'border-[#EAE9E4] bg-[#FAFAFA] opacity-75 hover:opacity-100 hover:border-[#FCA5A5]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl text-white flex items-center justify-center font-bold text-[12px] shrink-0 ${
                              srv.isOwner ? 'bg-[#5865F2]' : 'bg-[#71717A]'
                            }`}
                          >
                            {srv.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-[#18181B] truncate">{srv.name}</p>
                            <p className="text-[10px] text-[#71717A] flex items-center gap-1 font-mono">
                              <span>{srv.role}</span>
                              <span>•</span>
                              <span>{srv.suggestedTicker}</span>
                            </p>
                          </div>
                        </div>

                        {/* Status Badges: Bot Active / Add Bot + Ownership Badge */}
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {installedGuildIds?.includes(srv.guildId) ? (
                            <span className="px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] text-[9.5px] font-semibold flex items-center gap-1" title="CordChain Bot is active in this server">
                              <ShieldCheck className="w-3 h-3 text-[#10B981]" />
                              <span>Bot Active</span>
                            </span>
                          ) : srv.isOwner ? (
                            <a
                              href={`https://discord.com/oauth2/authorize?client_id=${botClientId}&scope=bot%20applications.commands&permissions=8&guild_id=${srv.guildId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="px-2 py-0.5 rounded-full bg-[#5865F2]/10 hover:bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/30 text-[9.5px] font-semibold flex items-center gap-1 transition-colors"
                              title="Install CordChain bot for real-time member telemetry"
                            >
                              <Bot className="w-2.5 h-2.5" />
                              <span>Add Bot</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>
                          ) : null}

                          {srv.isOwner ? (
                            <span className="px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] text-[9.5px] font-semibold flex items-center gap-1">
                              <Crown className="w-3 h-3 text-[#EAB308]" />
                              <span>Owner</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] text-[9.5px] font-semibold flex items-center gap-1" title="Only the server owner can tokenize">
                              <Lock className="w-2.5 h-2.5 text-[#DC2626]" />
                              <span>Locked</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-[#EAE9E4] text-[10.5px] font-mono">
                        <div>
                          <span className="text-[#71717A]">Total: </span>
                          <strong className="text-[#18181B]">{srv.totalMembers.toLocaleString()}</strong>
                        </div>
                        <div>
                          <span className="text-[#71717A]">Online: </span>
                          <strong className="text-[#10B981]">{srv.onlineMembers.toLocaleString()}</strong>
                        </div>
                        <div>
                          <span className="text-[#71717A]">Active: </span>
                          <strong className="text-[#3B82F6]">{srv.activeMembers.toLocaleString()}</strong>
                        </div>
                        <div>
                          <span className="text-[#71717A]">CordChain: </span>
                          <strong className="text-[#8B5CF6]">{srv.cordchainMembers}</strong>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-1.5 border-t border-[#F3F2EE] flex items-center justify-between text-[10px]">
                        <span className="text-[#71717A]">
                          {srv.isOwner ? 'Advantage Multiplier:' : 'Tokenization Status:'}
                        </span>
                        {srv.isOwner ? (
                          <span className="font-semibold text-[#8C734B] bg-[#F7F3EB] px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                            <Zap className="w-3 h-3 text-[#B45309]" />
                            <span>{adv.multiplier}x</span>
                          </span>
                        ) : (
                          <span className="font-semibold text-[#DC2626] bg-[#FEF2F2] px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Owner Only</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Dynamic Ownership Status Banner */}
            {selectedServer && (
              selectedServer.isOwner ? (
                <div className="mt-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[11.5px]">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-[#16A34A] shrink-0" />
                    <span className="text-[#166534]">
                      Verified Discord Server Owner: <strong className="text-[#14532D] font-bold">{selectedServer.name}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 font-mono text-[#15803D] text-[11px] flex-wrap">
                    <span>Guild ID: <strong>{selectedServer.guildId}</strong></span>
                    {installedGuildIds?.includes(selectedServer.guildId) ? (
                      <span className="px-2 py-0.5 rounded bg-[#DCFCE7] text-[#15803D] font-bold flex items-center gap-1 border border-[#86EFAC]">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Bot Installed & Active</span>
                      </span>
                    ) : (
                      <a
                        href={`https://discord.com/oauth2/authorize?client_id=${botClientId}&scope=bot%20applications.commands&permissions=8&guild_id=${selectedServer.guildId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                        title="Install bot on this guild"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>Add Bot to Server</span>
                        <ExternalLink className="w-3 h-3 opacity-75" />
                      </a>
                    )}
                    <span className="px-2 py-0.5 rounded bg-[#DCFCE7] text-[#15803D] font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Approved to Tokenize</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-3 text-[12px] animate-in fade-in duration-150">
                  <div className="w-7 h-7 rounded-lg bg-[#FEE2E2] flex items-center justify-center text-[#DC2626] shrink-0 mt-0.5">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <strong className="text-[#991B1B] font-semibold text-[13px]">
                        Ownership Verification Failed: Tokenization Disabled
                      </strong>
                      <span className="px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] text-[10px] font-mono font-bold">
                        Your Role: {selectedServer.role} (Non-Owner)
                      </span>
                    </div>
                    <p className="text-[#B91C1C] mt-1 leading-relaxed text-[11.5px]">
                      You do not own <strong>{selectedServer.name}</strong> on Discord. CordChain protocol strictly requires <strong>verified Discord Server Ownership</strong> to issue tokens, launch an IPO, and collect creator allocations.
                    </p>
                    <p className="mt-1.5 text-[11px] text-[#7F1D1D] font-medium flex items-center gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />
                      <span>Please select a server you own from the list above, or ask the Discord server owner to tokenize this community.</span>
                    </p>
                  </div>
                </div>
              )
            )}
          </div>

          {/* ======================================================== */}
          {/* SECTION 2: CORDCHAIN COMMUNITY ADVANTAGE ENGINE */}
          {/* ======================================================== */}
          <div className="bg-gradient-to-br from-[#FAF9F6] to-[#F5F4EE] border border-[#EAE9E4] rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#F59E0B]" />
                  <h3 className="text-[13px] font-bold text-[#18181B] uppercase tracking-wider">
                    2. CordChain Community Advantage System
                  </h3>
                </div>
                <p className="text-[11.5px] text-[#71717A] mt-0.5">
                  Stocks gain direct market advantages based on the hierarchy of engaged members.
                </p>
              </div>

              {/* Advantage Multiplier Badge */}
              <div className="px-3.5 py-1.5 rounded-xl bg-[#18181B] text-white flex items-center gap-2 shadow-xs shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-[#FDE047]" />
                <span className="text-[13px] font-bold font-mono">
                  {advantage.multiplier}x Advantage Multiplier
                </span>
                <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider border-l border-[#3F3F46] pl-2 font-mono">
                  {advantage.tierBonusLabel}
                </span>
              </div>
            </div>

            {/* Formula & Weight Hierarchy Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3.5">
              {/* CordChain Affiliated (Top Priority) */}
              <div className="bg-white p-3 rounded-xl border-2 border-[#8B5CF6]/30 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-[#7C3AED]">CordChain Affiliated</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9] text-[9.5px] font-mono font-bold">
                    3x Priority
                  </span>
                </div>
                <p className="text-[18px] font-bold text-[#18181B] font-mono">
                  {selectedServer.cordchainMembers.toLocaleString()}
                </p>
                <p className="text-[10px] text-[#71717A] mt-0.5">Signed up on CordChain</p>
              </div>

              {/* Active Daily Members (2nd Priority) */}
              <div className="bg-white p-3 rounded-xl border border-[#3B82F6]/30 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-[#2563EB]">Active Daily</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#DBEAFE] text-[#1D4ED8] text-[9.5px] font-mono font-bold">
                    2x Weight
                  </span>
                </div>
                <p className="text-[18px] font-bold text-[#18181B] font-mono">
                  {selectedServer.activeMembers.toLocaleString()}
                </p>
                <p className="text-[10px] text-[#71717A] mt-0.5">Chatting & scrimming</p>
              </div>

              {/* Online Members (3rd Priority) */}
              <div className="bg-white p-3 rounded-xl border border-[#10B981]/30 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-[#059669]">Online Presence</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#D1FAE5] text-[#047857] text-[9.5px] font-mono font-bold">
                    1.5x Weight
                  </span>
                </div>
                <p className="text-[18px] font-bold text-[#18181B] font-mono">
                  {selectedServer.onlineMembers.toLocaleString()}
                </p>
                <p className="text-[10px] text-[#71717A] mt-0.5">Currently connected</p>
              </div>

              {/* Total Members (Baseline) */}
              <div className="bg-white p-3 rounded-xl border border-[#EAE9E4] shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-[#71717A]">Total Guild</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#F4F4F5] text-[#52525B] text-[9.5px] font-mono font-bold">
                    1x Weight
                  </span>
                </div>
                <p className="text-[18px] font-bold text-[#18181B] font-mono">
                  {selectedServer.totalMembers.toLocaleString()}
                </p>
                <p className="text-[10px] text-[#71717A] mt-0.5">All Discord members</p>
              </div>
            </div>

            {/* Tangible Market Advantages Unlocked */}
            <div className="bg-white/80 rounded-xl p-3 border border-[#EAE9E4] flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />
                <span className="text-[#71717A]">Shareholder Dividend Boost:</span>
                <strong className="text-[#10B981]">+{advantage.dividendApyBonusPct}% APY</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span className="text-[#71717A]">Exchange Fee Tier:</span>
                <strong className="text-[#18181B]">{advantage.exchangeFeeDiscountPct}% (Lowest)</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span className="text-[#71717A]">Protocol AMM Pairing Depth:</span>
                <strong className="text-[#18181B]">${advantage.ammLiquidityBonusUsd.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* SECTION 3: TWO REAL-TIME MEMBER LISTS */}
          {/* ======================================================== */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <h3 className="text-[12px] font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>3. Real-Time Community Member Rosters</span>
                </h3>
                <p className="text-[11.5px] text-[#71717A]">
                  Maintaining two live lists: CordChain Affiliated Traders vs All Discord Guild Members.
                </p>
              </div>

              {/* Roster Tab Switcher */}
              <div className="flex items-center bg-[#EFECE6] p-1 rounded-xl text-[11px] font-medium shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveRosterTab('cordchain')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    activeRosterTab === 'cordchain'
                      ? 'bg-white text-[#18181B] font-bold shadow-2xs'
                      : 'text-[#71717A] hover:text-[#18181B]'
                  }`}
                >
                  CordChain Traders ({selectedServer.cordchainMembers})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRosterTab('discord')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    activeRosterTab === 'discord'
                      ? 'bg-white text-[#18181B] font-bold shadow-2xs'
                      : 'text-[#71717A] hover:text-[#18181B]'
                  }`}
                >
                  Discord Members ({selectedServer.totalMembers.toLocaleString()})
                </button>
              </div>
            </div>

            {/* Roster View Container */}
            <div className="bg-[#FAF9F6] border border-[#EAE9E4] rounded-2xl p-3 max-h-[170px] overflow-y-auto">
              {activeRosterTab === 'cordchain' ? (
                /* List 2: CordChain Affiliated Members */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {memberStats.cordchainMemberList.map((member) => (
                    <div
                      key={member.id}
                      className="p-2.5 rounded-xl bg-white border border-[#EAE9E4] flex items-center justify-between text-[11.5px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#8B5CF6]/15 text-[#7C3AED] flex items-center justify-center font-bold text-[11px] shrink-0 font-mono">
                          {member.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#18181B] truncate">{member.username}</p>
                          <p className="text-[10px] text-[#71717A] font-mono">{member.discordTag} • {member.traderRank}</p>
                        </div>
                      </div>

                      <div className="text-right font-mono text-[10.5px] shrink-0">
                        <p className="font-bold text-[#10B981]">{member.sharesHeld.toLocaleString()} shares</p>
                        <p className="text-[#71717A]">{member.boostCount} boosts • {member.walletAddress}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* List 1: Discord Guild Members */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {memberStats.discordMemberList.map((member) => (
                    <div
                      key={member.id}
                      className="p-2 rounded-xl bg-white border border-[#EAE9E4] flex items-center justify-between text-[11px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            member.status === 'online'
                              ? 'bg-[#10B981]'
                              : member.status === 'idle'
                              ? 'bg-[#F59E0B]'
                              : member.status === 'dnd'
                              ? 'bg-[#EF4444]'
                              : 'bg-[#A1A1AA]'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-[#18181B] truncate">{member.displayName}</p>
                          <p className="text-[9.5px] text-[#71717A] truncate font-mono">{member.role}</p>
                        </div>
                      </div>

                      <span className="text-[9.5px] text-[#52525B] font-mono shrink-0 bg-[#F4F4F5] px-1.5 py-0.5 rounded">
                        {member.messages7d} msgs
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* SECTION 4: TOKEN CUSTOMIZATION & IPO SHARE PARAMETERS */}
          {/* ======================================================== */}
          <form id="tokenize-server-form" onSubmit={handleSubmit} className="space-y-4 pt-1 border-t border-[#EAE9E4]">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-[#10B981]" />
                <span>4. Token Customization & IPO Share Float (Rare & Unique)</span>
              </h3>
              <span className="text-[10px] text-[#71717A] bg-[#F7F6F3] px-2 py-0.5 rounded-md font-mono">
                No Duplicate Names Allowed
              </span>
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-[12px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {selectedServer && !selectedServer.isOwner && (
              <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#DC2626]">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0 text-[#DC2626]" />
                  <span>
                    Token parameter editing is locked for <strong>{selectedServer.name}</strong> because you are an {selectedServer.role}, not the verified Discord Server Owner.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const firstOwned = availableOwnedServers.find((s) => s.isOwner);
                    if (firstOwned) setSelectedServer(firstOwned);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white border border-[#FECACA] text-[#DC2626] font-semibold text-[11px] hover:bg-[#FEF2F2] cursor-pointer shrink-0"
                >
                  Switch to an Owned Server
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Rare Ticker Input */}
              <div>
                <label className="block text-[11.5px] font-medium text-[#52525B] mb-1">
                  Token Ticker Symbol <span className="text-[#EF4444]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-[13px] font-mono text-[#71717A] font-bold">$</span>
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="SAMURAI"
                    value={cleanTickerCode}
                    onChange={(e) => setTickerRaw(e.target.value)}
                    className={`w-full pl-7 pr-3 py-2 rounded-xl border text-[13px] font-mono font-bold uppercase transition-all outline-none ${
                      tickerValidation.error
                        ? 'border-[#EF4444] bg-[#FDF2F2] text-[#EF4444]'
                        : 'border-[#EAE9E4] bg-[#FAF9F6] focus:bg-white focus:border-[#10B981]'
                    }`}
                    required
                  />
                </div>
                {tickerValidation.error ? (
                  <p className="text-[10.5px] text-[#EF4444] mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{tickerValidation.error}</span>
                  </p>
                ) : (
                  <p className="text-[10.5px] text-[#10B981] mt-1 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Rare Ticker Available: ${cleanTickerCode}</span>
                  </p>
                )}
              </div>

              {/* IPO Opening Price — activity-priced, fixed by protocol */}
              <div>
                <label className="block text-[11.5px] font-medium text-[#52525B] mb-1">
                  IPO Opening Price (USD)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value="$0.000100"
                    readOnly
                    className="w-full px-3 py-2 rounded-xl border border-[#EAE9E4] text-[13px] font-mono font-bold bg-[#FAF9F6] text-[#18181B] cursor-not-allowed outline-none focus:border-[#10B981]"
                  />
                  <span className="absolute right-3 top-2 text-[10px] font-medium text-[#10B981] flex items-center gap-1">
                    <Lock className="w-3 h-3" /> protocol
                  </span>
                </div>
                <p className="text-[10.5px] text-[#10B981] mt-1 font-mono">
                  Activity-Valued IPO — no owner sets a price. Value grows only from real chat engagement + live orders.
                </p>
              </div>

              {/* Total Supply Presets */}
              <div>
                <label className="block text-[11.5px] font-medium text-[#52525B] mb-1">
                  Total Share Supply
                </label>
                <div className="flex items-center gap-1">
                  {[250000, 500000, 1000000, 5000000].map((sup) => (
                    <button
                      type="button"
                      key={sup}
                      onClick={() => setTotalSupply(sup)}
                      className={`flex-1 py-2 rounded-xl border text-[11px] font-mono transition-colors cursor-pointer ${
                        totalSupply === sup
                          ? 'border-[#18181B] bg-[#18181B] text-white font-bold'
                          : 'border-[#EAE9E4] bg-[#FAF9F6] text-[#52525B] hover:bg-[#F3F2EE]'
                      }`}
                    >
                      {sup >= 1000000 ? `${sup / 1000000}M` : `${sup / 1000}K`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* IPO Share Float & Allocation Sliders */}
            <div className="bg-[#FAF9F6] border border-[#EAE9E4] rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="font-semibold text-[#18181B] flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#5865F2]" />
                  IPO Share Allocation & Manageable Float
                </span>
                <span className="font-mono text-[#71717A] text-[11px]">
                  Total: {totalSupply.toLocaleString()} shares (Cap: ${(numericPrice * totalSupply).toFixed(2)})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11.5px]">
                {/* Public IPO Float */}
                <div className="bg-white p-2.5 rounded-lg border border-[#EAE9E4]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#52525B] font-medium">Public IPO Float</span>
                    <strong className="text-[#10B981] font-mono">{publicFloatPct}%</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="60"
                    value={publicFloatPct}
                    onChange={(e) => setPublicFloatPct(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#E4E4E7] rounded-lg cursor-pointer accent-[#10B981]"
                  />
                  <p className="text-[10px] text-[#71717A] font-mono mt-1">
                    {publicSharesCount.toLocaleString()} shares • Raise: ${(numericPrice * publicSharesCount).toFixed(4)}
                  </p>
                </div>

                {/* Creator Founder Reserve */}
                <div className="bg-white p-2.5 rounded-lg border border-[#EAE9E4]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#52525B] font-medium">Creator Reserve</span>
                    <strong className="text-[#8B5CF6] font-mono">{creatorReservePct}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={creatorReservePct}
                    onChange={(e) => setCreatorReservePct(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#E4E4E7] rounded-lg cursor-pointer accent-[#8B5CF6]"
                  />
                  <p className="text-[10px] text-[#71717A] font-mono mt-1">
                    {creatorSharesCount.toLocaleString()} shares (Granted to {username}) · max 10% — no owner-dump possible
                  </p>
                </div>

                {/* Community Treasury */}
                <div className="bg-white p-2.5 rounded-lg border border-[#EAE9E4]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#52525B] font-medium">Community Treasury</span>
                    <strong className="text-[#F59E0B] font-mono">
                      {Math.max(0, 100 - publicFloatPct - creatorReservePct)}%
                    </strong>
                  </div>
                  <div className="w-full h-1.5 bg-[#FEF3C7] rounded-lg overflow-hidden mt-2">
                    <div
                      className="h-full bg-[#F59E0B]"
                      style={{ width: `${Math.max(0, 100 - publicFloatPct - creatorReservePct)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#71717A] font-mono mt-1">
                    {treasurySharesCount.toLocaleString()} shares for staking dividends
                  </p>
                </div>
              </div>
            </div>

            {/* Public Discord Invite Link (compulsory for directory listing) */}
            <div>
              <label className="block text-[11.5px] font-medium text-[#52525B] mb-1">
                Public Discord Invite Link <span className="text-[#EF4444]">*</span>
              </label>
              <div className="relative">
                <Link2 className="absolute left-3 top-2 w-4 h-4 text-[#71717A]" />
                <input
                  type="text"
                  placeholder="https://discord.gg/your-permanent-invite"
                  value={inviteUrlInput}
                  onChange={(e) => setInviteUrlInput(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 rounded-xl border text-[12.5px] bg-[#FAF9F6] focus:bg-white outline-none transition-all ${
                    inviteUrlInput.trim() && !inviteValidation.valid
                      ? 'border-[#EF4444] bg-[#FDF2F2]'
                      : inviteValidation.valid
                      ? 'border-[#EAE9E4] focus:border-[#10B981]'
                      : 'border-[#EAE9E4] focus:border-[#18181B]'
                  }`}
                  required
                />
              </div>
              {inviteUrlInput.trim() && !inviteValidation.valid ? (
                <p className="text-[10.5px] text-[#EF4444] mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{inviteValidation.error}</span>
                </p>
              ) : inviteValidation.valid ? (
                <p className="text-[10.5px] text-[#10B981] mt-1 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>Valid public invite: {inviteValidation.normalized}</span>
                </p>
              ) : (
                <p className="text-[10.5px] text-[#71717A] mt-1">
                  Investors join via the Discover page — use a permanent (never-expiring) invite code.
                </p>
              )}
            </div>

            {/* Brand Accent & Bio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11.5px] font-medium text-[#52525B] mb-1">
                  Token Brand Accent
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ICON_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.id}
                      onClick={() => setSelectedIconPreset(preset.id)}
                      className={`px-2 py-1.5 rounded-xl border text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
                        selectedIconPreset === preset.id
                          ? 'border-[#18181B] bg-white font-semibold shadow-xs'
                          : 'border-[#EAE9E4] bg-[#FAF9F6] text-[#52525B]'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.color }} />
                      <span className="truncate">{preset.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-[#52525B] mb-1">
                  Community Description / Stock Holder Perks
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EAE9E4] text-[12px] bg-[#FAF9F6] focus:bg-white focus:border-[#18181B] outline-none resize-none"
                  placeholder="Share perks for stock holders, dividend policies, and tournament events."
                />
              </div>
            </div>

            {/* ======================================================== */}
            {/* SECTION 4: CORDLEDGER CRYPTOGRAPHIC STOCK ISSUANCE       */}
            {/* ======================================================== */}
            {/* Section 4: CordLedger Cryptographic Stock Issuance */}
            <div className="bg-[#FAF9F6] border border-[#EAE9E4] rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                    <h3 className="text-[13px] font-bold text-[#18181B] uppercase tracking-wider">
                      4. CordLedger Cryptographic Stock Issuance
                    </h3>
                  </div>
                  <p className="text-[11.5px] text-[#71717A] mt-0.5">
                    Issued directly onto the append-only CordLedger with fixed 1,000,000 shares, constant-product AMM liquidity, and tamper-evident SHA-256 hash chaining.
                  </p>
                </div>
              </div>

              {/* CordLedger Stock Allocation Specs */}
              <div className="bg-white border border-[#EAE9E4] rounded-xl p-4 space-y-3 text-[12.5px]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-[#F8F7F4] border border-[#EAE9E4]">
                    <span className="text-[11px] text-[#71717A] block">Total Fixed Supply</span>
                    <span className="text-[14px] font-bold font-mono text-[#18181B]">1,000,000</span>
                    <span className="text-[10px] text-[#52525B] block mt-0.5">Standardized Across All Servers</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
                    <span className="text-[11px] text-[#15803D] block">Public Float (75%)</span>
                    <span className="text-[14px] font-bold font-mono text-[#166534]">750,000 Shares</span>
                    <span className="text-[10px] text-[#15803D] block mt-0.5">Liquid AMM Trading Pool</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#FEF3C7] border border-[#FDE68A]">
                    <span className="text-[11px] text-[#B45309] block">Creator Reserve (25%)</span>
                    <span className="text-[14px] font-bold font-mono text-[#92400E]">250,000 Shares</span>
                    <span className="text-[10px] text-[#B45309] block mt-0.5">50k at IPO + 5%/mo Vesting</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-1.5 text-[11.5px] text-[#52525B]">
                  <div className="flex items-center gap-2 font-semibold text-[#18181B]">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                    <span>Zero Gas & MetaMask Friction</span>
                  </div>
                  <p className="leading-relaxed">
                    Trades instantly on the exchange floor with fantasy $CRED. Every order, trade receipt, and weekly shareholder dividend is cryptographically signed and verifiable by anyone on the public CordScan explorer.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Fixed Sticky Action Footer */}
        <div className="px-6 py-3.5 border-t border-[#EAE9E4] bg-[#FAF9F6] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[11.5px]">
            {selectedServer?.isOwner ? (
              <>
                <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                <span className="text-[#71717A]">
                  <span className="text-[#10B981] font-semibold">CordLedger Stock Issuance: 1,000,000 Fixed Supply (Zero Gas)</span>
                </span>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[10px] font-semibold flex items-center gap-1">
                  <Crown className="w-3 h-3 text-[#EAB308]" />
                  <span>Owner Verified</span>
                </span>
              </>
            ) : selectedServer ? (
              <>
                <div className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
                <span className="text-[#DC2626] font-medium flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#DC2626]" />
                  <span>Ownership Required: You cannot tokenize servers you do not own ({selectedServer.role})</span>
                </span>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#EAE9E4] text-[12.5px] font-medium text-[#52525B] hover:bg-[#F7F6F3] cursor-pointer"
            >
              Cancel
            </button>
            {selectedServer?.isOwner ? (
              <button
                type="submit"
                form="tokenize-server-form"
                disabled={!canSubmit || isSubmitting}
                className={`px-5 py-2 rounded-xl text-[12.5px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  canSubmit && !isSubmitting
                    ? 'bg-[#18181B] text-white hover:bg-[#27272A] shadow-xs'
                    : 'bg-[#EAE9E4] text-[#A1A1AA] cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isSubmitting
                    ? 'Registering on CordChain...'
                    : tokenType === 'deploy_onchain' && !deployedContract
                    ? 'Deploy ERC-20 First (Above)'
                    : 'Tokenize & Launch IPO'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="px-5 py-2 rounded-xl text-[12.5px] font-semibold flex items-center gap-1.5 bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] cursor-not-allowed opacity-90 shadow-2xs"
                title="Only Discord Server Owners holding transfer rights can tokenize this community"
              >
                <Lock className="w-3.5 h-3.5 text-[#DC2626]" />
                <span>Server Ownership Required</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
