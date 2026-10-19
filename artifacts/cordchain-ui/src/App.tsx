import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, RefreshCw, CheckCircle2, XCircle, Info } from 'lucide-react';
import {
  MainTab,
  HomeSideNav,
  ServerAsset,
  OrderBookRow,
  TradeRecord,
  ActivityItem,
  UserProfile,
  SettingsState,
  AdCampaign,
  OwnedServerStock,
} from './types';
import {
  IPO_SERVERS,
  INITIAL_TRADES,
  INITIAL_ACTIVITIES,
  INITIAL_TRADER_LEADERBOARD,
  INITIAL_SERVER_LEADERBOARD,
  INITIAL_USER_PROFILE,
  DEFAULT_SETTINGS,
  INITIAL_CAMPAIGNS,
  INITIAL_OWNED_SERVER,
  SERVERS,
} from './data/mockData';
import {
  DEMO_USER,
  createDiscordSession,
  createPkcePair,
  fetchAuthMe,
  getDiscordAuthUrl,
  loadStoredSession,
  popPkceVerifier,
  storeSession,
  storePkceVerifier,
  logoutSession,
  clearStoredSession,
  fetchWalletSummary,
  fetchGuilds,
  fetchFeaturedGuilds,
  fetchTraderLeaderboard,
  fetchServerLeaderboard,
  refreshDiscordGuilds,
  fetchDiscordBotInfo,
  mapGuildToAsset,
  mapFeaturedToAsset,
  IPO_OPENING_PRICE_USD,
  applyHoldings,
  fetchOrderBook,
  fetchCandles,
  fetchTradesPage,
  healthz,
  ladderToRows,
  ledgerTradesToRecords,
  type ApiOrderBookResult,
  quoteTrade,
  buyShares,
  sellShares,
  registerTradeTx,
  requestCashout,
  createCampaign,
  linkBlockchainWallet,
  updateGuildApi,
  deleteGuildApi,
  bumpGuildApi,
  type UpdateGuildPayload,
  type ApiGuild,
  toNum,
  ApiError,
  type ApiSession,
  type ApiWalletSummary,
  type ApiCheckinVerify,
  type ApiTraderLeaderboardEntry,
  type ApiServerLeaderboardEntry,
  type ApiTradeBlockchainReceipt,
} from './lib/api';

type ToastKind = 'success' | 'error' | 'info';
import {
  checkConnectedWallet,
  connectWeb3Wallet,
  disconnectWeb3Wallet,
  notarizeTradeOnChain,
  getCordScanTxUrl,
  type Web3WalletState,
} from './lib/blockchain';
import { TAB_TO_PATH, navigate, useRoute } from './lib/router';
import { TopBar } from './components/TopBar';
import { ProjectLandingView } from './components/ProjectLandingView';
import { HomeView } from './components/HomeView';
import { ExchangeView } from './components/ExchangeView';
import { ManageStockView } from './components/ManageStockView';
import { WalletView } from './components/WalletView';
import { LeaderboardView } from './components/LeaderboardView';
import { PortfolioView } from './components/PortfolioView';
import { SettingsView } from './components/SettingsView';
import { ActionModals } from './components/ActionModals';
import { TokenizeServerModal } from './components/TokenizeServerModal';
import { ConnectWalletModal } from './components/ConnectWalletModal';
import { CordScanView } from './components/CordScanView';
import { ProjectGuideView } from './components/ProjectGuideView';

const PLAYABLE_BADGES = ['Diamond Whale', 'Arena Champion', 'Guild Tactician', 'Top Server Booster', 'Open Sourcer', 'Radiant Trader', 'Creative Patron', 'Co Founder', 'Season Veteran'];
const REFRESH_MS = 25_000;
const TRADES_PAGE_SIZE = 15;

export default function App() {
  const activeTab = useRoute();
  const [homeSideNav, setHomeSideNav] = useState<HomeSideNav>('Dashboard');
  const [servers, setServers] = useState<ServerAsset[]>(() => {
    try {
      const saved = localStorage.getItem('cordchain_custom_servers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) {
          const customIds = new Set(parsed.map((s: ServerAsset) => s.id));
          return [...parsed, ...SERVERS.filter((s) => !customIds.has(s.id))];
        }
      }
    } catch {}
    return SERVERS;
  });
  const [ipoServers] = useState<ServerAsset[]>(IPO_SERVERS);
  const [selectedServerId, setSelectedServerId] = useState<string>(DEMO_USER.guildId);
  const [apiGuilds, setApiGuilds] = useState<ApiGuild[]>([]);
  const [selectedOwnedServerId, setSelectedOwnedServerId] = useState<string | null>(null);
  const [modalServerId, setModalServerId] = useState<string | null>(null);
  const [isTokenizeModalOpen, setIsTokenizeModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // Live data state
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [wallet, setWallet] = useState<ApiWalletSummary | null>(null);
  const [traderLb, setTraderLb] = useState<ApiTraderLeaderboardEntry[] | null>(null);
  const [serverLb, setServerLb] = useState<ApiServerLeaderboardEntry[] | null>(null);
  const [featuredServers, setFeaturedServers] = useState<ServerAsset[]>(IPO_SERVERS);

  // Local overlays (reset once wallet refresh lands)
  const [credDelta, setCredDelta] = useState<number>(0);
  const [inrDelta, setInrDelta] = useState<number>(0);

  // User Profile & Settings
  const [user, setUser] = useState<UserProfile>({ ...INITIAL_USER_PROFILE, isLoggedIn: false });
  const authUserId = user.isLoggedIn ? user.discordId : null;
  const [discordGuilds, setDiscordGuilds] = useState<ApiSession['guilds']>([]);
  const [botClientId, setBotClientId] = useState<string>('1546943328518406205');
  const [installedGuildIds, setInstalledGuildIds] = useState<string[]>(['943488991750156408', '1559968534795255868']);
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>(INITIAL_CAMPAIGNS);

  const [trades, setTrades] = useState<TradeRecord[]>(INITIAL_TRADES);
  const [activities, setActivities] = useState<ActivityItem[]>(INITIAL_ACTIVITIES);
  const [watchlist, setWatchlist] = useState<string[]>([DEMO_USER.guildId]);
  const [joinedServers, setJoinedServers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [activeModal, setActiveModal] = useState<'boost' | 'video' | 'withdraw' | 'ad' | null>(null);
  const [toastMsg, setToastMsg] = useState<{ msg: string; kind: ToastKind } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [web3Wallet, setWeb3Wallet] = useState<Web3WalletState | null>(null);
  const [lastTxReceipt, setLastTxReceipt] = useState<ApiTradeBlockchainReceipt | null>(null);

  const showToast = useCallback((msg: string, kind: ToastKind = 'success') => {
    setToastMsg({ msg, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), kind === 'error' ? 6000 : 3600);
  }, []);

  const retryButton = useRef<HTMLButtonElement | null>(null);

  // Check Web3 wallet on boot
  useEffect(() => {
    checkConnectedWallet()
      .then((st) => {
        if (st.isConnected) setWeb3Wallet(st);
      })
      .catch(() => undefined);
  }, []);

  const handleConnectWeb3 = () => {
    setIsWalletModalOpen(true);
  };

  const handleWalletConnected = (st: Web3WalletState) => {
    setWeb3Wallet(st);
    showToast(`Connected to CordLedger (${st.address?.slice(0, 6)}...${st.address?.slice(-4)})`);
    if (user.isLoggedIn && st.address) {
      void linkBlockchainWallet(user.discordId, st.address);
    }
  };

  const handleDisconnectWeb3 = () => {
    disconnectWeb3Wallet();
    setWeb3Wallet(null);
    showToast('Web3 Wallet disconnected');
  };

  useEffect(() => {
    if (user.isLoggedIn && web3Wallet?.address) {
      void linkBlockchainWallet(user.discordId, web3Wallet.address);
    }
  }, [user.isLoggedIn, user.discordId, web3Wallet?.address]);

  const attemptedTabRef = useRef<MainTab | null>(null);
  const wasLoggedInRef = useRef(false);

  const setActiveTab = useCallback(
    (tab: MainTab) => {
      if (tab === 'Dashboard') setHomeSideNav('Dashboard');
      navigate(TAB_TO_PATH[tab]);
    },
    [],
  );

  const credBalance = Math.max(0, toNum(wallet?.wallets.credBalance ?? 10_000) + credDelta);
  const inrBalance = Math.max(0, toNum(wallet?.wallets.cashWalletInr ?? 156) + inrDelta);

  // ---------------- Auth (Discord OAuth2) ----------------
  const applyAuthSession = useCallback((session: ApiSession) => {
    if (session.sessionToken) storeSession(session.sessionToken, session.user, session.guilds);
    setUser((prev) => ({
      ...prev,
      name: session.user.username || prev.name,
      username: session.user.username.toLowerCase().replace(/\s+/g, '') || prev.username,
      email: session.user.email || 'Email not requested',
      discordId: session.user.discordId,
      avatarUrl: session.user.avatar || prev.avatarUrl,
      isLoggedIn: true,
      connectedGuildsCount: session.guilds.length,
    }));
    setDiscordGuilds(session.guilds);
    if (session.botClientId) setBotClientId(session.botClientId);
    if (session.installedGuildIds) setInstalledGuildIds(session.installedGuildIds);
  }, []);

  // Direct Discord login: jump straight to Discord's consent page.
  const OAUTH_ROUNDTRIP_KEY = 'cordchain.oauth.roundtrip';
  const handleDiscordLogin = useCallback((fromTab: MainTab | null = null) => {
    const targetTab = fromTab || 'Dashboard';
    attemptedTabRef.current = targetTab;
    try { localStorage.setItem('cordchain.oauth.attempted_tab', targetTab); } catch {}
    const redirectUri = `${window.location.origin}/`;
    try { localStorage.setItem('cordchain.oauth.redirect_uri', redirectUri); } catch {}
    (async () => {
      const { verifier, challenge } = await createPkcePair();
      storePkceVerifier(verifier);
      const { authUrl } = await getDiscordAuthUrl(redirectUri, challenge);
      try {
        sessionStorage.setItem(OAUTH_ROUNDTRIP_KEY, '1');
        localStorage.setItem(OAUTH_ROUNDTRIP_KEY, '1');
      } catch { /* ignore */ }
      window.location.assign(authUrl);
    })().catch((err) => {
      showToast(err instanceof ApiError ? err.message : 'Could not start Discord sign-in — is the API running?', 'error');
    });
  }, [showToast]);

  const handleRefreshDiscordGuilds = useCallback(async () => {
    try {
      const res = await refreshDiscordGuilds();
      if (res.needsReauth) {
        showToast('Discord authorization needed to refresh servers.', 'error');
        handleDiscordLogin(activeTab);
        return;
      }
      setDiscordGuilds(res.guilds);
      if (res.botClientId) setBotClientId(res.botClientId);
      if (res.installedGuildIds) setInstalledGuildIds(res.installedGuildIds);
      showToast(`Refreshed ${res.guilds.length} servers from Discord! (${res.ownedGuilds?.length || 0} owned)`);
    } catch (err: any) {
      showToast(err.message || 'Could not refresh Discord servers. Please reconnect.', 'error');
      handleDiscordLogin(activeTab);
    }
  }, [activeTab, handleDiscordLogin, showToast]);

  // Boot: consume the Discord OAuth redirect fragment (#access_token=...) once,
  // or restore a stored session (validated against the API).
  const bootedAuthRef = useRef(false);
  const [authBooted, setAuthBooted] = useState(false);
  useEffect(() => {
    if (bootedAuthRef.current) return;
    bootedAuthRef.current = true;
    const raw = window.location.hash.slice(1);
    const params = new URLSearchParams(raw);
    const accessToken = params.get('access_token');
    const code = new URLSearchParams(window.location.search).get('code');
    const finishBoot = () => setAuthBooted(true);
    const forgetRoundtrip = () => {
      try { sessionStorage.removeItem(OAUTH_ROUNDTRIP_KEY); } catch { /* ignore */ }
      try { localStorage.removeItem(OAUTH_ROUNDTRIP_KEY); } catch { /* ignore */ }
    };

    if (code) {
      // Authorization-code return: Discord redirects with ?code=...&state=... in the query.
      const savedRedirectUri = localStorage.getItem('cordchain.oauth.redirect_uri') || `${window.location.origin}/`;
      const verifier = popPkceVerifier() || undefined;
      window.history.replaceState(null, '', window.location.pathname);

      // Prevent double-exchange if effect triggers again with same code
      const consumedKey = 'cordchain.oauth.consumed_code';
      if (sessionStorage.getItem(consumedKey) === code) {
        finishBoot();
        return;
      }
      try { sessionStorage.setItem(consumedKey, code); } catch {}

      createDiscordSession({ code, redirectUri: savedRedirectUri, codeVerifier: verifier })
        .then((s) => {
          applyAuthSession(s);
          showToast(`Signed in as ${s.user.username}`);
          const dest = (localStorage.getItem('cordchain.oauth.attempted_tab') as MainTab) || attemptedTabRef.current || 'Dashboard';
          localStorage.removeItem('cordchain.oauth.attempted_tab');
          attemptedTabRef.current = null;
          setActiveTab(dest);
        })
        .catch((err) => {
          clearStoredSession();
          showToast(err instanceof ApiError ? err.message : 'Discord sign-in failed. Try again.', 'error');
        })
        .finally(() => { forgetRoundtrip(); finishBoot(); });
      return;
    }

    if (accessToken) {
      window.history.replaceState(null, '', window.location.pathname);
      createDiscordSession({ accessToken })
        .then((s) => {
          applyAuthSession(s);
          showToast(`Signed in as ${s.user.username}`);
          const dest = (localStorage.getItem('cordchain.oauth.attempted_tab') as MainTab) || attemptedTabRef.current || 'Dashboard';
          localStorage.removeItem('cordchain.oauth.attempted_tab');
          attemptedTabRef.current = null;
          setActiveTab(dest);
        })
        .catch((err) => {
          clearStoredSession();
          showToast(err instanceof ApiError ? err.message : 'Discord sign-in failed. Try again.', 'error');
        })
        .finally(() => { forgetRoundtrip(); finishBoot(); });
      return;
    }

    forgetRoundtrip();
    if (loadStoredSession()) {
      fetchAuthMe()
        .then((s) => applyAuthSession(s))
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) clearStoredSession();
        })
        .finally(finishBoot);
      return;
    }

    finishBoot();
  }, [applyAuthSession, showToast, setActiveTab]);

  const handleLogout = useCallback(async () => {
    await logoutSession().catch(() => undefined);
    clearStoredSession();
    setUser({ ...INITIAL_USER_PROFILE, isLoggedIn: false });
    setDiscordGuilds([]);
    setWallet(null);
    setCredDelta(0);
    setInrDelta(0);
    showToast('Signed out of CordChain.');
    setActiveTab('Home');
  }, [showToast, setActiveTab]);

  // ---------------- Data refresh ----------------
  const refreshWallet = useCallback(async () => {
    if (!authUserId) {
      setWallet(null);
      return;
    }
    const summary = await fetchWalletSummary(authUserId);
    setWallet(summary);
    setCredDelta(0);
    setInrDelta(0);
  }, [authUserId]);

  const refreshMarkets = useCallback(async () => {
    const [{ guilds }, { featured }, { traders }, { servers: lbServers }] = await Promise.all([
      fetchGuilds({ sort: 'gain' }),
      fetchFeaturedGuilds(),
      fetchTraderLeaderboard(),
      fetchServerLeaderboard(),
    ]);
    setApiGuilds(guilds);
    const mapped = guilds.map((g, i) => mapGuildToAsset(g, i + 1));
    setServers(mapped);
    if (featured.length) {
      setFeaturedServers(featured.map((g, i) => mapFeaturedToAsset(g, i + 1)));
    } else {
      setFeaturedServers([]);
    }
    setTraderLb(traders);
    setServerLb(lbServers);
    setLastSync(new Date());
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      await Promise.all([refreshMarkets(), refreshWallet()]);
      setApiOnline(true);
      return true;
    } catch {
      // A failure of any single endpoint shouldn't cry "offline" — probe /api/healthz
      // so the banner only appears when the API itself is unreachable.
      let ok = false;
      try {
        ok = await healthz();
      } catch {
        ok = false;
      }
      setApiOnline(ok);
      setLastSync(new Date());
      return false;
    }
  }, [refreshMarkets, refreshWallet]);

  useEffect(() => {
    void refreshAll();
    const timer = setInterval(() => {
      fetchGuilds({ sort: 'gain' })
        .then(({ guilds }) => {
          setApiGuilds(guilds);
          setServers(guilds.map((g, i) => mapGuildToAsset(g, i + 1)));
          setApiOnline(true);
          setLastSync(new Date());
        })
        .catch(async () => {
          let ok = false;
          try {
            ok = await healthz();
          } catch {
            ok = false;
          }
          setApiOnline(ok);
        });
      if (authUserId) {
        fetchWalletSummary(authUserId).then(setWallet).catch(() => undefined);
      }
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refreshAll, authUserId]);

  const allCombinedServers = useMemo(() => {
    const map = new Map<string, ServerAsset>();
    for (const s of servers) map.set(s.id, s);
    for (const s of featuredServers) {
      if (!map.has(s.id)) map.set(s.id, s);
    }
    return Array.from(map.values());
  }, [servers, featuredServers]);

  // Seed cosmetic "joined servers"/watchlist from the user's real Discord guilds
  // (only guilds that also exist on the CordChain exchange count).
  useEffect(() => {
    if (!discordGuilds.length || !allCombinedServers.length) return;
    const exchangeIds = new Set(allCombinedServers.map((s) => s.id));
    const matches = discordGuilds.map((g) => g.id).filter((id) => exchangeIds.has(id));
    if (!matches.length) return;
    setJoinedServers((prev) => Array.from(new Set([...prev, ...matches])));
    setWatchlist((prev) => Array.from(new Set([matches[0], ...prev])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discordGuilds]);

  const serversWithHoldings = useMemo(
    () => (wallet ? applyHoldings(allCombinedServers, wallet.holdings) : allCombinedServers),
    [allCombinedServers, wallet],
  );

  const ownedTokenizedStocks: OwnedServerStock[] = useMemo(() => {
    const ownedDiscordIds = new Set(
      discordGuilds.filter((g) => g.owner).map((g) => g.id),
    );

    return apiGuilds
      .filter((g) => {
        if (user.isLoggedIn) {
          return (g.ownerId && g.ownerId === user.discordId) || ownedDiscordIds.has(g.guildId);
        }
        return g.ownerId === DEMO_USER.discordId || ownedDiscordIds.has(g.guildId);
      })
      .map((g) => {
        const matchAsset = servers.find((s) => s.id === g.guildId);
        const totalSupply = g.totalSupply || 1_000_000;
        const circulating = g.circulatingShares || 250_000;
        const treasuryReserve = g.treasuryReserve || 150_000;
        // Zero is real (dormant/sold-out market) — never resurrect to $25.
        const parsedManagePrice = parseFloat(g.stockPrice);
        const price = Number.isFinite(parsedManagePrice) ? parsedManagePrice : IPO_OPENING_PRICE_USD;

        return {
          serverId: g.guildId,
          ticker: g.ticker,
          serverName: g.name,
          discordGuildId: g.guildId,
          description: g.description,
          category: g.category,
          iconUrl: g.iconUrl || undefined,
          membersCount: g.memberCountCurrent,
          isListed: true,
          tokenContractAddress: g.tokenContractAddress ?? null,
          tokenExplorerUrl: g.tokenExplorerUrl ?? null,
          inviteUrl: g.inviteUrl ?? null,
          bumpCount: g.bumpCount ?? 0,
          lastBumpedAt: g.lastBumpedAt ?? null,
          totalSupply,
          circulatingSupply: circulating,
          treasuryReserve,
          currentPriceInr: price,
          initialIpoPriceInr: parseFloat(g.previousDayPrice) || price,
          dividendSplitShareholders: g.dividendSplitShareholders ?? 60,
          dividendSplitTreasury: g.dividendSplitTreasury ?? 25,
          dividendSplitOwner: g.dividendSplitOwner ?? 15,
          boostRewardMultiplier: g.boostRewardMultiplier ?? 1.05,
          adMonetizationEnabled: g.adMonetizationEnabled ?? true,
          botInstalled: true,
          treasuryBalanceCred: 0,
          treasuryBalanceInr: parseFloat(g.ownerCashWalletInr || '0') || 0,
          totalDividendsDistributedInr: 0,
          topHolders: (g.topHolders ?? []).map((h) => ({
            username: h.username,
            shares: h.shares,
            pct: circulating > 0 ? +((h.shares / circulating) * 100).toFixed(2) : 0,
          })),
          memberStats: matchAsset?.memberStats,
          advantageMultiplier: matchAsset?.advantageMultiplier,
        };
      });
  }, [apiGuilds, discordGuilds, user.isLoggedIn, user.discordId, servers]);

  const activeOwnedServer = useMemo(() => {
    if (!ownedTokenizedStocks.length) return null;
    if (selectedOwnedServerId) {
      const found = ownedTokenizedStocks.find((s) => s.serverId === selectedOwnedServerId);
      if (found) return found;
    }
    return ownedTokenizedStocks[0];
  }, [ownedTokenizedStocks, selectedOwnedServerId]);

  const selectedServer =
    serversWithHoldings.find((s) => s.id === selectedServerId) ||
    serversWithHoldings.find((s) => s.id === DEMO_USER.guildId) ||
    serversWithHoldings[0] ||
    null;
  const boostModalServer =
    (modalServerId && serversWithHoldings.find((s) => s.id === modalServerId)) || selectedServer;

  // Real executed-order liquidity + tape from the ledger — refetched whenever the
  // selected server or its market price changes (every real trade moves the price).
  const [bookStats, setBookStats] = useState<ApiOrderBookResult | null>(null);
  const [tradePulse, setTradePulse] = useState(0);

  const applySpotPrice = useCallback((guildId: string, price: number) => {
    const patch = (list: ServerAsset[]) =>
      list.map((s) => (s.id === guildId ? { ...s, priceUsd: price, priceInr: price } : s));
    setServers(patch);
    setFeaturedServers(patch);
  }, []);

  // Tape pagination (infinite scroll in the Recent Trades card)
  const [tradesHasMore, setTradesHasMore] = useState(false);
  const [tradesLoadingMore, setTradesLoadingMore] = useState(false);
  const tradesCursorRef = useRef<string | null>(null);
  const tradesHasMoreRef = useRef(false);
  const tradesLoadingRef = useRef(false);

  const loadOrderBook = useCallback(async (guildId: string) => {
    try {
      const [ob, tape] = await Promise.all([
        fetchOrderBook(guildId),
        fetchTradesPage(guildId, TRADES_PAGE_SIZE),
      ]);
      setBookStats(ob);
      setOrderBook({ asks: ladderToRows(ob.asks), bids: ladderToRows(ob.bids) });
      setTrades(ledgerTradesToRecords(tape.trades));
      tradesHasMoreRef.current = tape.hasMore;
      setTradesHasMore(tape.hasMore);
      tradesCursorRef.current = tape.hasMore ? tape.nextBefore : null;
    } catch {
      // keep the last good snapshot; the offline banner covers connectivity
    }
  }, []);

  useEffect(() => {
    if (!selectedServer) {
      setOrderBook({ asks: [], bids: [] });
      setTrades([]);
      setBookStats(null);
      tradesHasMoreRef.current = false;
      tradesCursorRef.current = null;
      setTradesHasMore(false);
      return;
    }
    void loadOrderBook(selectedServer.id);
  }, [selectedServer?.id, Math.round((selectedServer?.priceUsd ?? 0) * 100), loadOrderBook]);

  // Appends the next tape page when the user scrolls near the card bottom
  const handleLoadMoreTrades = useCallback(async () => {
    const gid = selectedServer?.id;
    if (!gid || tradesLoadingRef.current || !tradesHasMoreRef.current) return;
    tradesLoadingRef.current = true;
    setTradesLoadingMore(true);
    try {
      const page = await fetchTradesPage(gid, TRADES_PAGE_SIZE, tradesCursorRef.current);
      setTrades((prev) => [...prev, ...ledgerTradesToRecords(page.trades)]);
      tradesHasMoreRef.current = page.hasMore;
      setTradesHasMore(page.hasMore);
      tradesCursorRef.current = page.hasMore ? page.nextBefore : null;
    } catch {
      // one failed page shouldn't brick scrolling — drop the cursor so a later
      // scroll tick retries from a safe state
      tradesHasMoreRef.current = false;
      setTradesHasMore(false);
      tradesCursorRef.current = null;
    } finally {
      tradesLoadingRef.current = false;
      setTradesLoadingMore(false);
    }
  }, [selectedServer?.id]);

  const [orderBook, setOrderBook] = useState<{ asks: OrderBookRow[]; bids: OrderBookRow[] }>({
    asks: [],
    bids: [],
  });

  const handleSelectServerForTrade = (serverId: string) => {
    setSelectedServerId(serverId);
    setActiveTab('Exchange');
  };

  const handleCreateTokenizedServer = (newServer: ServerAsset) => {
    setServers((prev) => {
      const updated = [newServer, ...prev];
      try {
        localStorage.setItem('cordchain_custom_servers', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setSelectedServerId(newServer.id);
    setActiveTab('Exchange');
    showToast(`Successfully tokenized ${newServer.name} (${newServer.ticker}) on CordLedger!`);
    void refreshMarkets();
  };

  // ---------------- Trading (live backend) ----------------
  const pushActivity = (item: Omit<ActivityItem, 'id' | 'timeAgo'>) => {
    setActivities((prev) => [{ ...item, id: `act-${Date.now()}`, timeAgo: 'Just now' }, ...prev.slice(0, 4)]);
  };

  const handlePlaceOrder = async (side: 'buy' | 'sell', rawAmount: number, _priceHint: number) => {
    if (!selectedServer || busy) return;
    const amount = Math.max(1, Math.round(rawAmount));
    const effectiveUserId = authUserId || DEMO_USER.discordId || DEMO_USER.id || '123456789012345678';
    const isGuest = !authUserId;
    setBusy(true);
    try {
      const quote = await quoteTrade(selectedServer.id, side.toUpperCase() as 'BUY' | 'SELL', amount);
      const tx = side === 'buy'
        ? await buyShares(selectedServer.id, effectiveUserId, amount, web3Wallet?.address || undefined)
        : await sellShares(selectedServer.id, effectiveUserId, amount, web3Wallet?.address || undefined);

      const now = new Date();
      const newTrade: TradeRecord = {
        id: tx.transactionId ?? `t-${Date.now()}`,
        price: toNum(tx.pricePerShare),
        amount,
        time: now.toTimeString().slice(0, 8),
        side,
      };
      setTrades((prev) => [newTrade, ...prev.slice(0, 5)]);

      if (tx.blockchain) {
        setLastTxReceipt(tx.blockchain);
        pushActivity({
          title: tx.blockchain.blockNumber ? `CordLedger Block #${tx.blockchain.blockNumber}` : 'Instant AMM fill',
          subtitle: tx.blockchain.blockchainTxHash
            ? `Tx ${tx.blockchain.blockchainTxHash.slice(0, 10)}...`
            : `AMM fill · ${tx.blockchain.network.replace(' (off-chain)', '')}`,
          isPositive: true,
          type: 'boost',
        });
      }

      const total = toNum(tx.totalCredSpent ?? tx.totalCredReceived);
      setWalletSafe(total, side);
      pushActivity({
        title: `${side === 'buy' ? 'Bought' : 'Sold'} ${tx.ticker} Shares`,
        subtitle: `${side === 'buy' ? '-' : '+'}${total.toLocaleString(undefined, { maximumFractionDigits: 2 })} $CRED`,
        isPositive: side === 'sell',
        type: side,
      });
      showToast(
        tx.blockchain
          ? `${isGuest ? '[Demo Mode] ' : ''}${side === 'buy' ? 'Bought' : 'Sold'} ${amount.toLocaleString()} ${tx.ticker} — ${tx.blockchain.blockchainTxHash ? `Committed to CordLedger Block #${tx.blockchain.blockNumber}!` : `AMM fill confirmed (instant, CordLedger)`}`
          : `${isGuest ? '[Demo Mode] ' : ''}${side === 'buy' ? 'Bought' : 'Sold'} ${amount.toLocaleString()} ${tx.ticker} @ ${(toNum(tx.pricePerShare) > 0 && toNum(tx.pricePerShare) < 0.01 ? '$' + toNum(tx.pricePerShare).toFixed(6) : '$' + toNum(tx.pricePerShare).toFixed(2))} (slippage ~${quote.estimatedSlippagePct}%)`,
      );

      // Live-update the spot everywhere: price genuinely moved with this fill.
      // This flips selectedServer.priceUsd, which re-fires the candle fetch in
      // ExchangeView, so the chart advances the instant an order lands.
      if (tx.newMarketPrice) applySpotPrice(selectedServer.id, toNum(tx.newMarketPrice));
      setTradePulse((p) => p + 1);
      if (selectedServer) void loadOrderBook(selectedServer.id);
      void refreshWallet();
      // Aggressive honesty refresh: if this fill emptied the holders list the
      // market turns dormant ($0 quote) and the directory must reflect it now.
      void refreshMarkets();

      // CordLedger receipt notarization: recorded to local append-only ledger
      if (tx.blockchain && tx.transactionId && web3Wallet?.isConnected && web3Wallet.address) {
        const baseReceipt = tx.blockchain;
        const txId = tx.transactionId;
        void (async () => {
          try {
            const { hash, blockNumber } = await notarizeTradeOnChain({
              action: side,
              ticker: tx.ticker,
              shares: amount,
              price: toNum(tx.pricePerShare),
              txId,
              walletAddress: web3Wallet!.address!,
            });
            await registerTradeTx({
              transactionId: txId,
              txHash: hash,
              blockNumber,
              walletAddress: web3Wallet!.address!,
            });
            setLastTxReceipt({
              ...baseReceipt,
              blockchainTxHash: hash,
              blockNumber,
              network: 'CordLedger',
              explorerUrl: getCordScanTxUrl(hash),
              onChainStatus: 'mined',
              isMinedOnChain: true,
              walletAddress: web3Wallet!.address!,
            });
          } catch (err) {
            console.warn('[CordChain] on-chain notarization skipped:', err);
          }
        })();
      }
    } catch (err) {
      console.error('[CordChain] trade failed:', err);
      // Classify properly before blaming the backend: probe /api/healthz on the
      // page's own origin to distinguish "API unreachable / no proxy" from a
      // client-side failure while the API is actually fine.
      let apiReachable = false;
      try {
        apiReachable = await healthz();
      } catch {
        apiReachable = false;
      }
      if (!apiReachable) {
        showToast(
          typeof navigator !== 'undefined' && !navigator.onLine
            ? 'Your internet connection dropped — reconnect and try again.'
            : 'Cannot reach the CordChain API from this page. Confirm uvicorn is running on :5000 and that the app is served from the dev server with the /api proxy (port 3000).',
          'error',
        );
      } else if (err instanceof ApiError) {
        showToast(err.message, 'error');
      } else {
        showToast(`Trade failed: ${(err as Error)?.message || 'unexpected client error'}`, 'error');
      }
      // Even a "failed" request may have executed server-side (e.g. the response
      // was lost in transit) — re-sync the wallet and ledger snapshot to stay honest.
      void refreshWallet();
      if (selectedServer) void loadOrderBook(selectedServer.id);
    } finally {
      setBusy(false);
    }
  };

  const setWalletSafe = (amountCred: number, side: 'buy' | 'sell') => {
    setWallet((prev) => {
      if (!prev) return prev;
      const cur = toNum(prev.wallets.credBalance);
      const next = side === 'buy' ? cur - amountCred : cur + amountCred;
      return {
        ...prev,
        wallets: { ...prev.wallets, credBalance: next.toFixed(2) },
      };
    });
  };

  const handleToggleWatchlist = (serverId: string) => {
    setWatchlist((prev) => {
      const exists = prev.includes(serverId);
      showToast(exists ? 'Removed from watchlist' : 'Added to watchlist');
      return exists ? prev.filter((id) => id !== serverId) : [...prev, serverId];
    });
  };

  const handleToggleJoinServer = (serverId: string) => {
    const srv = allCombinedServers.find((s) => s.id === serverId);
    const alreadyJoined = joinedServers.includes(serverId);
    setJoinedServers((prev) =>
      alreadyJoined ? prev.filter((id) => id !== serverId) : [...prev, serverId],
    );
    showToast(
      alreadyJoined
        ? `Left ${srv?.ticker || 'Discord'} community`
        : `Joined ${srv?.ticker || 'Discord'} server! +50 $CRED welcome bonus`,
    );
    if (!alreadyJoined) setCredDelta((prev) => prev + 50);
  };

  // ---------------- Community bumps (top.gg-style, shareholders only) ----------------
  const [bumpPendingId, setBumpPendingId] = useState<string | null>(null);
  const handleBumpServer = useCallback(
    async (serverId: string) => {
      const uid = authUserId || DEMO_USER.discordId;
      setBumpPendingId(serverId);
      try {
        const res = await bumpGuildApi(serverId, uid);
        const applyBump = (s: ServerAsset): ServerAsset =>
          s.id === serverId
            ? {
                ...s,
                bumpCount: res.bumpCount,
                lastBumpedAt: res.lastBumpedAt,
                priceUsd: parseFloat(res.newStockPrice) || s.priceUsd,
                priceInr: parseFloat(res.newStockPrice) || s.priceInr,
                change24h: +(s.change24h + res.priceGainPct).toFixed(2),
                sidebarChange24h: +(s.change24h + res.priceGainPct).toFixed(2),
              }
            : s;
        setServers((prev) => prev.map(applyBump));
        setFeaturedServers((prev) => (prev.length ? prev.map(applyBump) : prev));
        showToast(`${res.ticker} bumped up the directory! Next bump in ${res.cooldownMinutes} min.`);
        void refreshMarkets();
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : 'Bump failed — please retry.', 'error');
      } finally {
        setBumpPendingId(null);
      }
    },
    [authUserId, refreshMarkets, showToast],
  );

  // ---------------- Boost / attention rewards (live backend) ----------------
  const handleBoostVerified = (result: ApiCheckinVerify, ticker: string) => {
    pushActivity({
      title: `Boosted ${ticker} Stock`,
      subtitle:
        result.isPaidDrop && (result.userPayoutInr ?? 0) > 0
          ? `+${toNum(result.credAwarded).toLocaleString()} $CRED + $${toNum(result.userPayoutInr).toFixed(2)}`
          : `+${toNum(result.credAwarded).toLocaleString()} $CRED (fantasy boost only)`,
      isPositive: true,
      type: 'boost',
    });
    showToast(
      `Boosted ${ticker}! +${toNum(result.credAwarded).toLocaleString()} $CRED${
        result.isPaidDrop && (result.userPayoutInr ?? 0) > 0 ? ` & +$${toNum(result.userPayoutInr).toFixed(2)}` : ' (cash cap reached today)'
      }`,
    );
    if (result.verified) {
      setWallet((prev) =>
        prev
          ? {
              ...prev,
              wallets: {
                ...prev.wallets,
                credBalance: result.newCredBalance ?? prev.wallets.credBalance,
                cashWalletInr: result.newCashWalletInr ?? prev.wallets.cashWalletInr,
              },
              dailyStatus: {
                ...prev.dailyStatus,
                boostsUsedToday: result.dailyBoostCount ?? prev.dailyStatus.boostsUsedToday,
                canClaimCashDrop: !result.isPaidDrop,
              },
            }
          : prev,
      );
      void refreshMarkets();
    }
  };

  // ---------------- Cashout (live backend) ----------------
  // ---------------- Daily Login Allowance (CordLedger) ----------------
  const handleCompleteWithdraw = async () => {
    if (busy) return;
    const uid = authUserId || DEMO_USER.id;
    setBusy(true);
    try {
      const res = await claimDailyAllowance(uid);
      pushActivity({
        title: 'Daily Login Allowance',
        subtitle: `+${res.credAwarded} $CRED`,
        isPositive: true,
        type: 'boost',
      });
      showToast(`+${res.credAwarded} $CRED Daily Allowance claimed!`, 'success');
      void refreshWallet();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Daily bonus already claimed today! Check back tomorrow.', 'error');
    } finally {
      setBusy(false);
    }
  };

  // ---------------- Ad campaigns (live backend) ----------------
  const handleCompleteAd = async (payload: {
    sponsorName: string;
    title: string;
    description: string;
    mediaUrl: string;
    verifyQuestion: string;
    correctOption: string;
    wrongOptions: string[];
    budgetInr: number;
  }) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await createCampaign(payload);
      const newCamp: AdCampaign = {
        id: res.campaignId ?? `camp-${Date.now()}`,
        ticker: payload.sponsorName.toUpperCase().startsWith('$') ? payload.sponsorName : `$${payload.sponsorName}`,
        serverName: payload.title,
        tagline: payload.description,
        budgetCred: payload.budgetInr,
        spentCred: 0,
        impressions: 0,
        clicks: 0,
        status: 'active',
        createdAt: 'Just now',
      };
      setCampaigns((prev) => [newCamp, ...prev]);
      pushActivity({
        title: `Ad Campaign ($${payload.sponsorName})`,
        subtitle: `-$${payload.budgetInr.toFixed(2)} deposit`,
        isPositive: false,
        type: 'ad',
      });
      showToast(res.message || `Campaign live! ${payload.sponsorName} is promoted across the network`);
      return true;
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Campaign creation failed', 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  // ---------------- Token Management & Deletion ----------------
  const handleDeleteOwnedServer = async (guildId: string) => {
    setBusy(true);
    try {
      const res = await deleteGuildApi(guildId);
      showToast(res.message || 'Successfully delisted and deleted token.');
      try {
        const saved = localStorage.getItem('cordchain_custom_servers');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((s: ServerAsset) => s.id !== guildId);
            localStorage.setItem('cordchain_custom_servers', JSON.stringify(filtered));
          }
        }
      } catch {}
      setServers((prev) => prev.filter((s) => s.id !== guildId));
      setFeaturedServers((prev) => prev.filter((s) => s.id !== guildId));
      setApiGuilds((prev) => prev.filter((g) => g.guildId !== guildId));
      if (selectedServerId === guildId) {
        setSelectedServerId('');
      }
      if (selectedOwnedServerId === guildId) {
        setSelectedOwnedServerId(null);
      }
      await refreshAll();
    } catch (err: any) {
      showToast(err instanceof ApiError ? err.message : (err?.message || 'Failed to delist token'), 'error');
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateOwnedServer = async (guildId: string, updated: UpdateGuildPayload) => {
    setBusy(true);
    try {
      const res = await updateGuildApi(guildId, updated);
      showToast(`Updated parameters for ${res.guild.name} (${res.guild.ticker})`);
      await refreshMarkets();
    } catch (err: any) {
      showToast(err instanceof ApiError ? err.message : (err?.message || 'Failed to update token parameters'), 'error');
      throw err;
    } finally {
      setBusy(false);
    }
  };

  // ---------------- Leaderboard mapping ----------------
  const traderBoard = useMemo(() => {
    if (!traderLb?.length) return INITIAL_TRADER_LEADERBOARD;
    return traderLb.map((t, i) => ({
      rank: t.rank,
      username: t.username,
      discordTag: `${t.username.toLowerCase().replace(/[^a-z0-9]/g, '')}#${String(1000 + i)}`,
      roiPct: t.roiPct,
      profitUsd: Math.round(toNum(t.netWorthCred) / 10),
      winRate: t.winRate,
      topAsset: t.topAsset,
      badge: PLAYABLE_BADGES[i % PLAYABLE_BADGES.length],
      isCurrentUser: t.discordId === authUserId,
    }));
  }, [traderLb, authUserId]);

  const serverBoard = useMemo(() => {
    if (!serverLb?.length) return INITIAL_SERVER_LEADERBOARD;
    return serverLb.map((s) => ({
      rank: s.rank,
      ticker: s.ticker,
      name: s.name,
      league: s.leagueName as import('./types').LeagueType,
      members: s.memberCountCurrent.toLocaleString(),
      marketCapUsd:
        toNum(s.marketCapCred) >= 1_000_000
          ? `$${(toNum(s.marketCapCred) / 1_000_000).toFixed(1)}M`
          : `$${(toNum(s.marketCapCred) / 1_000).toFixed(1)}K`,
      boostPower: s.boostPower,
      dividendYield: s.dividendYield,
      change7d: s.change24hPct,
    }));
  }, [serverLb]);

  const isPublicRoute =
    activeTab === 'Home' ||
    activeTab === 'Exchange' ||
    activeTab === 'Dashboard' ||
    activeTab === 'CordScan' ||
    activeTab === 'Guide' ||
    activeTab === 'Leaderboard' ||
    activeTab === 'Portfolio' ||
    activeTab === 'Manage';

  const guardedTab: MainTab = user.isLoggedIn || isPublicRoute ? activeTab : 'Home';

  useEffect(() => {
    if (!authBooted) return;
    if (user.isLoggedIn || isPublicRoute) return;
    // Direct login: bounce straight into Discord's consent page instead of a
    // dedicated /login page. Never loop: skip one round already attempted.
    let roundtripPending = false;
    try {
      roundtripPending =
        sessionStorage.getItem(OAUTH_ROUNDTRIP_KEY) === '1' ||
        localStorage.getItem(OAUTH_ROUNDTRIP_KEY) === '1';
    } catch { /* ignore */ }
    attemptedTabRef.current = activeTab;
    if (!roundtripPending) {
      handleDiscordLogin(activeTab);
      return;
    }
    try {
      sessionStorage.removeItem(OAUTH_ROUNDTRIP_KEY);
      localStorage.removeItem(OAUTH_ROUNDTRIP_KEY);
    } catch { /* ignore */ }
    navigate(TAB_TO_PATH.Home, { replace: true });
  }, [authBooted, activeTab, isPublicRoute, user.isLoggedIn, handleDiscordLogin]);

  useEffect(() => {
    if (wasLoggedInRef.current === user.isLoggedIn) return;
    wasLoggedInRef.current = user.isLoggedIn;
    if (!user.isLoggedIn) return;
    const dest = attemptedTabRef.current || (localStorage.getItem('cordchain.oauth.attempted_tab') as MainTab) || (activeTab !== 'Home' ? activeTab : 'Dashboard');
    attemptedTabRef.current = null;
    try { localStorage.removeItem('cordchain.oauth.attempted_tab'); } catch {}
    if (dest !== activeTab) {
      setActiveTab(dest);
    }
  }, [user.isLoggedIn, activeTab, setActiveTab]);

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#18181B]">
      {/* Top Navigation Bar */}
      <TopBar
        onSelectTab={setActiveTab}
        servers={serversWithHoldings}
        onSelectServer={setSelectedServerId}
        credBalance={credBalance}
        inrBalance={inrBalance}
        user={user}
        apiOnline={apiOnline}
        lastSync={lastSync}
        onOpenDiscordLogin={() => handleDiscordLogin(null)}
        onLogout={handleLogout}
        web3Wallet={web3Wallet}
        onConnectWeb3={handleConnectWeb3}
        onDisconnectWeb3={handleDisconnectWeb3}
        onOpenTokenizeModal={() => setIsTokenizeModalOpen(true)}
      />

      {/* Global API-offline error banner with retry */}
      <AnimatePresence>
        {apiOnline === false && (
          <motion.div
            key="api-offline"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="sticky top-[60px] z-40 mx-4 mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 flex flex-wrap items-center gap-3 shadow-sm"
          >
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <p className="flex-1 min-w-[200px] text-[12.5px] font-medium text-red-700">
              CordChain API is unreachable — market data may be stale. Try reconnecting.
            </p>
            <button
              ref={retryButton}
              onClick={async () => {
                showToast('Reconnecting to CordChain API...', 'info');
                const ok = await refreshAll();
                showToast(ok ? 'Back online! Markets re-synced.' : 'Still offline — check the backend.', ok ? 'success' : 'error');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[12px] font-semibold cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry now</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated Page Transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={guardedTab}
          initial={{ opacity: 0, y: 7 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -7 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          {guardedTab === 'Home' && (
            <ProjectLandingView
              servers={serversWithHoldings}
              onSelectTab={setActiveTab}
              onSelectServerForTrade={handleSelectServerForTrade}
              onOpenDiscordLogin={() => handleDiscordLogin(null)}
            />
          )}

          {guardedTab === 'Dashboard' && (
            <HomeView
              servers={serversWithHoldings}
              ipoServers={ipoServers}
              activities={activities}
              credBalance={credBalance}
              inrBalance={inrBalance}
              wallet={wallet}
              isLoggedIn={user.isLoggedIn}
              ownedServerIds={ownedTokenizedStocks.map((s) => s.serverId)}
              bumpPendingId={bumpPendingId}
              onBumpServer={handleBumpServer}
              onUpdateGuildListing={handleUpdateOwnedServer}
              activeSideNav={homeSideNav}
              onSelectSideNav={(nav) => {
                setHomeSideNav(nav);
                if (nav === 'Ad Creator') {
                  setActiveModal('ad');
                } else if (nav === 'Manage') {
                  setActiveTab('Manage');
                }
              }}
              onSelectTab={setActiveTab}
              onSelectServerForTrade={handleSelectServerForTrade}
              onOpenBoostModal={(ticker) => {
                if (ticker) {
                  const s = serversWithHoldings.find(
                    (item) => item.ticker.toLowerCase() === ticker.toLowerCase(),
                  );
                  if (s) setModalServerId(s.id);
                  else if (ticker.toUpperCase() === 'SQUAD') setModalServerId(DEMO_USER.guildId);
                } else {
                  setModalServerId(null);
                }
                setActiveModal('boost');
              }}
              onOpenVideoModal={() => {
                setModalServerId(null);
                setActiveModal('video');
              }}
              onOpenWithdrawModal={() => setActiveModal('withdraw')}
              onOpenAdModal={() => setActiveModal('ad')}
              onOpenDiscordLogin={() => handleDiscordLogin(null)}
              joinedServers={joinedServers}
              onToggleJoinServer={handleToggleJoinServer}
              onOpenTokenizeModal={() => setIsTokenizeModalOpen(true)}
            />
          )}

          {guardedTab === 'Manage' && (
            <ManageStockView
              ownedServer={activeOwnedServer}
              ownedServers={ownedTokenizedStocks}
              selectedServerId={selectedOwnedServerId || activeOwnedServer?.serverId}
              onSelectOwnedServer={(id) => setSelectedOwnedServerId(id)}
              onUpdateOwnedServer={handleUpdateOwnedServer}
              onDeleteOwnedServer={handleDeleteOwnedServer}
              onOpenTokenizeModal={() => setIsTokenizeModalOpen(true)}
              onSelectTab={setActiveTab}
              onTriggerToast={showToast}
            />
          )}

          {guardedTab === 'Exchange' && (
            <ExchangeView
              selectedServer={selectedServer}
              allServers={serversWithHoldings}
              onSelectServer={setSelectedServerId}
              asks={orderBook.asks}
              bids={orderBook.bids}
  trades={trades}
              bookStats={bookStats}
              tradePulse={tradePulse}
              tradesHasMore={tradesHasMore}
              tradesLoadingMore={tradesLoadingMore}
              onLoadMoreTrades={handleLoadMoreTrades}
              credBalance={credBalance}
              onPlaceOrder={handlePlaceOrder}
              watchlist={watchlist}
              onToggleWatchlist={handleToggleWatchlist}
              joinedServers={joinedServers}
              onToggleJoinServer={handleToggleJoinServer}
              onSelectTab={setActiveTab}
              lastTxReceipt={lastTxReceipt}
              onDismissReceipt={() => setLastTxReceipt(null)}
              onCreateServer={handleCreateTokenizedServer}
              discordGuilds={discordGuilds}
              onConnectDiscord={() => handleDiscordLogin(null)}
              isLoggedIn={user.isLoggedIn}
              isOwnerOfSelectedServer={Boolean(
                activeOwnedServer &&
                  selectedServer &&
                  (activeOwnedServer.serverId === selectedServer.id ||
                    ownedTokenizedStocks.some((s) => s.serverId === selectedServer.id))
              )}
              onManageServer={(id) => {
                setSelectedOwnedServerId(id);
                setActiveTab('Manage');
              }}
            />
          )}

          {guardedTab === 'Wallet' && (
            <WalletView
              credBalance={credBalance}
              servers={serversWithHoldings}
              wallet={wallet}
              activities={activities}
              onSelectTab={setActiveTab}
              onSelectServerForTrade={handleSelectServerForTrade}
              userId={authUserId || DEMO_USER.id}
              onTriggerToast={showToast}
              onRefreshWallet={refreshWallet}
            />
          )}

          {guardedTab === 'Leaderboard' && (
            <LeaderboardView
              traders={traderBoard}
              servers={serverBoard}
              onSelectServerForTrade={(ticker) => {
                const s = allCombinedServers.find(
                  (srv) => srv.id === ticker || srv.ticker.toLowerCase() === `$${ticker}`.toLowerCase(),
                );
                if (s) setSelectedServerId(s.id);
                setActiveTab('Exchange');
              }}
              onOpenBoostModal={(ticker) => {
                const s = allCombinedServers.find(
                  (srv) => srv.id === ticker || srv.ticker.toLowerCase() === `$${ticker}`.toLowerCase(),
                );
                if (s) setModalServerId(s.id);
                setActiveModal('boost');
              }}
              onSelectTab={setActiveTab}
            />
          )}

          {guardedTab === 'Portfolio' && (
            <PortfolioView
              servers={serversWithHoldings}
              credBalance={credBalance}
              inrBalance={inrBalance}
              onSelectTab={setActiveTab}
              onSelectServerForTrade={handleSelectServerForTrade}
              onOpenWithdrawModal={() => setActiveModal('withdraw')}
              onOpenBoostModal={() => {
                setModalServerId(null);
                setActiveModal('boost');
              }}
            />
          )}

          {guardedTab === 'Settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={(newVals) => setSettings((prev) => ({ ...prev, ...newVals }))}
              user={user}
              onOpenDiscordLogin={() => handleDiscordLogin(null)}
              onTriggerToast={showToast}
            />
          )}

          {guardedTab === 'CordScan' && (
            <CordScanView
              onSelectTab={setActiveTab}
              onSelectServerForTrade={handleSelectServerForTrade}
              onTriggerToast={showToast}
            />
          )}

          {guardedTab === 'Guide' && (
            <ProjectGuideView
              onSelectTab={setActiveTab}
              onSelectServerForTrade={handleSelectServerForTrade}
            />
          )}


        </motion.div>
      </AnimatePresence>

      {/* Global Interactive Modals */}
      <ActionModals
        activeModal={activeModal}
        onClose={() => {
          setActiveModal(null);
          setModalServerId(null);
        }}
        servers={serversWithHoldings}
        credBalance={credBalance}
        inrBalance={inrBalance}
        boostServer={boostModalServer}
        userId={authUserId ?? ''}
        canClaimCashDrop={wallet?.dailyStatus.canClaimCashDrop ?? true}
        boostsUsedToday={wallet?.dailyStatus.boostsUsedToday ?? 0}
        onBoostVerified={handleBoostVerified}
        onWithdraw={handleCompleteWithdraw}
        onLaunchAd={handleCompleteAd}
        onOpenTokenizeModal={() => setIsTokenizeModalOpen(true)}
        busy={busy}
      />

      {/* Global Tokenize Discord Server Modal */}
      <TokenizeServerModal
        isOpen={isTokenizeModalOpen}
        onClose={() => setIsTokenizeModalOpen(false)}
        existingServers={allCombinedServers}
        onTokenize={handleCreateTokenizedServer}
        discordGuilds={discordGuilds}
        botClientId={botClientId}
        installedGuildIds={installedGuildIds}
        onConnectDiscord={() => handleDiscordLogin(null)}
        onRefreshDiscordGuilds={handleRefreshDiscordGuilds}
        isLoggedIn={user.isLoggedIn}
        username={user.username}
      />

      {/* Mobile-Friendly Web3 Wallet Connect Modal */}
      <ConnectWalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnected={handleWalletConnected}
        currentAddress={web3Wallet?.address}
      />

      {/* Subtle Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className={
              toastMsg.kind === 'error'
                ? 'fixed bottom-5 right-5 z-50 bg-[#7F1D1D] text-white text-[12.5px] font-medium px-4 py-2.5 rounded-xl shadow-lg border border-[#991B1B] flex items-center gap-2.5 max-w-[400px]'
                : toastMsg.kind === 'info'
                  ? 'fixed bottom-5 right-5 z-50 bg-[#5865F2] text-white text-[12.5px] font-medium px-4 py-2.5 rounded-xl shadow-lg border border-[#4752C4] flex items-center gap-2.5 max-w-[400px]'
                  : 'fixed bottom-5 right-5 z-50 bg-[#18181B] text-white text-[12.5px] font-medium px-4 py-2.5 rounded-xl shadow-lg border border-[#27272A] flex items-center gap-2.5 max-w-[400px]'
            }
          >
            {toastMsg.kind === 'error' ? (
              <XCircle className="w-4 h-4 text-red-300 shrink-0" />
            ) : toastMsg.kind === 'info' ? (
              <Info className="w-4 h-4 text-white/80 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{toastMsg.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
