import type {
  ServerAsset,
  CandlePoint,
  OrderBookRow,
  TradeRecord,
  AdCampaign,
} from '../types';

/**
 * CordChain live backend client.
 *
 * Talks to the FastAPI service (cordchain/api.py) documented in cordchain/API_DOCS.md.
 * Every function degrades gracefully: callers catch failures and fall back to the
 * bundled demo dataset so the terminal stays usable offline.
 */

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;

export const API_BASE_URL = env.VITE_API_URL || '';

export const DEMO_USER = {
  id: env.VITE_DEMO_USER_ID || '750015265135263835',
  discordId: env.VITE_DEMO_USER_ID || '750015265135263835',
  username: env.VITE_DEMO_USERNAME || 'sploit.uwu',
  avatar: 'https://cdn.discordapp.com/avatars/750015265135263835/19e532055c865ebfc47c10982ddeb281.png?size=128',
  guildId: env.VITE_DEMO_GUILD_ID || '1559968534795255868',
};

// ---------------- Auth session (Discord OAuth2) ----------------

export interface ApiSessionUser {
  discordId: string;
  username: string;
  avatar: string | null;
  email: string | null;
}

export interface ApiSessionGuild {
  id: string;
  name: string;
  icon?: string | null;
  iconUrl: string | null;
  owner?: boolean;
  permissions?: string;
  features?: string[];
  approximateMemberCount?: number;
  approximatePresenceCount?: number;
}

export interface ApiSession {
  sessionToken?: string;
  user: ApiSessionUser;
  guilds: ApiSessionGuild[];
  ownedGuilds?: ApiSessionGuild[];
  botClientId?: string;
  installedGuildIds?: string[];
}

const SESSION_KEY = 'cordchain.session.v1';

interface StoredSession {
  token: string;
  user: ApiSessionUser;
  guilds: ApiSession['guilds'];
}

export const loadStoredSession = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
};

export const storeSession = (token: string, user: ApiSessionUser, guilds: ApiSession['guilds']) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user, guilds }));
};

export const clearStoredSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const leagueTierName = (tier: number | string): ServerAsset['league'] => {
  switch (String(tier)) {
    case '4':
      return 'Titan';
    case '3':
      return 'Arena';
    case '2':
      return 'Club';
    default:
      return 'Squad';
  }
};

// ---------------- Wire types ----------------

export interface ApiGuild {
  guildId: string;
  name: string;
  ticker: string;
  iconUrl: string | null;
  leagueTier: number;
  memberCountCurrent: number;
  memberCountPeak7d: number;
  stockPrice: string;
  previousDayPrice: string;
  circulatingShares: number;
  // Trading-world honesty: shares actually owned by wallets (incl. creator
  // reserve). When this is 0 the market is dormant and quotes rest at $0.
  heldShares?: number;
  marketState?: 'live' | 'dormant';
  // Real shareholder register — [] simply means nobody holds anything.
  topHolders?: Array<{ username: string; shares: number }>;
  totalSupply?: number;
  treasuryReserve?: number;
  dividendSplitShareholders?: number;
  dividendSplitTreasury?: number;
  dividendSplitOwner?: number;
  boostRewardMultiplier?: number;
  adMonetizationEnabled?: boolean;
  description?: string;
  category?: string;
  inviteUrl?: string | null;
  bumpCount?: number;
  lastBumpedAt?: string | null;
  ownerId?: string;
  ownerCashWalletInr?: string;
  changePct: number;
  isGain: boolean;
  volume24hShares?: number;
  volume24hUsd?: number;
  executions24h?: number;
  high24hUsd?: number;
  low24hUsd?: number;
  tokenContractAddress?: string | null;
  tokenExplorerUrl?: string | null;
  blockchainNetwork?: string | null;
  collaboration?: any;
}

export interface ApiWalletSummary {
  user: { discordId: string; username: string; avatar: string | null };
  wallets: {
    credBalance: string;
    cashWalletInr: string;
    portfolioStockValueCred: string;
    totalNetWorthCred: string;
  };
  dailyAllowanceAvailable?: boolean;
  dailyEarnedCred?: number;
  dailyEarnCapCred?: number;
  credVaultBalance?: number;
  creatorVesting?: Record<string, { vested: number; locked: number; total: number; unlockPctMonthly: number }>;
  cashout: {
    minWithdrawalThresholdInr: number;
    canWithdraw: boolean;
    progressPct: string;
  };
  dailyStatus: {
    boostsUsedToday: number;
    maxDailyBoosts: number;
    canClaimCashDrop: boolean;
  };
  holdings: Array<{
    guildId: string;
    ticker: string;
    serverName: string;
    shares: number;
    avgBuyPrice: string;
    currentPrice: string;
    totalValueCred: string;
    unrealizedPnlCred: string;
  }>;
}

export interface ApiCheckinInitiate {
  guild: { id: string; name: string; ticker: string; stockPrice: string };
  campaign: {
    campaignId: string;
    sponsorName: string;
    title: string;
    description: string;
    mediaUrl: string;
    verifyQuestion: string;
    options: string[];
  };
  isPaidDrop: boolean;
  accountAgeQualified: boolean;
  currentDailyBoosts: number;
  minWatchSeconds: number;
}

export interface ApiCheckinVerify {
  success: boolean;
  verified: boolean;
  message?: string;
  credAwarded?: number;
  isPaidDrop?: boolean;
  userPayoutInr?: number;
  newCredBalance?: string;
  newCashWalletInr?: string;
  newStockPrice?: string;
  dailyBoostCount?: number;
  boostsRemainingToday?: number;
}

export interface ApiTradeQuote {
  guildId: string;
  ticker: string;
  currentPrice: string;
  shares: number;
  action: string;
  totalCred: string;
  estimatedSlippagePct: number;
}

export interface ApiTradeBlockchainReceipt {
  blockchainTxHash: string | null;
  blockNumber: number | null;
  network: string;
  chainId: number;
  tokenAddress: string;
  ammRouterAddress: string;
  walletAddress: string;
  explorerUrl: string | null;
  tokenExplorerUrl: string | null;
  onChainStatus: string;
  gasUsed: number | null;
  isMinedOnChain?: boolean;
}

export interface ApiTradeResult {
  success: boolean;
  action: string;
  ticker: string;
  sharesBought?: number;
  sharesSold?: number;
  pricePerShare: string;
  totalCredSpent?: string;
  totalCredReceived?: string;
  newCredBalance: string;
  newMarketPrice?: string;
  holding?: { shares: number; avgBuyPrice: string };
  remainingShares?: number;
  transactionId: string | null;
  blockchain?: ApiTradeBlockchainReceipt;
}

export interface ApiCashoutResult {
  success: boolean;
  withdrawalId: string | null;
  amountInr: string;
  destinationUpi: string;
  status: string;
  newCashWalletInr: string;
}

export interface ApiTraderLeaderboardEntry {
  rank: number;
  discordId: string;
  username: string;
  avatar: string | null;
  netWorthCred: string;
  roiPct: number;
  winRate: number;
  topAsset: string;
}

export interface ApiServerLeaderboardEntry {
  rank: number;
  guildId: string;
  ticker: string;
  name: string;
  leagueTier: number;
  leagueName: string;
  iconUrl: string | null;
  memberCountCurrent: number;
  marketCapCred: string;
  boostPower: number;
  dividendYield: string;
  change24hPct: number;
}

export interface ApiCampaign {
  campaignId: string;
  sponsorName: string;
  title: string;
  description: string;
  mediaUrl: string;
  cpiRateInr: string;
  userRewardInr: string;
  remainingBudgetInr: string;
  targetCategory: string;
}

// ---------------- Fetch core ----------------

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const stored = loadStoredSession();
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(stored?.token ? { Authorization: `Bearer ${stored.token}` } : {}),
      ...(extraHeaders || {}),
    },
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: any; error?: string; message?: string };
    let msg = `HTTP ${res.status}`;
    if (typeof data.detail === 'string') {
      msg = data.detail;
    } else if (Array.isArray(data.detail)) {
      msg = data.detail.map((e: any) => e.msg || e.detail || JSON.stringify(e)).join('; ');
    } else if (typeof data.error === 'string') {
      msg = data.error;
    } else if (typeof data.message === 'string') {
      msg = data.message;
    } else if (data.detail && typeof data.detail === 'object') {
      msg = JSON.stringify(data.detail);
    }
    throw new ApiError(msg, res.status);
  }
  try {
    return (await res.json()) as T;
  } catch {
    // A 2xx response that isn't JSON means this origin has no API behind it
    // (e.g. the page was opened on a port without the /api proxy).
    throw new ApiError(
      'The CordChain API did not return JSON for this request — the page origin has no /api proxy. Open the app on the dev server (port 3000).',
      res.status,
    );
  }
}

// ---------------- Endpoint wrappers ----------------

export const fetchGuilds = (params: { tier?: number; sort?: string; search?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.tier) qs.set('tier', String(params.tier));
  if (params.sort) qs.set('sort', params.sort);
  if (params.search) qs.set('search', params.search);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<{ guilds: ApiGuild[] }>(`/api/guilds${suffix}`);
};

export const fetchFeaturedGuilds = () =>
  apiFetch<{ featured: ApiGuild[] }>('/api/guilds/featured');

export const fetchGuild = (guildId: string) =>
  apiFetch<{ guild: ApiGuild }>(`/api/guilds/${guildId}`);

export const fetchWalletSummary = (userId: string) =>
  apiFetch<ApiWalletSummary>(`/api/wallet/summary?userId=${encodeURIComponent(userId)}`);

export const initiateCheckin = (guildId: string, userId: string) =>
  apiFetch<ApiCheckinInitiate>('/api/checkin/initiate', {
    method: 'POST',
    body: JSON.stringify({ guildId, userId }),
  });

export const verifyCheckin = (payload: {
  guildId: string;
  userId: string;
  campaignId: string;
  selectedOption: string;
}) =>
  apiFetch<ApiCheckinVerify>('/api/checkin/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const quoteTrade = (guildId: string, action: 'BUY' | 'SELL', shares: number) =>
  apiFetch<ApiTradeQuote>('/api/trade/quote', {
    method: 'POST',
    body: JSON.stringify({ guildId, action, shares }),
  });

export const buyShares = (guildId: string, userId: string, shares: number, walletAddress?: string) =>
  apiFetch<ApiTradeResult>('/api/trade/buy', {
    method: 'POST',
    body: JSON.stringify({ guildId, userId, shares, walletAddress }),
  });

export const sellShares = (guildId: string, userId: string, shares: number, walletAddress?: string) =>
  apiFetch<ApiTradeResult>('/api/trade/sell', {
    method: 'POST',
    body: JSON.stringify({ guildId, userId, shares, walletAddress }),
  });

// Attaches a user-signed on-chain notarization tx (real MetaMask transaction)
// to an already-executed ledger trade record.
export const registerTradeTx = (payload: { transactionId: string; txHash: string; blockNumber?: number | null; walletAddress?: string }) =>
  apiFetch<{ success: boolean; explorerUrl: string }>('/api/trade/register-tx', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export interface TokenizeGuildPayload {
  guildId: string;
  name: string;
  ticker: string;
  description?: string;
  category?: string;
  inviteUrl: string;
  initialPriceUsd: number;
  totalSupply: number;
  publicFloatPct: number;
  creatorReservePct: number;
  iconUrl?: string;
  memberCount: number;
  onlineCount: number;
  ownerId?: string;
  tokenContractAddress?: string;
  deploymentTxHash?: string;
}

export const tokenizeGuildApi = (payload: TokenizeGuildPayload) =>
  apiFetch<{ success: boolean; guild: ApiGuild }>('/api/guild/tokenize', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export interface UpdateGuildPayload {
  name?: string;
  ticker?: string;
  iconUrl?: string;
  description?: string;
  category?: string;
  inviteUrl?: string;
  dividendSplitShareholders?: number;
  dividendSplitTreasury?: number;
  dividendSplitOwner?: number;
  boostRewardMultiplier?: number;
  adMonetizationEnabled?: boolean;
  additionalShares?: number;
  tokenContractAddress?: string;
}

export const updateGuildApi = (guildId: string, payload: UpdateGuildPayload) =>
  apiFetch<{ success: boolean; guild: ApiGuild }>(`/api/guilds/${guildId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export interface BumpGuildResult {
  success: boolean;
  guildId: string;
  ticker: string;
  bumpCount: number;
  lastBumpedAt: string;
  nextBumpAvailableAt: string;
  newStockPrice: string;
  priceGainPct: number;
  cooldownMinutes: number;
}

export const bumpGuildApi = (guildId: string, userId: string) =>
  apiFetch<BumpGuildResult>(`/api/guilds/${guildId}/bump`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });

export interface BumpStatusResult {
  guildId: string;
  ticker: string;
  bumpCount: number;
  canBump: boolean;
  sharesHeld: number;
  eligible: boolean;
  nextBumpAvailableAt: string | null;
  holdsShares: boolean;
  isOwner: boolean;
}

export const fetchBumpStatus = (guildId: string, userId: string) =>
  apiFetch<BumpStatusResult>(`/api/guilds/${guildId}/bump-status?userId=${encodeURIComponent(userId)}`);

const _DISCORD_INVITE_RE =
  /^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite|dsc\.gg)\/([A-Za-z0-9_-]{2,32})\/?$/;

/** Validates a public Discord invite link and returns the normalised https URL (or null). */
export const normalizeDiscordInvite = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(_DISCORD_INVITE_RE);
  if (!match) return null;
  return `https://discord.gg/${match[1]}`;
};

export const deleteGuildApi = (guildId: string) =>
  apiFetch<{ success: boolean; deletedGuildId: string; ticker: string; name: string; message: string }>(
    `/api/guilds/${guildId}`,
    {
      method: 'DELETE',
    },
  );

export interface BlockchainStatus {
  connected: boolean;
  network: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  latestBlock: number;
  gasPriceGwei: number;
  ammRouterAddress: string;
  relayerAddress: string;
  stocksCount: number;
}

export interface BlockchainStock {
  ticker: string;
  name: string;
  symbol: string;
  contractAddress: string;
  explorerUrl: string;
}

export const fetchBlockchainStatus = () => apiFetch<BlockchainStatus>('/api/blockchain/status');

export const fetchBlockchainStocks = () =>
  apiFetch<{ network: string; chainId: number; ammRouter: string; stocks: BlockchainStock[] }>(
    '/api/blockchain/stocks',
  );

export const linkBlockchainWallet = (userId: string, walletAddress: string) =>
  apiFetch<{ success: boolean; walletAddress: string; network: string }>('/api/blockchain/link-wallet', {
    method: 'POST',
    body: JSON.stringify({ userId, walletAddress }),
  });

export const requestCashout = (userId: string, upiVpa: string, amountInr: number) =>
  apiFetch<ApiCashoutResult>('/api/wallet/cashout', {
    method: 'POST',
    body: JSON.stringify({ userId, upiVpa, amountInr }),
  });

// ---------------- CordLedger API ----------------

export interface CordLedgerStatus {
  status: string;
  entriesCount: number;
  blocksHeight: number;
  latestHash: string;
  latestBlockHash: string;
  genesisHash: string;
  signerPublicKey: string;
  isTamperFree: boolean;
}

export interface CordBlock {
  height: number;
  merkleRoot: string;
  blockHash: string;
  signature: string;
  signerPubkey: string;
  entriesCount?: number;
  ts: number;
  createdAt?: string;
}

export interface CordLedgerEntry {
  id?: number;
  index: number;
  eventType: string;
  payload: Record<string, any>;
  prevHash: string;
  hash: string;
  blockHeight: number | null;
  ts: number;
  createdAt?: string;
}

export interface CordLedgerTokenInfo {
  guildId: string;
  ticker: string;
  name: string;
  fixedSupply: number;
  circulatingShares: number;
  creatorReserveShares: number;
  creatorVestedShares: number;
  creatorLockedShares: number;
  stockPrice: number;
  marketCapCred: number;
  communityScore: number;
  leagueTier: number;
  leagueName: string;
  topHolders: Array<{ username: string; shares: number; pct: number }>;
  recentLedgerEntries: CordLedgerEntry[];
}

export interface WeeklyEarningsReport {
  id: number;
  guildId: string;
  weekDate: string;
  communityScore: number;
  totalCredDistributed: number;
  payoutPerShare: number;
  ledgerIndex: number;
  createdAt: string;
}

export const claimDailyAllowance = (userId: string) =>
  apiFetch<{ success: boolean; credAwarded: number; newCredBalance: string; message: string }>('/api/wallet/claim-allowance', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });

export const fetchLedgerStatus = () => apiFetch<CordLedgerStatus>('/api/ledger/status');

export const fetchLedgerBlocks = (limit: number = 20) =>
  apiFetch<{ blocks: CordBlock[]; total: number }>(`/api/ledger/blocks?limit=${limit}`);

export const fetchLedgerBlock = (height: number) =>
  apiFetch<{ block: CordBlock; entries: CordLedgerEntry[] }>(`/api/ledger/blocks/${height}`);

export const fetchLedgerEntries = (limit: number = 30, offset: number = 0) =>
  apiFetch<{ entries: CordLedgerEntry[]; total: number }>(`/api/ledger/entries?limit=${limit}&offset=${offset}`);

export const fetchLedgerEntry = (hashOrId: string) =>
  apiFetch<{ entry: CordLedgerEntry }>(`/api/ledger/entry/${encodeURIComponent(hashOrId)}`);

export const fetchLedgerTokenPage = (guildId: string) =>
  apiFetch<CordLedgerTokenInfo>(`/api/ledger/token/${encodeURIComponent(guildId)}`);

export const verifyLedgerApi = () =>
  apiFetch<{
    status: string;
    entriesCount: number;
    blocksHeight: number;
    latestHash: string;
    latestBlockHash: string;
  }>('/api/ledger/verify');

export const fetchDailyCheckpoint = () =>
  apiFetch<{ checkpoint: Record<string, any>; formattedMarkdown: string }>('/api/ledger/checkpoint');

export const fetchGuildEarningsHistory = (guildId: string) =>
  apiFetch<{ reports: WeeklyEarningsReport[]; guildId: string; ticker: string }>(
    `/api/guilds/${encodeURIComponent(guildId)}/earnings-history`
  );

export const fetchSeasons = () => apiFetch<{ seasons: any[] }>('/api/seasons');

export const fetchRivalries = () => apiFetch<{ rivalries: any[] }>('/api/rivalries');

export const fetchQuests = () => apiFetch<{ quests: any[] }>('/api/quests');

export const fetchPredictions = () => apiFetch<{ markets: any[] }>('/api/predictions');

// ---------------- Discord OAuth2 auth ----------------

const PKCE_VERIFIER_KEY = 'cordchain.oauth.pcke';

const base64UrlEncode = (bytes: Uint8Array): string => {
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** PKCE code_verifier + S256 code_challenge (crypto required for Discord token grants). */
export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64UrlEncode(raw);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

export const storePkceVerifier = (verifier: string) => {
  try { sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier); } catch {}
  try { localStorage.setItem(PKCE_VERIFIER_KEY, verifier); } catch {}
};

export const popPkceVerifier = (): string | null => {
  let v: string | null = null;
  try {
    v = sessionStorage.getItem(PKCE_VERIFIER_KEY) || localStorage.getItem(PKCE_VERIFIER_KEY);
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);
    localStorage.removeItem(PKCE_VERIFIER_KEY);
  } catch {}
  return v;
};

export const getDiscordAuthUrl = (redirectUri: string, codeChallenge?: string) => {
  const qs = new URLSearchParams({ redirectUri });
  if (codeChallenge) qs.set('codeChallenge', codeChallenge);
  return apiFetch<{ authUrl: string; clientId: string; scopes: string[]; addBot: boolean; flow: string }>(
    `/api/auth/discord/url?${qs.toString()}`,
  );
};

export const createDiscordSession = (payload:
  | { accessToken: string }
  | { code: string; redirectUri: string; codeVerifier?: string }) =>
  apiFetch<ApiSession>('/api/auth/discord/session', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const fetchAuthMe = () => apiFetch<ApiSession>('/api/auth/me');

export const refreshDiscordGuilds = () =>
  apiFetch<{
    success: boolean;
    needsReauth?: boolean;
    message?: string;
    guilds: ApiSessionGuild[];
    ownedGuilds: ApiSessionGuild[];
    botClientId: string;
    installedGuildIds: string[];
  }>('/api/auth/discord/refresh-guilds', { method: 'POST' });

export const fetchDiscordBotInfo = () =>
  apiFetch<{
    botClientId: string;
    installedGuildIds: string[];
    inviteUrlTemplate: string;
  }>('/api/discord/bot-info');

export const logoutSession = () =>
  apiFetch<{ success: boolean }>('/api/auth/logout', { method: 'POST' });

export const fetchTraderLeaderboard = () =>
  apiFetch<{ traders: ApiTraderLeaderboardEntry[] }>('/api/leaderboard/traders');

export const fetchServerLeaderboard = () =>
  apiFetch<{ servers: ApiServerLeaderboardEntry[] }>('/api/leaderboard/servers');

export const fetchCampaigns = () => apiFetch<{ campaigns: ApiCampaign[] }>('/api/campaigns');

export const createCampaign = (payload: {
  sponsorName: string;
  title: string;
  description: string;
  mediaUrl: string;
  verifyQuestion: string;
  correctOption: string;
  wrongOptions: string[];
  budgetInr: number;
  targetCategory?: string;
}) =>
  apiFetch<{ success: boolean; campaignId: string | null; message: string }>(
    '/api/campaigns/create',
    { method: 'POST', body: JSON.stringify({ ...payload, targetCategory: payload.targetCategory || 'all' }) },
  );

// ---------------- Mappers ----------------

const compactCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};

const compactUsd = (n: number): string => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};

export const IPO_OPENING_PRICE_USD = 0.0001;

export function formatUsdAdaptive(n: number): string {
  if (n > 0 && n < 0.01) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(2)}`;
}

export function mapGuildToAsset(g: ApiGuild, rank: number, holdings?: number, avgBuy?: number): ServerAsset {
  // A served "0.00" is REAL data (dormant market, no holders) — never
  // resurrect it with a fallback. The IPO strike is only for malformed rows.
  const parsed = parseFloat(g.stockPrice);
  const price = Number.isFinite(parsed) ? parsed : IPO_OPENING_PRICE_USD;
  // Honest market cap: what wallets actually own × mark. Sold-out (dormant)
  // markets cap at $0 — the pool's locked shares are reserves, not holdings.
  const heldShares = g.heldShares ?? g.circulatingShares;
  const marketCap = price * heldShares;
  const desc = (g.description || '').trim();
  return {
    id: g.guildId,
    ticker: g.ticker,
    name: g.name,
    category: `${g.category || 'Community'} · League ${leagueTierName(g.leagueTier)}`,
    league: leagueTierName(g.leagueTier),
    rank,
    members: compactCount(g.memberCountCurrent),
    priceInr: price,
    priceUsd: price,
    change24h: g.changePct,
    sidebarChange24h: g.changePct,
    volume24h: compactUsd(g.volume24hUsd ?? 0),
    high24hUsd: +(g.high24hUsd ?? price).toFixed(6),
    low24hUsd: +(g.low24hUsd ?? price).toFixed(6),
    marketCapUsd: compactUsd(marketCap),
    description: desc || `${g.name} is a ${leagueTierName(g.leagueTier)}-league Discord community listed on the CordChain exchange. Watch sponsor ads, boost the ticker daily and trade its shares.`,
    tags: [g.category || 'Community', leagueTierName(g.leagueTier), 'Dividends'],
    holdings,
    avgBuyPriceUsd: avgBuy,
    marketState: (g.marketState ?? 'live') as any,
    collaboration: g.collaboration,
    tokenContractAddress: g.tokenContractAddress || undefined,
    tokenExplorerUrl: g.tokenExplorerUrl || undefined,
    blockchainNetwork: g.blockchainNetwork || 'CordLedger',
    discordInviteUrl: g.inviteUrl || undefined,
    bumpCount: g.bumpCount ?? 0,
    lastBumpedAt: g.lastBumpedAt || undefined,
  };
}

export function mapFeaturedToAsset(g: ApiGuild, rank: number): ServerAsset {
  // Zero is real (dormant market) — honor it, fallback only for missing data.
  const parsed = parseFloat(g.stockPrice);
  const listedPrice = Number.isFinite(parsed) ? parsed : IPO_OPENING_PRICE_USD;
  return {
    ...mapGuildToAsset(g, rank),
    isIpo: true,
    high24hUsd: +(g.high24hUsd ?? listedPrice).toFixed(6),
    low24hUsd: +(g.low24hUsd ?? listedPrice).toFixed(6),
  };
}

export type WalletHoldings = ApiWalletSummary['holdings'];

export function applyHoldings(servers: ServerAsset[], holdings: WalletHoldings): ServerAsset[] {
  const byGuild = new Map(holdings.map((h) => [h.guildId, h]));
  return servers.map((s) => {
    const h = byGuild.get(s.id);
    if (!h) return s;
    return {
      ...s,
      holdings: h.shares,
      avgBuyPriceUsd: parseFloat(h.avgBuyPrice) || undefined,
      change24h: ((parseFloat(h.currentPrice) - parseFloat(h.avgBuyPrice)) / (parseFloat(h.avgBuyPrice) || 1)) * 100,
    };
  });
}

export function mergeWalletIntoProfile(
  base: { name: string; username: string; avatarUrl?: string },
  wallet: ApiWalletSummary | null,
) {
  if (!wallet) return base;
  return {
    name: wallet.user.username || base.name,
    username: wallet.user.username || base.username,
    avatarUrl: wallet.user.avatar || base.avatarUrl,
  };
}

// ---------------- Real market data (built from the persisted ledger) ----------------
//
// Charts and the order book are derived ONLY from true historical records:
// trade_transactions (executed orders) + price_history (oracle price ticks).
// The backend endpoints never generate a synthetic walk; sparse history simply
// means the listing is young and the panel says so.

export type ChartTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D' | '1W';

export interface ApiCandleResult {
  guildId: string;
  ticker: string;
  interval: ChartTimeframe;
  intervalSeconds: number;
  livePrice: number;
  ledgerEvents: number;
  candles: Array<{ t: string; o: number; h: number; l: number; c: number; v: number }>;
}

export interface ApiRecentExecution {
  side: 'buy' | 'sell';
  price: number;
  shares: number;
  notionalUsd: number;
  time: string;
  trader: string;
}

export interface ApiOrderBookResult {
  guildId: string;
  ticker: string;
  currentPrice: number;
  liquidityMode: 'executions' | 'empty';
  bids: Array<{ price: number; shares: number; notionalUsd: number; depthPercent: number }>;
  asks: Array<{ price: number; shares: number; notionalUsd: number; depthPercent: number }>;
  recentTrades: ApiRecentExecution[];
  executions24h: number;
  buyVolume24hShares: number;
  sellVolume24hShares: number;
  netFlow24hShares: number;
}

export const fetchCandles = (
  guildId: string,
  interval: ChartTimeframe = '1h',
  limit = 120,
) =>
  apiFetch<ApiCandleResult>(
    `/api/guilds/${encodeURIComponent(guildId)}/candles?interval=${encodeURIComponent(interval)}&limit=${limit}`,
  );

export const fetchOrderBook = (guildId: string, depth = 8) =>
  apiFetch<ApiOrderBookResult>(`/api/guilds/${encodeURIComponent(guildId)}/orderbook?depth=${depth}`);

export interface ApiTradesPage {
  guildId: string;
  ticker: string;
  trades: ApiRecentExecution[];
  hasMore: boolean;
  nextBefore: string | null;
}

// Keyset-paged tape for infinite scroll — `before` is the newest ISO timestamp
// already loaded; each call returns the next older page.
export const fetchTradesPage = (guildId: string, limit = 15, before?: string | null) =>
  apiFetch<ApiTradesPage>(
    `/api/guilds/${encodeURIComponent(guildId)}/trades?limit=${limit}${
      before ? `&before=${encodeURIComponent(before)}` : ''
    }`,
  );

// Lightweight connectivity probe used to qualify the offline banner
export const healthz = () =>
  apiFetch<{ status: string }>('/api/healthz').then((r) => r.status === 'ok');

const pad2 = (n: number) => String(n).padStart(2, '0');

// Ledger candles → chart points, formatted in the viewer's local timezone
export function ledgerCandlesToPoints(rows: ApiCandleResult['candles']): CandlePoint[] {
  return rows.map((r) => {
    const stamp = new Date(r.t);
    const time = `${pad2(stamp.getHours())}:${pad2(stamp.getMinutes())}`;
    const dateLabel =
      stamp.getHours() === 0 && stamp.getMinutes() === 0
        ? stamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : undefined;
    return {
      time,
      dateLabel,
      open: r.o,
      high: r.h,
      low: r.l,
      close: r.c,
      volume: r.v,
    };
  });
}

export function ledgerTradesToRecords(trades: ApiRecentExecution[]): TradeRecord[] {
  const now = new Date();
  return trades.map((t, i) => {
    const stamp = new Date(t.time);
    const clock = stamp.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    let time = clock;
    if (stamp.toDateString() !== now.toDateString()) {
      time = `${stamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${clock}`;
    }
    return {
      id: `lgd-${t.time}-${i}`,
      price: t.price,
      amount: t.shares,
      time,
      side: t.side,
    };
  });
}

export function ladderToRows(
  rows: ApiOrderBookResult['bids'],
): OrderBookRow[] {
  return rows.map((r) => ({
    price: r.price,
    amount: r.shares,
    total:
      r.notionalUsd >= 1000
        ? `$${(r.notionalUsd / 1000).toFixed(1)}k`
        : `$${r.notionalUsd.toFixed(2)}`,
    depthPercent: r.depthPercent,
  }));
}

export const toNum = (v: string | number | undefined | null): number =>
  typeof v === 'number' ? v : parseFloat(v ?? '0') || 0;
