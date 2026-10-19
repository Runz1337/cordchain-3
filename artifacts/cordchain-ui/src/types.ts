export type MainTab =
  | 'Home'
  | 'Dashboard'
  | 'Exchange'
  | 'Wallet'
  | 'CordScan'
  | 'Guide'
  | 'Manage'
  | 'Leaderboard'
  | 'Portfolio'
  | 'Settings';

export type HomeSideNav = 'Dashboard' | 'Boost Server' | 'Exchange' | 'Wallet' | 'Manage' | 'Ad Creator';
export type ExchangeSideNav = 'Dashboard' | 'Market' | 'Watchlist' | 'My Portfolio' | 'Leaderboard';

export type LeagueType = 'Titan' | 'Arena' | 'Club' | 'Squad';

export interface DiscordMemberEntry {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  role: string;
  isActiveChatter: boolean;
  messages7d: number;
  joinedAt: string;
}

export interface CordchainAffiliatedMemberEntry {
  id: string;
  username: string;
  discordTag: string;
  avatarUrl?: string;
  traderRank: string;
  sharesHeld: number;
  boostCount: number;
  isVerifiedTrader: boolean;
  walletAddress?: string;
  joinedCordchainAt: string;
  roiPct?: number;
}

export interface ServerMemberStats {
  totalMembers: number;
  onlineMembers: number;
  activeDailyMembers: number;
  cordchainAffiliatedMembers: number;
  advantageMultiplier: number;
  discordMemberList: DiscordMemberEntry[];
  cordchainMemberList: CordchainAffiliatedMemberEntry[];
}

export interface ServerAsset {
  id: string;
  ticker: string;
  name: string;
  category: string;
  league: LeagueType;
  rank: number;
  members: string;
  priceInr: number;
  priceUsd: number;
  change24h: number;
  sidebarChange24h: number;
  volume24h: string;
  high24hUsd: number;
  low24hUsd: number;
  marketCapUsd: string;
  description: string;
  tags: string[];
  isIpo?: boolean;
  holdings?: number;
  avgBuyPriceUsd?: number;
  marketState?: 'live' | 'dormant';
  collaboration?: {
    tierName: string;
    tier: number;
    icon: string;
    contributors24h: number;
    multiplier: number;
    bonusPct: number;
    description: string;
  };
  tokenContractAddress?: string;
  tokenExplorerUrl?: string;
  blockchainNetwork?: string;
  memberStats?: ServerMemberStats;
  advantageMultiplier?: number;
  discordServerId?: string;
  discordInviteUrl?: string;
  bumpCount?: number;
  lastBumpedAt?: string;
  isVerified?: boolean;
  membersCount?: number;
  ipoDetails?: {
    totalSupply: number;
    publicFloatPct: number;
    creatorAllocationPct: number;
    treasuryReservePct: number;
    initialIpoPriceUsd: number;
    shareholdersSplit: number;
    treasurySplit: number;
    ownerSplit: number;
  };
}

export interface CandlePoint {
  time: string;
  dateLabel?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookRow {
  price: number;
  amount: number;
  total: string;
  depthPercent: number;
}

export interface TradeRecord {
  id: string;
  price: number;
  amount: number;
  time: string;
  side: 'buy' | 'sell';
}

export interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  isPositive: boolean;
  timeAgo: string;
  type: 'boost' | 'buy' | 'sell' | 'ad' | 'withdraw';
}

export interface UserProfile {
  name: string;
  username: string;
  email: string;
  discordId: string;
  avatarUrl?: string;
  isLoggedIn: boolean;
  connectedGuildsCount: number;
  reputationScore: number;
  tierRole: string;
  joinedDate: string;
}

export interface TraderLeaderboardEntry {
  rank: number;
  username: string;
  discordTag: string;
  roiPct: number;
  profitUsd: number;
  winRate: number;
  topAsset: string;
  badge: string;
  isCurrentUser?: boolean;
}

export interface ServerLeaderboardEntry {
  rank: number;
  ticker: string;
  name: string;
  league: LeagueType;
  members: string;
  marketCapUsd: string;
  boostPower: number;
  dividendYield: string;
  change7d: number;
}

export interface SettingsState {
  currency: 'INR' | 'USD';
  slippageTolerance: '0.1%' | '0.5%' | '1.0%' | 'Custom';
  confirmOrders: boolean;
  showDepthAnimation: boolean;
  upiId: string;
  autoWithdrawalEnabled: boolean;
  autoWithdrawThreshold: number;
  emailAlerts: boolean;
  priceAlertThreshold: number;
  discordWebhookUrl: string;
  botAlertsEnabled: boolean;
  soundEffects: boolean;
}

export interface AdCampaign {
  id: string;
  ticker: string;
  serverName: string;
  tagline: string;
  budgetCred: number;
  spentCred: number;
  impressions: number;
  clicks: number;
  status: 'active' | 'completed' | 'paused';
  createdAt: string;
}

export interface OwnedServerStock {
  serverId: string;
  ticker: string;
  serverName: string;
  description?: string;
  category?: string;
  iconUrl?: string;
  tokenContractAddress?: string | null;
  tokenExplorerUrl?: string | null;
  discordGuildId: string;
  inviteUrl?: string | null;
  bumpCount?: number;
  lastBumpedAt?: string | null;
  membersCount: number;
  isListed: boolean;
  totalSupply: number;
  circulatingSupply: number;
  treasuryReserve: number;
  currentPriceInr: number;
  initialIpoPriceInr: number;
  dividendSplitShareholders: number; // percentage (e.g. 60)
  dividendSplitTreasury: number; // percentage (e.g. 25)
  dividendSplitOwner: number; // percentage (e.g. 15)
  boostRewardMultiplier: number; // e.g. 1.5x
  adMonetizationEnabled: boolean;
  botInstalled: boolean;
  treasuryBalanceCred: number;
  treasuryBalanceInr: number;
  totalDividendsDistributedInr: number;
  topHolders: { username: string; shares: number; pct: number }[];
  memberStats?: ServerMemberStats;
  advantageMultiplier?: number;
}
