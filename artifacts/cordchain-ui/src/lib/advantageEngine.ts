import {
  ServerMemberStats,
  DiscordMemberEntry,
  CordchainAffiliatedMemberEntry,
} from '../types';

export interface AdvantageBreakdown {
  cordchainMembers: number;
  activeMembers: number;
  onlineMembers: number;
  totalMembers: number;
  cordchainScore: number;
  activeScore: number;
  onlineScore: number;
  totalScore: number;
  totalAdvantageScore: number;
  multiplier: number;
  dividendApyBonusPct: number;
  exchangeFeeDiscountPct: number;
  ammLiquidityBonusUsd: number;
  tierBonusLabel: string;
}

export interface ConnectedOwnedServer {
  id: string;
  name: string;
  iconUrl?: string;
  guildId: string;
  isOwner: boolean;
  role: 'Owner' | 'Admin' | 'Moderator' | 'Member';
  inviteUrl?: string;
  suggestedTicker: string;
  suggestedPriceUsd: number;
  totalMembers: number;
  onlineMembers: number;
  activeMembers: number;
  cordchainMembers: number;
  category: string;
  description: string;
  tags: string[];
}

/**
 * Calculates the CordChain Community Advantage Multiplier
 * Hierarchy: CordChain Affiliated (3x) > Active (2x) > Online (1.5x) > Total (1x)
 * Balanced & competitive multiplier: subtle, competitive edge without overwhelming the market
 */
export function calculateCommunityAdvantage(
  cordchainMembers: number,
  activeMembers: number,
  onlineMembers: number,
  totalMembers: number
): AdvantageBreakdown {
  const safeTotal = Math.max(1, totalMembers);
  const cordchainScore = cordchainMembers * 3;
  const activeScore = activeMembers * 2;
  const onlineScore = Math.round(onlineMembers * 1.5);
  const totalScore = safeTotal * 1;
  const totalAdvantageScore = cordchainScore + activeScore + onlineScore + totalScore;

  // Normalized ratios based on community adoption
  const cordchainRatio = cordchainMembers / safeTotal;
  const activeRatio = Math.min(1, activeMembers / safeTotal);
  const onlineRatio = Math.min(1, onlineMembers / safeTotal);

  // Competitive multiplier: scales moderately from 1.02x up to 1.25x max
  const rawMult = 1.0 + (cordchainRatio * 1.25) + (activeRatio * 0.08) + (onlineRatio * 0.04);
  const multiplier = +(Math.min(1.25, Math.max(1.02, rawMult)).toFixed(2));

  // Balanced, competitive stock advantages
  const dividendApyBonusPct = +(multiplier * 1.8).toFixed(1);
  const exchangeFeeDiscountPct = multiplier >= 1.20 ? 0.22 : multiplier >= 1.12 ? 0.25 : 0.28;
  const ammLiquidityBonusUsd = Math.round(cordchainMembers * 8 * multiplier);

  let tierBonusLabel = 'Standard Listing';
  if (multiplier >= 1.20) tierBonusLabel = 'Apex Competitive';
  else if (multiplier >= 1.12) tierBonusLabel = 'High Synergy';
  else if (multiplier >= 1.06) tierBonusLabel = 'Active Market';

  return {
    cordchainMembers,
    activeMembers,
    onlineMembers,
    totalMembers,
    cordchainScore,
    activeScore,
    onlineScore,
    totalScore,
    totalAdvantageScore,
    multiplier,
    dividendApyBonusPct,
    exchangeFeeDiscountPct,
    ammLiquidityBonusUsd,
    tierBonusLabel,
  };
}

/**
 * Connected owned Discord servers
 * Only populated from real Discord API OAuth guilds that the user owns.
 */
export const PRESET_OWNED_DISCORD_SERVERS: ConnectedOwnedServer[] = [];

/**
 * Generate two realistic real-time member lists for any Discord server
 */
export function generateServerMemberStats(
  serverId: string,
  totalMembers: number = 8500,
  cordchainCount?: number,
  activeCount?: number,
  onlineCount?: number
): ServerMemberStats {
  const online = onlineCount ?? Math.min(totalMembers, Math.round(totalMembers * 0.32));
  const active = activeCount ?? Math.min(totalMembers, Math.max(online, Math.round(totalMembers * 0.48)));
  const cordchain = cordchainCount ?? Math.min(totalMembers, Math.max(1, Math.round(totalMembers * 0.07)));

  const breakdown = calculateCommunityAdvantage(cordchain, active, online, totalMembers);

  // Generate authentic Discord member directory
  const discordRosterSample = [
    { username: 'zephyrus_prime', display: 'Zephyrus (Owner)', role: 'Server Owner', status: 'online' as const, msgs: 642 },
    { username: 'kryptonix_mod', display: 'Kryptonix', role: 'Head Admin', status: 'online' as const, msgs: 512 },
    { username: 'solaris_tactics', display: 'Solaris', role: 'Tournament Lead', status: 'idle' as const, msgs: 384 },
    { username: 'vanguard_alpha', display: 'Vanguard Alpha', role: 'Moderator', status: 'dnd' as const, msgs: 298 },
    { username: 'shadow_scrims', display: 'ShadowSniper', role: 'Server Booster', status: 'online' as const, msgs: 410 },
    { username: 'pixel_monk', display: 'PixelMonk', role: 'Veteran Member', status: 'offline' as const, msgs: 185 },
    { username: 'neontitan', display: 'Neon Titan', role: 'Server Booster', status: 'online' as const, msgs: 320 },
    { username: 'astral_echo', display: 'Astral Echo', role: 'Content Creator', status: 'online' as const, msgs: 275 },
    { username: 'quantum_coder', display: 'Quantum Coder', role: 'Bot Engineer', status: 'idle' as const, msgs: 215 },
    { username: 'cyber_valk', display: 'Cyber Valkyrie', role: 'Member', status: 'offline' as const, msgs: 94 },
    { username: 'apex_predator', display: 'ApexPred', role: 'Scrim Champion', status: 'online' as const, msgs: 460 },
    { username: 'frost_byte', display: 'FrostByte', role: 'Member', status: 'online' as const, msgs: 140 },
  ];

  const discordMemberList: DiscordMemberEntry[] = discordRosterSample.map((u, i) => ({
    id: `disc-${serverId}-${i + 1}`,
    username: u.username,
    displayName: u.display,
    status: u.status,
    role: u.role,
    isActiveChatter: u.msgs > 150,
    messages7d: u.msgs,
    joinedAt: '3 months ago',
  }));

  // Generate CordChain affiliated traders signed up from this server
  const cordchainTradersSample = [
    { username: 'ayushduoking', tag: 'ayush#0001', rank: 'Diamond Whale', shares: 24320, boosts: 140, roi: 142.5, verified: true, wallet: '0xc168...9a65' },
    { username: 'zephyrus_prime', tag: 'zeph#7721', rank: 'Alpha Founder', shares: 14200, boosts: 95, roi: 98.4, verified: true, wallet: '0x8b32...4f10' },
    { username: 'solaris_tactics', tag: 'sol#8812', rank: 'Radiant Trader', shares: 9800, boosts: 62, roi: 76.2, verified: true, wallet: '0x5e19...c890' },
    { username: 'shadow_scrims', tag: 'shad#3304', rank: 'Top Booster', shares: 6400, boosts: 54, roi: 64.1, verified: true, wallet: '0x2a46...a7af' },
    { username: 'neontitan', tag: 'neon#1192', rank: 'Verified Trader', shares: 4200, boosts: 38, roi: 45.8, verified: true, wallet: '0x99e1...12b4' },
    { username: 'astral_echo', tag: 'ast#9090', rank: 'Creative Patron', shares: 3100, boosts: 25, roi: 38.0, verified: true, wallet: '0x7120...39de' },
    { username: 'kryptonix_mod', tag: 'krypt#4451', rank: 'Arena Champion', shares: 2800, boosts: 22, roi: 29.4, verified: true, wallet: '0x14f9...88cd' },
    { username: 'quantum_coder', tag: 'qc#6620', rank: 'Guild Tactician', shares: 1950, boosts: 18, roi: 22.1, verified: true, wallet: '0x33b8...90ef' },
  ];

  const cordchainMemberList: CordchainAffiliatedMemberEntry[] = cordchainTradersSample.map((t, i) => ({
    id: `cord-${serverId}-${i + 1}`,
    username: t.username,
    discordTag: t.tag,
    traderRank: t.rank,
    sharesHeld: t.shares,
    boostCount: t.boosts,
    isVerifiedTrader: t.verified,
    walletAddress: t.wallet,
    joinedCordchainAt: `${i + 1} months ago`,
    roiPct: t.roi,
  }));

  return {
    totalMembers,
    onlineMembers: online,
    activeDailyMembers: active,
    cordchainAffiliatedMembers: cordchain,
    advantageMultiplier: breakdown.multiplier,
    discordMemberList,
    cordchainMemberList,
  };
}
