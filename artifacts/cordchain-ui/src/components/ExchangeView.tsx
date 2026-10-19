import React, { useState, useEffect, useMemo } from 'react';
import {
  Store,
  Star,
  Wallet,
  Trophy,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Search,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Zap,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
  LayoutDashboard,
  ArrowLeft,
  Plus,
  X,
  Sliders,
} from 'lucide-react';
import {
  ServerAsset,
  ExchangeSideNav,
  OrderBookRow,
  TradeRecord,
  CandlePoint,
  MainTab,
} from '../types';
import { ServerIcon, DiscordLogo } from './Icons';
import { CandlestickChart } from './CandlestickChart';
import { TokenizeServerModal } from './TokenizeServerModal';
import { GoogleAdView } from './GoogleAdView';
import { TOP_LEAGUES } from '../data/mockData';
import {
  shortenAddress,
  shortenTxHash,
  getCordScanTxUrl,
  getCordScanTokenUrl,
} from '../lib/blockchain';
import { ApiTradeBlockchainReceipt, ChartTimeframe, fetchCandles, ledgerCandlesToPoints, quoteTrade, type ApiOrderBookResult } from '../lib/api';
import { fmtPoints, fmtPriceInput, fmtUsd } from '../lib/formatters';


interface ExchangeViewProps {
  selectedServer?: ServerAsset | null;
  allServers: ServerAsset[];
  onSelectServer: (serverId: string) => void;
  asks: OrderBookRow[];
  bids: OrderBookRow[];
  trades: TradeRecord[];
  bookStats?: ApiOrderBookResult | null;
  tradePulse?: number;
  tradesHasMore?: boolean;
  tradesLoadingMore?: boolean;
  onLoadMoreTrades?: () => void;
  credBalance: number;
  onPlaceOrder: (side: 'buy' | 'sell', amount: number, priceUsd: number) => void;
  watchlist: string[];
  onToggleWatchlist: (serverId: string) => void;
  joinedServers: string[];
  onToggleJoinServer: (serverId: string) => void;
  onSelectTab: (tab: MainTab) => void;
  lastTxReceipt?: ApiTradeBlockchainReceipt | null;
  onDismissReceipt?: () => void;
  onCreateServer?: (newServer: ServerAsset) => void;
  discordGuilds?: Array<{ id: string; name: string; iconUrl: string | null }>;
  onConnectDiscord?: () => void;
  isLoggedIn?: boolean;
  isOwnerOfSelectedServer?: boolean;
  onManageServer?: (serverId: string) => void;
}

export const ExchangeView: React.FC<ExchangeViewProps> = ({
  selectedServer,
  allServers,
  onSelectServer,
  asks,
  bids,
  trades,
  bookStats,
  tradePulse = 0,
  tradesHasMore = false,
  tradesLoadingMore = false,
  onLoadMoreTrades,
  credBalance,
  onPlaceOrder,
  watchlist,
  onToggleWatchlist,
  joinedServers,
  onToggleJoinServer,
  onSelectTab,
  lastTxReceipt,
  onDismissReceipt,
  onCreateServer,
  discordGuilds,
  onConnectDiscord,
  isLoggedIn,
  isOwnerOfSelectedServer,
  onManageServer,
}) => {
  const [sideNav, setSideNav] = useState<ExchangeSideNav>('Market');
  const [isTokenizeModalOpen, setIsTokenizeModalOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isChartExpanded, setIsChartExpanded] = useState<boolean>(false);
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'Market' | 'Limit' | 'Stop-Limit'>('Market');
  const [amountInput, setAmountInput] = useState<string>('10');
  const serverPrice = selectedServer?.priceUsd ?? 25.0;
  const [limitPriceInput, setLimitPriceInput] = useState<string>(serverPrice.toFixed(2));
  const [stopPriceInput, setStopPriceInput] = useState<string>((serverPrice * 0.95).toFixed(2));
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1h');
  const [perfRange, setPerfRange] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1D');
  const [precision, setPrecision] = useState<'0.01' | '0.1' | '1.0'>('0.01');
  const [selectedLeagueFilter, setSelectedLeagueFilter] = useState<string | null>(null);
  const [receiptCopied, setReceiptCopied] = useState(false);

  // 24h Performance card: the sparkline is built from the same ledger candles
  // as the main chart — one fetch per range, zero static paths.
  type PerfRange = '1D' | '1W' | '1M' | '3M' | '1Y';
  const perfRangeInterval: Record<PerfRange, ChartTimeframe> = {
    '1D': '1h',
    '1W': '1D',
    '1M': '1D',
    '3M': '1W',
    '1Y': '1W',
  };
  const perfRangeLimit: Record<PerfRange, number> = {
    '1D': 24,
    '1W': 7,
    '1M': 30,
    '3M': 13,
    '1Y': 52,
  };
  const [perfSeries, setPerfSeries] = useState<Array<{ t: string; close: number; dateLabel?: string }>>([]);
  const [perfLedgerEvents, setPerfLedgerEvents] = useState<number>(0);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfFailed, setPerfFailed] = useState(false);

  useEffect(() => {
    if (!selectedServer) {
      setPerfSeries([]);
      return;
    }
    let alive = true;
    setPerfLoading(true);
    setPerfFailed(false);
    fetchCandles(selectedServer.id, perfRangeInterval[perfRange], perfRangeLimit[perfRange])
      .then((res) => {
        if (!alive) return;
        setPerfSeries(
          res.candles.map((c) => {
            const d = new Date(c.t);
            return {
              t: c.t,
              close: c.c,
              dateLabel:
                perfRange === '1D'
                  ? undefined
                  : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            };
          }),
        );
        setPerfLedgerEvents(res.ledgerEvents);
      })
      .catch(() => {
        if (alive) setPerfFailed(true);
      })
      .finally(() => {
        if (alive) setPerfLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedServer?.id, perfRange, tradePulse]);

  // Dynamic sparkline geometry from the real ledger closes
  const perfCloses = perfSeries.map((p) => p.close);
  const perfUp =
    perfCloses.length >= 2 ? perfCloses[perfCloses.length - 1] >= perfCloses[0] : true;
  const perfChangePct =
    perfCloses.length >= 2 && perfCloses[0] > 0
      ? ((perfCloses[perfCloses.length - 1] - perfCloses[0]) / perfCloses[0]) * 100
      : 0;
  const perfSparkline = (() => {
    if (perfCloses.length < 2) return null;
    const W = 320;
    const H = 75;
    const PAD_X = 3;
    let min = Math.min(...perfCloses);
    let max = Math.max(...perfCloses);
    if (max - min < 1e-12) {
      min -= 1e-9;
      max += 1e-9;
    }
    const span = max - min;
    const stepX = (W - PAD_X * 2) / (perfCloses.length - 1);
    const y = (v: number) => H - 6 - ((v - min) / span) * (H - 14);
    const line = perfCloses
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${(PAD_X + i * stepX).toFixed(2)} ${y(v).toFixed(2)}`)
      .join(' ');
    const lastX = PAD_X + (perfCloses.length - 1) * stepX;
    const area = `${line} L${lastX.toFixed(2)} ${H - 2} L${PAD_X} ${H - 2} Z`;
    const baseY = y(perfCloses[0]);
    return { line, area, baseY, color: perfUp ? '#159966' : '#EF4444', gradId: perfUp ? 'perfAreaUp' : 'perfAreaDown' };
  })();

  useEffect(() => {
    if (selectedServer) {
      setLimitPriceInput(fmtPriceInput(selectedServer.priceUsd));
      setStopPriceInput((selectedServer.priceUsd * 0.95).toFixed(6));
    }
  }, [selectedServer?.id, selectedServer?.priceUsd]);

  // Real ledger candles: fetched from the backend (trade_transactions +
  // price_history built OHLC), reshot whenever the timeframe or symbol changes.
  const [ledgerCandles, setLedgerCandles] = useState<CandlePoint[]>([]);
  const [candleMeta, setCandleMeta] = useState<{ ledgerEvents: number; livePrice: number } | null>(null);
  const [candlesLoading, setCandlesLoading] = useState(false);
  const [candlesStale, setCandlesStale] = useState(false);

  useEffect(() => {
    if (!selectedServer) {
      setLedgerCandles([]);
      setCandleMeta(null);
      return;
    }
    let alive = true;
    setCandlesLoading(true);
    fetchCandles(selectedServer.id, timeframe)
      .then((res) => {
        if (!alive) return;
        setLedgerCandles(ledgerCandlesToPoints(res.candles));
        setCandleMeta({ ledgerEvents: res.ledgerEvents, livePrice: res.livePrice });
        setCandlesStale(false);
      })
      .catch(() => {
        if (alive) setCandlesStale(true);
      })
      .finally(() => {
        if (alive) setCandlesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedServer.id, timeframe, selectedServer.priceUsd, tradePulse]);

  const activeCandles = ledgerCandles;

  const feedLabel = candlesLoading
    ? 'Syncing ledger…'
    : candlesStale
      ? 'Ledger stale — retrying…'
      : ledgerCandles.length < 3
        ? `Ledger · ${candleMeta?.ledgerEvents ?? ledgerCandles.length} events`
        : 'Live Feed';

  // Balanced 5-level depth for vertically compact layout
  const displayAsks = useMemo(() => {
    return asks.slice(0, 5);
  }, [asks]);

  const displayBids = useMemo(() => {
    return bids.slice(0, 5);
  }, [bids]);

  const numericAmount = parseFloat(amountInput) || 0;
  const numericLimitPrice = parseFloat(limitPriceInput) || serverPrice;
  const effectivePrice = orderType === 'Market' ? serverPrice : numericLimitPrice;

  // Ledger-derived buy/sell pressure: real executed share volumes from the
  // backend orderbook endpoint (falls back to 50/50 with no history).
  const bookTotalShares =
    (bookStats?.buyVolume24hShares ?? 0) + (bookStats?.sellVolume24hShares ?? 0);
  const bidRatioPct =
    bookTotalShares > 0
      ? Math.round(((bookStats?.buyVolume24hShares ?? 0) / bookTotalShares) * 100)
      : 50;
  const askRatioPct = 100 - bidRatioPct;
  const emptyBook = displayAsks.length === 0 && displayBids.length === 0;

  // Live quote from the real constant-product solver — both the slippage AND
  // the actual $CRED an order would cost/yield (never just spot × qty).
  const [liveQuote, setLiveQuote] = useState<{ totalCred: string; slippagePct: number } | null>(null);
  useEffect(() => {
    if (!selectedServer || numericAmount <= 0) {
      setLiveQuote(null);
      return undefined;
    }
    let alive = true;
    const t = setTimeout(() => {
      quoteTrade(selectedServer.id, orderSide === 'buy' ? 'BUY' : 'SELL', Math.max(1, Math.floor(numericAmount)))
        .then((q) => {
          if (alive) setLiveQuote({ totalCred: q.totalCred, slippagePct: q.estimatedSlippagePct });
        })
        .catch(() => {
          if (alive) setLiveQuote(null);
        });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [selectedServer?.id, orderSide, numericAmount, tradePulse]);
  const estimatedSlippagePct = orderType === 'Market' ? liveQuote?.slippagePct ?? 0 : 0;

  const isStarred = selectedServer ? watchlist.includes(selectedServer.id) : false;
  const isJoined = selectedServer ? joinedServers.includes(selectedServer.id) : false;

  // Related tickers: pinned favourites on the watchlist first, then top ranked live guilds
  const relatedServers = selectedServer
    ? allServers
        .filter((s) => s.id !== selectedServer.id)
        .sort((a, b) => {
          const aPinned = watchlist.includes(a.id) ? 1 : 0;
          const bPinned = watchlist.includes(b.id) ? 1 : 0;
          if (aPinned !== bPinned) return bPinned - aPinned;
          return b.change24h - a.change24h;
        })
        .slice(0, 4)
    : [];

  if (!selectedServer) {
    return (
      <div className="max-w-[1440px] mx-auto px-5 py-16 text-center select-none">
        <div className="max-w-md mx-auto bg-white border border-[#EAE9E4] rounded-2xl p-8 space-y-4 shadow-xs">
          <Store className="w-10 h-10 text-[#8C734B] mx-auto" />
          <h2 className="text-[18px] font-bold text-[#18181B]">No Server Stocks Listed Yet</h2>
          <p className="text-[12.5px] text-[#71717A] leading-relaxed">
            No Discord communities have been tokenized on CordChain yet. Be the first to launch an IPO for your Discord server on CordLedger!
          </p>
          <button
            onClick={() => setIsTokenizeModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-white text-[12.5px] font-semibold inline-flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tokenize Your Discord Server</span>
          </button>
        </div>
        {isTokenizeModalOpen && onCreateServer && (
          <TokenizeServerModal
            isOpen={isTokenizeModalOpen}
            onClose={() => setIsTokenizeModalOpen(false)}
            existingServers={allServers}
            onTokenize={(newServer) => {
              onCreateServer(newServer);
              setIsTokenizeModalOpen(false);
            }}
            discordGuilds={discordGuilds}
            onConnectDiscord={onConnectDiscord}
            isLoggedIn={isLoggedIn}
          />
        )}
      </div>
    );
  }

  const handlePercentageClick = (pct: number) => {
    if (orderSide === 'buy') {
      if (!(serverPrice > 0)) return; // dormant market — no price to size against
      const maxShares = Math.floor(((credBalance * (pct / 100)) / effectivePrice) * 10) / 10;
      setAmountInput(String(Math.max(1, Math.round(maxShares))));
    } else {
      const owned = selectedServer.holdings ?? 0; // real position only — no invented fallback
      if (owned <= 0) return;
      setAmountInput(String(Math.max(1, Math.floor(owned * (pct / 100)))));
    }
  };

  const handleSelectOrderBookRow = (side: 'buy' | 'sell', price: number, amount: number) => {
    setOrderSide(side);
    setOrderType('Limit');
    setLimitPriceInput(fmtPriceInput(price));
    setAmountInput(String(Math.min(amount, 100)));
  };

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = numericAmount > 0 ? numericAmount : 10;
    onPlaceOrder(orderSide, qty, effectivePrice);
  };

  const handleSideNavClick = (nav: ExchangeSideNav) => {
    setSideNav(nav);
    if (nav === 'Dashboard') {
      onSelectTab('Dashboard');
    } else if (nav === 'Leaderboard') {
      onSelectTab('Leaderboard');
    } else if (nav === 'My Portfolio') {
      onSelectTab('Portfolio');
    }
  };

  const renderLeagueIcon = (id: string) => {
    switch (id) {
      case 'Titan':
        return (
          <div className="w-8 h-8 rounded-full bg-[#EFECE6] flex items-center justify-center text-[#18181B] shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
        );
      case 'Arena':
        return (
          <div className="w-8 h-8 rounded-full bg-[#EFECE6] flex items-center justify-center text-[#18181B] shrink-0">
            <DiscordLogo className="w-4 h-4" />
          </div>
        );
      case 'Club':
        return (
          <div className="w-8 h-8 rounded-full bg-[#EFECE6] flex items-center justify-center text-[#4F46E5] shrink-0">
            <div className="w-4 h-4 rounded bg-[#4F46E5] text-white text-[9px] font-bold flex items-center justify-center">
              C
            </div>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-[#EFECE6] flex items-center justify-center text-[#3B82F6] shrink-0">
            <DiscordLogo className="w-4 h-4" />
          </div>
        );
    }
  };

  const holdingsCount = selectedServer.holdings ?? 0;
  const avgPrice = holdingsCount > 0 ? (selectedServer.avgBuyPriceUsd ?? 0) : 0;
  const positionValue = holdingsCount * selectedServer.priceUsd;
  const pnlPct = holdingsCount > 0 && avgPrice > 0
    ? +(((selectedServer.priceUsd - avgPrice) / avgPrice) * 100).toFixed(2)
    : 0;
  const pnlUp = pnlPct > 0;
  const pnlDown = pnlPct < 0;

  return (
    <div className="w-full max-w-[1600px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-5 py-4 flex gap-4 items-start">
      {/* LEFT SIDEBAR (Expandable / Shrinkable) */}
      <aside
        className={`${
          isSidebarCollapsed ? 'w-[64px]' : 'w-[210px]'
        } shrink-0 transition-all duration-200 flex flex-col justify-between min-h-[calc(100vh-104px)] select-none`}
      >
        <div>
          {/* Header Block with Collapse/Expand Toggle */}
          {/* Back to Dashboard Quick Action */}
          <button
            onClick={() => onSelectTab('Dashboard')}
            className={`w-full flex items-center ${
              isSidebarCollapsed ? 'justify-center p-2 mb-2' : 'gap-2 px-2.5 py-1.5 mb-2.5'
            } rounded-xl bg-transparent hover:bg-[#EFECE6] text-[#71717A] hover:text-[#18181B] text-[12px] font-semibold transition-colors cursor-pointer`}
            title="Return to CordChain Dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {!isSidebarCollapsed && <span>Dashboard</span>}
          </button>

          {/* Header Block with Collapse/Expand Toggle */}
          {!isSidebarCollapsed ? (
            <div className="flex items-center justify-between px-2 mb-4">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#EFECE6] flex items-center justify-center text-[#18181B] shrink-0 mt-0.5">
                  <Store className="w-4 h-4" strokeWidth={1.9} />
                </div>
                <div>
                  <h2 className="text-[13.5px] font-semibold text-[#18181B] leading-tight">Exchange</h2>
                  <p className="text-[11px] text-[#71717A] mt-0.5">Discord stocks</p>
                </div>
              </div>
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-1 rounded-lg hover:bg-[#EFECE6] text-[#71717A] hover:text-[#18181B] transition-colors cursor-pointer"
                title="Collapse sidebar to maximize chart space"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center mb-4">
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="w-10 h-10 rounded-xl bg-[#EFECE6] flex items-center justify-center text-[#18181B] hover:bg-[#E4E0D6] transition-colors cursor-pointer"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Sidebar Navigation */}
          <nav className="space-y-1">
            {[
              {
                id: 'Dashboard' as ExchangeSideNav,
                label: 'Dashboard',
                icon: <LayoutDashboard className="w-4 h-4" />,
              },
              {
                id: 'Market' as ExchangeSideNav,
                label: 'Market',
                icon: (
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="4.5" y1="2" x2="4.5" y2="14" />
                    <rect x="3" y="5" width="3" height="6" fill="currentColor" />
                    <line x1="11.5" y1="3" x2="11.5" y2="13" />
                    <rect x="10" y="6" width="3" height="4" />
                  </svg>
                ),
              },
              { id: 'Watchlist' as ExchangeSideNav, label: 'Watchlist', icon: <Star className="w-4 h-4" /> },
              { id: 'My Portfolio' as ExchangeSideNav, label: 'My Portfolio', icon: <Wallet className="w-4 h-4" /> },
              { id: 'Leaderboard' as ExchangeSideNav, label: 'Leaderboard', icon: <Trophy className="w-4 h-4" /> },
            ].map((item) => {
              const isActive = sideNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSideNavClick(item.id)}
                  title={item.label}
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'
                  } rounded-xl text-[13px] transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#EFECE6] text-[#18181B] font-semibold'
                      : 'text-[#52525B] hover:bg-[#EFECE6]/50 hover:text-[#18181B] font-medium'
                  }`}
                >
                  <span>{item.icon}</span>
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* + Tokenize Server Action Button */}
          <button
            onClick={() => setIsTokenizeModalOpen(true)}
            className={`w-full flex items-center ${
              isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-center gap-2 px-3 py-2'
            } rounded-xl bg-[#18181B] text-white hover:bg-[#27272A] text-[12.5px] font-semibold transition-all shadow-xs cursor-pointer mt-3`}
            title="Tokenize a new Discord Server on CordLedger"
          >
            <Plus className="w-4 h-4" />
            {!isSidebarCollapsed && <span>Tokenize Server</span>}
          </button>

          <hr className="my-4 border-[#EAE9E4]" />

          {/* Top Leagues */}
          <div>
            {!isSidebarCollapsed ? (
              <div className="flex items-center justify-between px-2 mb-3">
                <span className="text-[12px] font-semibold text-[#18181B]">Top Leagues</span>
                <button
                  onClick={() => setSelectedLeagueFilter(null)}
                  className="text-[11px] text-[#71717A] hover:text-[#18181B] inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>All</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ) : null}

            <div className={`space-y-${isSidebarCollapsed ? '2' : '2.5'}`}>
              {TOP_LEAGUES.map((league) => {
                const isSelected = selectedLeagueFilter === league.id;
                return (
                  <button
                    key={league.id}
                    title={`${league.name} (${league.subtitle}) - ${league.count} servers`}
                    onClick={() => {
                      setSelectedLeagueFilter(isSelected ? null : league.id);
                      const matching = allServers.find((s) => s.league === league.id);
                      if (matching) onSelectServer(matching.id);
                    }}
                    className={`w-full flex items-center ${
                      isSidebarCollapsed ? 'justify-center p-2' : 'justify-between px-2 py-1.5 text-left'
                    } rounded-xl transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#EFECE6]' : 'hover:bg-[#EFECE6]/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {renderLeagueIcon(league.id)}
                      {!isSidebarCollapsed && (
                        <div>
                          <p className="text-[12.5px] font-semibold text-[#18181B] leading-tight">
                            {league.name}
                          </p>
                          <p className="text-[10.5px] text-[#71717A] mt-0.5">{league.subtitle}</p>
                        </div>
                      )}
                    </div>
                    {!isSidebarCollapsed && (
                      <span className="text-[11.5px] text-[#71717A] tabular-nums">{league.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Expand/Collapse Toggle & Info */}
        <div>
          {!isSidebarCollapsed ? (
            <div className="mt-6 bg-white border border-[#EAE9E4] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[13px] font-semibold text-[#18181B]">Trade. Grow.</p>
                <button
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="text-[10.5px] text-[#71717A] hover:text-[#18181B] inline-flex items-center gap-1 cursor-pointer"
                >
                  <PanelLeftClose className="w-3 h-3" />
                  <span>Shrink</span>
                </button>
              </div>
              <p className="text-[11px] text-[#71717A] leading-relaxed mb-2">
                Discord stocks on CordLedger.
              </p>
            </div>
          ) : (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="w-10 h-10 rounded-xl bg-white border border-[#EAE9E4] hover:bg-[#F7F6F3] flex items-center justify-center text-[#71717A] hover:text-[#18181B] transition-colors cursor-pointer"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          )}

          {!isSidebarCollapsed && (
            <div className="mt-3">
              <GoogleAdView format="sidebar" label="Partner Sponsored" />
            </div>
          )}
        </div>
      </aside>

      {/* Watchlist View Mode if Watchlist is selected */}
      {sideNav === 'Watchlist' ? (
        <main className="flex-1 min-w-0 bg-white border border-[#EAE9E4] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EAE9E4]">
            <div>
              <h2 className="text-[18px] font-bold text-[#18181B]">Your Watchlist ({watchlist.length})</h2>
              <p className="text-[12px] text-[#71717A]">Quickly monitor and trade your pinned Discord servers.</p>
            </div>
            <button
              onClick={() => setSideNav('Market')}
              className="px-3.5 py-1.5 rounded-xl border border-[#EAE9E4] hover:bg-[#F8F7F4] text-[12px] font-medium text-[#18181B]"
            >
              Back to Full Market
            </button>
          </div>

          <div className="divide-y divide-[#F4F3EE]">
            {allServers
              .filter((s) => watchlist.includes(s.id))
              .map((srv) => (
                <div key={srv.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onToggleWatchlist(srv.id)}
                      className="text-[#CA8A04] hover:opacity-80"
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>
                    <ServerIcon id={srv.id} variant="table" />
                    <div>
                      <p className="font-semibold text-[#18181B] text-[13.5px]">{srv.ticker}</p>
                      <p className="text-[11.5px] text-[#71717A]">{srv.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right font-mono">
                      <p className="text-[14px] font-bold text-[#18181B]">${fmtUsd(srv.priceUsd)}</p>
                      <p
                        className={`text-[11.5px] font-medium ${
                          srv.change24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                        }`}
                      >
                        {srv.change24h >= 0 ? '+' : ''}{srv.change24h.toFixed(1)}%
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        onSelectServer(srv.id);
                        setSideNav('Market');
                      }}
                      className="px-4 py-2 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-white text-[12px] font-semibold"
                    >
                      Trade
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </main>
      ) : (
        /* CENTER MAIN TRADING WORKSPACE */
        <main className="flex-1 min-w-0 space-y-4">
          {/* Ultra-Compact High-Density Server Header Bar */}
          <section className="bg-white border border-[#EAE9E4] rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            {/* Left: Identity + Ticker + Name + Badges + Address */}
            <div className="flex items-center gap-3 min-w-0">
              <ServerIcon id={selectedServer.id} variant="table" />
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <h1 className="text-[17px] font-bold text-[#18181B] leading-none tracking-tight">
                  {selectedServer.ticker}
                </h1>
                <span className="text-[12px] font-medium text-[#71717A] truncate max-w-[130px] sm:max-w-[200px]">
                  {selectedServer.name}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#F4EFE6] text-[#8C734B] text-[10px] font-semibold shrink-0">
                  {selectedServer.league}
                </span>
                <span className="px-2 py-0.5 rounded-md border border-[#EAE9E4] text-[#52525B] text-[10px] font-medium shrink-0">
                  Rank #{selectedServer.rank}
                </span>
                {selectedServer.collaboration && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] text-[10px] font-semibold shrink-0"
                    title={`${selectedServer.collaboration.contributors24h} members active · ${selectedServer.collaboration.description}`}
                  >
                    <span>{selectedServer.collaboration.icon}</span>
                    <span>{selectedServer.collaboration.tierName}</span>
                    <span className="text-[#15803D] font-mono font-bold">({selectedServer.collaboration.multiplier}x)</span>
                  </span>
                )}
                <span className="text-[11px] text-[#71717A] hidden xl:inline shrink-0">
                  {selectedServer.members}
                </span>
                {selectedServer.tokenContractAddress && (
                  <a
                    href={selectedServer.tokenExplorerUrl || getCordScanTokenUrl(selectedServer.id || selectedServer.tokenContractAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EEF2FF] border border-[#C7D2FE] text-[#4338CA] hover:bg-[#E0E7FF] text-[10.5px] font-mono font-medium transition-colors shrink-0"
                    title="Verified CordLedger Token"
                  >
                    <ShieldCheck className="w-3 h-3 text-[#4F46E5]" />
                    <span>Token {shortenAddress(selectedServer.tokenContractAddress)}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                  </a>
                )}
              </div>
            </div>

            {/* Middle: Live Price & 24h Change */}
            <div className="flex items-center gap-2.5 px-3 py-1 bg-[#FAF9F6] border border-[#EAE9E4] rounded-xl font-mono shrink-0">
              <span className="text-[20px] font-bold text-[#18181B] tabular-nums tracking-tight">
                ${fmtPoints(selectedServer.priceUsd)}
              </span>
              <span
                className={`text-[12px] font-semibold inline-flex items-center gap-0.5 tabular-nums ${
                  selectedServer.change24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                }`}
              >
                {selectedServer.change24h >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                <span>
                  {selectedServer.change24h >= 0 ? '+' : ''}
                  {selectedServer.change24h.toFixed(1)}%
                </span>
              </span>
            </div>

            {/* Right: Inline 24h Stats + Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono text-[#71717A] border-r border-[#EAE9E4] pr-3">
                <span>24h H: <strong className="text-[#18181B] font-semibold">${fmtPoints(selectedServer.high24hUsd)}</strong></span>
                <span>24h L: <strong className="text-[#18181B] font-semibold">${fmtPoints(selectedServer.low24hUsd)}</strong></span>
                <span>Vol: <strong className="text-[#18181B] font-semibold">{selectedServer.volume24h}</strong></span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onToggleJoinServer(selectedServer.id)}
                  className={`px-3 py-1.5 rounded-lg border text-[11.5px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isJoined
                      ? 'bg-[#18181B] text-white border-[#18181B]'
                      : 'bg-white hover:bg-[#F7F6F3] text-[#18181B] border-[#E4E3DE]'
                  }`}
                >
                  <DiscordLogo className="w-3 h-3" />
                  <span>{isJoined ? 'Joined' : 'Join'}</span>
                </button>
                <button
                  onClick={() => onToggleWatchlist(selectedServer.id)}
                  aria-label="Toggle Watchlist"
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                    isStarred
                      ? 'bg-[#FEF9C3] border-[#FDE047] text-[#CA8A04]'
                      : 'bg-white hover:bg-[#F7F6F3] border-[#E4E3DE] text-[#52525B]'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-current' : ''}`} />
                </button>
                <button
                  onClick={() => setIsTokenizeModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#E4E3DE] bg-white hover:bg-[#F7F6F3] text-[#18181B] inline-flex items-center gap-1.5 text-[11.5px] font-semibold transition-colors cursor-pointer shadow-2xs"
                  title="Tokenize a new Discord Server"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tokenize</span>
                </button>
                {isOwnerOfSelectedServer && onManageServer && (
                  <button
                    onClick={() => onManageServer(selectedServer.id)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#4F46E5] bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4338CA] inline-flex items-center gap-1.5 text-[11.5px] font-semibold transition-colors cursor-pointer shadow-2xs"
                    title="Manage this token, shares, and parameters"
                  >
                    <Sliders className="w-3.5 h-3.5 text-[#4F46E5]" />
                    <span className="hidden sm:inline">Manage</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Middle Split: Candlestick Chart (Flexible wide) + Shrunk Compact Order Book */}
          <div className="flex flex-col xl:flex-row gap-3.5 items-stretch">
            <div className="flex-1 min-w-0">
              <CandlestickChart
                server={selectedServer}
                candles={activeCandles}
                asks={asks}
                bids={bids}
                trades={trades}
                activeTimeframe={timeframe}
                onChangeTimeframe={setTimeframe}
                isExpanded={isChartExpanded}
                onToggleExpand={() => setIsChartExpanded(!isChartExpanded)}
                feedLabel={feedLabel}
                onSelectPrice={(p) => {
                  setLimitPriceInput(p.toFixed(2));
                  setOrderType('Limit');
                }}
              />
            </div>

            {/* Order Book Card - Compact & Clean */}
            <div
              className={`${
                isChartExpanded ? 'hidden' : 'w-full xl:w-[210px]'
              } shrink-0 bg-white border border-[#EAE9E4] rounded-2xl p-2.5 flex flex-col justify-between select-none`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5 px-0.5">
                  <h2 className="text-[12.5px] font-semibold text-[#18181B]">Order Book</h2>
                  <button
                    onClick={() =>
                      setPrecision((p) => (p === '0.01' ? '0.1' : p === '0.1' ? '1.0' : '0.01'))
                    }
                    className="px-2 py-0.5 rounded-md border border-[#EAE9E4] text-[10px] font-mono text-[#52525B] inline-flex items-center gap-1 hover:bg-[#F7F6F3] cursor-pointer"
                    title="Adjust price precision"
                  >
                    <span>{precision}</span>
                    <ChevronDown className="w-3 h-3 text-[#A1A1AA]" />
                  </button>
                </div>

                <div className="grid grid-cols-3 text-[9.5px] uppercase tracking-wider font-medium text-[#A1A1AA] pb-1 border-b border-[#F3F2EE] px-1">
                  <span>Price</span>
                  <span className="text-right">Size</span>
                  <span className="text-right">Total</span>
                </div>

                {emptyBook && (
                  <div className="py-3.5 px-1.5 text-center space-y-1.5">
                    <p className="text-[10.5px] font-semibold text-[#52525B] leading-relaxed">
                      No executions yet
                    </p>
                    <p className="text-[9.5px] text-[#A1A1AA] leading-relaxed">
                      Every trade routes instantly at the oracle price — executed orders will build this ladder.
                    </p>
                  </div>
                )}

                {/* Asks (Red) */}
                <div className="divide-y divide-[#FAF9F6] my-0.5">
                  {displayAsks.map((ask, idx) => {
                    return (
                      <div
                        key={idx}
                        onClick={() => handleSelectOrderBookRow('buy', ask.price, ask.amount)}
                        title="Click to place Limit Buy order at this price"
                        className="grid grid-cols-3 py-1 px-1 text-[11px] font-mono tabular-nums relative overflow-hidden cursor-pointer hover:bg-[#FDF2F2] rounded transition-colors"
                      >
                        <div
                          className="absolute right-0 inset-y-0.5 bg-[#FEE2E2]/70 rounded-l pointer-events-none transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, ask.depthPercent))}%` }}
                        />
                        <span className="text-[#EF4444] font-medium relative z-10">
                          ${fmtPoints(ask.price)}
                        </span>
                        <span className="text-right text-[#3F3F46] relative z-10">
                          {ask.amount >= 1000 ? `${(ask.amount / 1000).toFixed(1)}k` : ask.amount}
                        </span>
                        <span className="text-right text-[#3F3F46] relative z-10">
                          {ask.total}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Spread / Current Price */}
                <div className="py-1 my-0.5 border-y border-[#F3F2EE] flex items-center justify-between px-1 bg-[#FAFAF8] rounded">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[14px] font-bold font-mono tabular-nums ${
                        selectedServer.change24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}
                    >
                      ${fmtPoints(selectedServer.priceUsd)}
                    </span>
                    <span
                      className={`text-[11px] font-bold ${
                        selectedServer.change24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}
                    >
                      {selectedServer.change24h >= 0 ? '↑' : '↓'}
                    </span>
                  </div>
                  <span className="text-[9.5px] text-[#71717A] font-mono tabular-nums">
                    {displayAsks[0] && displayBids[0]
                      ? `AMM fill · $${fmtPoints(displayAsks[0].price - displayBids[0].price)} book gap`
                      : 'AMM · instant fill'}
                  </span>
                </div>

                {/* Bids (Green) */}
                <div className="divide-y divide-[#FAF9F6] my-0.5">
                  {displayBids.map((bid, idx) => {
                    return (
                      <div
                        key={idx}
                        onClick={() => handleSelectOrderBookRow('sell', bid.price, bid.amount)}
                        title="Click to place Limit Sell order at this price"
                        className="grid grid-cols-3 py-1 px-1 text-[11px] font-mono tabular-nums relative overflow-hidden cursor-pointer hover:bg-[#ECFDF5] rounded transition-colors"
                      >
                        <div
                          className="absolute right-0 inset-y-0.5 bg-[#DCFCE7]/70 rounded-l pointer-events-none transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, bid.depthPercent))}%` }}
                        />
                        <span className="text-[#10B981] font-medium relative z-10">
                          ${fmtPoints(bid.price)}
                        </span>
                        <span className="text-right text-[#3F3F46] relative z-10">
                          {bid.amount >= 1000 ? `${(bid.amount / 1000).toFixed(1)}k` : bid.amount}
                        </span>
                        <span className="text-right text-[#3F3F46] relative z-10">
                          {bid.total}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Depth Analytics & Ratio Meter */}
              <div className="pt-2 border-t border-[#F3F2EE] mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-[#71717A] px-0.5 font-mono">
                  <span>Executions 24h</span>
                  <span className="font-semibold text-[#18181B]">{(bookStats?.executions24h ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#71717A] px-0.5 font-mono">
                  <span>24h Range</span>
                  <span className="font-semibold text-[#18181B]">${fmtPoints(selectedServer.low24hUsd ?? selectedServer.priceUsd)} - ${fmtPoints(selectedServer.high24hUsd ?? selectedServer.priceUsd)}</span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[9.5px] font-mono font-medium mb-1 px-0.5">
                    <span className="text-[#EF4444]">{askRatioPct}% Ask</span>
                    <span className="text-[#71717A] text-[9px] uppercase tracking-wider">Executed</span>
                    <span className="text-[#10B981]">{bidRatioPct}% Bid</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-[#F4F4F5]">
                    <div className="bg-[#EF4444] rounded-l-full transition-all duration-500" style={{ width: `${askRatioPct}%` }} />
                    <div className="bg-[#10B981] rounded-r-full transition-all duration-500" style={{ width: `${bidRatioPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3-Column Row */}
          <div className="grid grid-cols-12 gap-4 items-stretch">
            {/* Price Overview */}
            <div className="col-span-12 md:col-span-3 bg-white border border-[#EAE9E4] rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-[13.5px] font-semibold text-[#18181B] mb-2 inline-flex items-center gap-2">
                  Price Overview
                  {selectedServer.marketState === 'dormant' && (
                    <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] text-[10px] font-semibold">
                      Dormant — no holders
                    </span>
                  )}
                </h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-[22px] font-bold text-[#18181B] tabular-nums">
                    ${fmtUsd(selectedServer.priceUsd)}
                  </span>
                  <span
                    className={`text-[11.5px] font-semibold inline-flex items-center gap-0.5 tabular-nums ${
                      selectedServer.change24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                    }`}
                  >
                    {selectedServer.change24h >= 0 ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {selectedServer.change24h >= 0 ? '+' : ''}
                    {selectedServer.change24h.toFixed(1)}% (24h)
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#71717A]">24h High</span>
                  <span className="font-semibold text-[#18181B] tabular-nums">
                    ${fmtUsd(selectedServer.high24hUsd)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#71717A]">24h Low</span>
                  <span className="font-semibold text-[#18181B] tabular-nums">
                    ${fmtUsd(selectedServer.low24hUsd)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#71717A]">Volume</span>
                  <span className="font-semibold text-[#18181B] tabular-nums">
                    {selectedServer.volume24h}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#71717A]">Market Cap</span>
                  <span className="font-semibold text-[#18181B] tabular-nums">
                    {selectedServer.marketCapUsd}
                  </span>
                </div>
              </div>
            </div>

            {/* About $SQUAD */}
            <div className="col-span-12 md:col-span-4 bg-white border border-[#EAE9E4] rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-[13.5px] font-semibold text-[#18181B] mb-2">
                  About {selectedServer.ticker}
                </h3>
                <p className="text-[12px] text-[#71717A] leading-[1.55] mb-3.5">
                  {selectedServer.description}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {selectedServer.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-full bg-[#F5F4F0] text-[#52525B] text-[11px] font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <button
                  onClick={() => onToggleJoinServer(selectedServer.id)}
                  className="px-3.5 py-2 rounded-xl border border-[#E4E3DE] hover:bg-[#F7F6F3] text-[12px] font-medium text-[#18181B] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Visit Server</span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#71717A]" />
                </button>
              </div>
            </div>

            {/* 24h Performance */}
            <div className="col-span-12 md:col-span-5 bg-white border border-[#EAE9E4] rounded-2xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[13.5px] font-semibold text-[#18181B]">24h Performance</h3>
                <div className="flex items-center gap-1">
                  {(['1D', '1W', '1M', '3M', '1Y'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setPerfRange(r)}
                      className={`px-2 py-0.5 rounded text-[10.5px] font-medium transition-colors cursor-pointer ${
                        perfRange === r
                          ? 'bg-[#EFECE6] text-[#18181B] font-semibold'
                          : 'text-[#A1A1AA] hover:text-[#18181B]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live area sparkline built from real ledger candles */}
              <div className="my-2">
                {perfSparkline ? (
                  <svg viewBox="0 0 320 75" className="w-full h-16 overflow-visible">
                    <defs>
                      <linearGradient id="perfAreaUp" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="perfAreaDown" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#EF4444" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#EF4444" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <line
                      x1="3"
                      y1={perfSparkline.baseY}
                      x2="317"
                      y2={perfSparkline.baseY}
                      stroke="#A1A1AA"
                      strokeWidth="0.8"
                      strokeDasharray="3 4"
                      strokeOpacity="0.45"
                    />
                    <path d={perfSparkline.area} fill={`url(#${perfSparkline.gradId})`} />
                    <path
                      d={perfSparkline.line}
                      fill="none"
                      stroke={perfSparkline.color}
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <div className="w-full h-16 flex items-center justify-center">
                    <p className="text-[11px] text-[#A1A1AA] font-mono text-center px-4">
                      {perfLoading
                        ? 'Syncing ledger…'
                        : perfFailed
                        ? 'Ledger feed unavailable — retry shortly'
                        : 'Not enough ledger history for this range yet'}
                    </p>
                  </div>
                )}
              </div>

              {perfSeries.length >= 2 && perfRange !== '1D' && perfSeries[0].dateLabel ? (
                <p className="text-[10px] text-[#A1A1AA] font-mono -mt-1 mb-1">
                  {perfSeries[0].dateLabel} → {perfSeries[perfSeries.length - 1].dateLabel} · {perfLedgerEvents} ledger events
                </p>
              ) : null}

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <p
                    className={`text-[14px] font-bold tabular-nums ${
                      perfCloses.length >= 2 && perfChangePct >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                    }`}
                  >
                    {perfCloses.length >= 2 && perfChangePct >= 0 ? '+' : ''}
                    {perfChangePct.toFixed(2)}%
                  </p>
                  <p className="text-[10.5px] text-[#A1A1AA]">Price Change ({perfRange})</p>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-[#18181B] tabular-nums">
                    {perfLedgerEvents.toLocaleString()}
                  </p>
                  <p className="text-[10.5px] text-[#A1A1AA]">Ledger Events</p>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-[#18181B] tabular-nums">{selectedServer.marketCapUsd}</p>
                  <p className="text-[10.5px] text-[#A1A1AA]">Market Cap</p>
                </div>
              </div>
            </div>
          </div>

          {/* Related Servers Row */}
          <section className="bg-white border border-[#EAE9E4] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-[13.5px] font-semibold text-[#18181B]">Related Servers</h3>
              <button
                onClick={() => relatedServers[0] && onSelectServer(relatedServers[0].id)}
                className="text-[11.5px] text-[#71717A] hover:text-[#18181B] inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Top gainer</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {relatedServers.map((srv) => {
                const up = srv.change24h >= 0;
                return (
                  <div
                    key={srv.id}
                    onClick={() => onSelectServer(srv.id)}
                    className="border border-[#EAE9E4] hover:border-[#D4D3CD] rounded-2xl p-3.5 flex flex-col justify-between transition-colors cursor-pointer bg-[#FDFDFC]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ServerIcon id={srv.id} variant="table" />
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-semibold text-[#18181B] leading-tight">
                            {srv.ticker}
                          </p>
                          <p className="text-[10.5px] text-[#A1A1AA] truncate mt-0.5">{srv.name}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-[#A1A1AA] shrink-0" />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-bold text-[#18181B] tabular-nums">
                          ${fmtPoints(srv.priceUsd)}
                        </span>
                        <span
                          className={`text-[11px] font-medium inline-flex items-center gap-0.5 tabular-nums ${
                            up ? 'text-[#10B981]' : 'text-[#EF4444]'
                          }`}
                        >
                          {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {up ? '+' : ''}
                          {srv.change24h.toFixed(1)}%
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectServer(srv.id);
                        }}
                        className="px-3 py-1 rounded-lg border border-[#E4E3DE] bg-white hover:bg-[#F5F4F0] text-[11px] font-medium text-[#18181B] cursor-pointer"
                      >
                        Trade
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      )}

      {/* RIGHT SIDEBAR COLUMN */}
      <aside className="w-[295px] shrink-0 space-y-4">
        {/* Trade Execution Box */}
        <section className="bg-white border border-[#EAE9E4] rounded-2xl p-5">
          <h2 className="text-[15px] font-semibold text-[#18181B] mb-3.5">Trade</h2>

          {/* Buy / Sell Segmented Switch */}
          <div className="bg-[#F4F3EF] p-1 rounded-xl grid grid-cols-2 mb-4">
            <button
              type="button"
              onClick={() => setOrderSide('buy')}
              className={`py-2 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer ${
                orderSide === 'buy'
                  ? 'bg-white text-[#10B981] shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                  : 'text-[#71717A] hover:text-[#18181B]'
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setOrderSide('sell')}
              className={`py-2 rounded-lg text-[12.5px] font-semibold transition-all cursor-pointer ${
                orderSide === 'sell'
                  ? 'bg-white text-[#EF4444] shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                  : 'text-[#71717A] hover:text-[#18181B]'
              }`}
            >
              Sell
            </button>
          </div>

          <form onSubmit={handleOrderSubmit} className="space-y-3.5">
            {/* Order Type */}
            <div>
              <label className="block text-[11.5px] text-[#71717A] mb-1.5">Order Type</label>
              <div className="relative">
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as 'Market' | 'Limit' | 'Stop-Limit')}
                  className="w-full appearance-none bg-[#F8F7F4] border border-[#EAE9E4] rounded-xl px-3.5 py-2.5 text-[12.5px] font-medium text-[#18181B] focus:outline-none focus:border-[#18181B] cursor-pointer"
                >
                  <option value="Market">Market</option>
                  <option value="Limit">Limit</option>
                  <option value="Stop-Limit">Stop-Limit</option>
                </select>
                <ChevronDown className="w-4 h-4 text-[#71717A] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Limit Price Input (for Limit and Stop-Limit orders) */}
            {orderType !== 'Market' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11.5px] text-[#71717A]">
                    {orderType === 'Stop-Limit' ? 'Limit Price (USD)' : 'Order Price (USD)'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setLimitPriceInput(fmtPriceInput(selectedServer.priceUsd))}
                    className="text-[10.5px] text-[#4F46E5] hover:underline cursor-pointer"
                  >
                    Current: ${fmtPoints(selectedServer.priceUsd)}
                  </button>
                </div>
                <div className="flex items-center bg-[#F8F7F4] border border-[#EAE9E4] rounded-xl px-3.5 py-2 focus-within:border-[#18181B]">
                  <input
                    type="number"
                    min="0"
                    step="0.00001"
                    value={limitPriceInput}
                    onChange={(e) => setLimitPriceInput(e.target.value)}
                    className="w-full bg-transparent text-[13px] font-mono font-medium text-[#18181B] focus:outline-none tabular-nums"
                  />
                  <span className="text-[11px] text-[#71717A] font-mono">USD</span>
                </div>
              </div>
            )}

            {/* Stop Trigger Price (for Stop-Limit orders) */}
            {orderType === 'Stop-Limit' && (
              <div>
                <label className="block text-[11.5px] text-[#71717A] mb-1.5">Stop Trigger Price (USD)</label>
                <div className="flex items-center bg-[#F8F7F4] border border-[#EAE9E4] rounded-xl px-3.5 py-2 focus-within:border-[#18181B]">
                  <input
                    type="number"
                    min="0"
                    step="0.00001"
                    value={stopPriceInput}
                    onChange={(e) => setStopPriceInput(e.target.value)}
                    className="w-full bg-transparent text-[13px] font-mono font-medium text-[#18181B] focus:outline-none tabular-nums"
                  />
                  <span className="text-[11px] text-[#71717A] font-mono">USD</span>
                </div>
              </div>
            )}

            {/* Amount */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11.5px] text-[#71717A]">Amount (Shares)</label>
                <span className="text-[10.5px] text-[#71717A]">
                  Spot Est. ${fmtPoints(numericAmount * effectivePrice)}
                </span>
              </div>
              <div className="flex items-center bg-[#F8F7F4] border border-[#EAE9E4] rounded-xl px-3.5 py-2 focus-within:border-[#18181B]">
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full bg-transparent text-[13px] font-mono font-medium text-[#18181B] focus:outline-none tabular-nums"
                />
                <span className="px-2 py-0.5 rounded bg-white border border-[#EAE9E4] text-[10.5px] font-semibold text-[#52525B] shrink-0">
                  {selectedServer.ticker}
                </span>
              </div>

              {/* Percentage quick buttons */}
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[25, 50, 75, 100].map((pct) => {
                  const buyBlocked = orderSide === 'buy' && !(serverPrice > 0);
                  const sellBlocked = orderSide === 'sell' && (selectedServer.holdings ?? 0) <= 0;
                  const blocked = buyBlocked || sellBlocked;
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handlePercentageClick(pct)}
                      title={
                        buyBlocked
                          ? 'Dormant market — no quoted price to size against'
                          : sellBlocked
                          ? 'You hold no shares to size'
                          : `Use ${pct}% of ${orderSide === 'buy' ? 'your $CRED' : 'your position'}`
                      }
                      className={`py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                        blocked
                          ? 'border-[#F0EFEA] text-[#D4D3CD] cursor-not-allowed'
                          : 'border-[#EAE9E4] hover:bg-[#F5F4F0] text-[#52525B] cursor-pointer'
                      }`}
                    >
                      {pct}%
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Total (USD) & Slippage */}
            <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-1.5 text-[11.5px]">
              <div className="flex items-center justify-between">
                <span className="text-[#71717A]">Mark Price:</span>
                <span className="font-mono font-semibold text-[#18181B] tabular-nums inline-flex items-center gap-1.5">
                  ${fmtPoints(serverPrice)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#71717A]">Spot Estimate:</span>
                <span className="font-mono font-semibold text-[#18181B] tabular-nums">
                  ${fmtPoints(numericAmount * effectivePrice)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#71717A]">Est. Slippage:</span>
                <span className="font-mono text-[#52525B]">~{estimatedSlippagePct}%</span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#F0EFEA]">
                <span className="text-[#71717A]">AMM Execution (in $CRED):</span>
                <span className="font-mono font-bold text-[#15803D] tabular-nums">
                  {liveQuote ? `${liveQuote.totalCred} $CRED` : '—'}
                </span>
              </div>
            </div>

            {/* Available Balance */}
            <div className="flex items-center justify-between text-[11.5px] pt-0.5">
              <span className="text-[#71717A]">Available Balance</span>
              <span className="font-mono font-semibold text-[#18181B] inline-flex items-center gap-1 tabular-nums">
                <span className="text-[#71717A] font-normal">$CRED</span>{' '}
                {credBalance.toLocaleString()}
                <RefreshCw className="w-3 h-3 text-[#71717A] ml-0.5" />
              </span>
            </div>

            <div className="pt-2 pb-0.5 border-t border-[#F0EFEA] flex items-center justify-between text-[11px] text-[#71717A]">
              <span>Settlement:</span>
              <span className="font-mono text-[#18181B] inline-flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                CordLedger AMM
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#141416] hover:bg-[#27272A] text-white text-[13px] font-semibold transition-colors cursor-pointer"
            >
              {orderSide === 'buy' ? 'Place Buy Order' : 'Place Sell Order'}
            </button>
          </form>
        </section>

        {/* On-Chain Transaction Confirmation Receipt Card */}
        {lastTxReceipt && (
          <section className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                <span className="text-[12.5px] font-semibold text-[#166534]">
                  {lastTxReceipt.explorerUrl ? 'On-Chain Settlement Confirmed' : 'Order Executed · Instant AMM'}
                </span>
              </div>
              {onDismissReceipt && (
                <button
                  onClick={onDismissReceipt}
                  className="text-[#166534] hover:text-[#14532D] text-[12px] font-mono cursor-pointer"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <p className="text-[11px] text-[#15803D] mb-2.5">
              Trade verified and committed to CordLedger block{' '}
              <span className="font-mono font-semibold">#{lastTxReceipt.blockNumber ?? '—'}</span>.
            </p>

            <div className="space-y-1.5 text-[11px] font-mono bg-white/80 rounded-xl p-2.5 border border-[#DCFCE7]">
              {lastTxReceipt.blockchainTxHash ? (
                <div className="flex items-center justify-between">
                  <span className="text-[#4B5563]">Ledger Hash:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-[#111827]">{shortenTxHash(lastTxReceipt.blockchainTxHash)}</span>
                    <button
                      onClick={() => {
                        if (lastTxReceipt.blockchainTxHash) {
                          navigator.clipboard.writeText(lastTxReceipt.blockchainTxHash);
                          setReceiptCopied(true);
                          setTimeout(() => setReceiptCopied(false), 2000);
                        }
                      }}
                      className="p-0.5 text-[#6B7280] hover:text-[#111827] cursor-pointer"
                      title="Copy Ledger Hash"
                    >
                      {receiptCopied ? <Check className="w-3 h-3 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-[#4B5563]">Settlement:</span>
                  <span className="font-semibold text-[#111827]">
                    CordLedger AMM Fill
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[#4B5563]">Ledger:</span>
                <span className="text-[#111827] font-sans font-medium">CordLedger (append-only)</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#4B5563]">Integrity:</span>
                <span className="text-[#059669] font-medium">SHA-256 Hash Chained</span>
              </div>
            </div>

            <button
              onClick={() => onSelectTab('CordScan')}
              className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-[11.5px] font-semibold transition-colors cursor-pointer"
            >
              <span>Inspect on CordScan Explorer</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </section>
        )}

        {/* Recent Trades Card — fixed height, infinite scroll */}
        <section className="bg-white border border-[#EAE9E4] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold text-[#18181B]">Recent Trades</h2>
            {bookStats ? (
              <span className="text-[11px] font-mono text-[#71717A]">
                {bookStats.buyVolume24hShares.toLocaleString()} bought ·{' '}
                {bookStats.sellVolume24hShares.toLocaleString()} sold (24h)
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-3 text-[11px] text-[#A1A1AA] pb-2 border-b border-[#F3F2EE]">
            <span>Price (USD)</span>
            <span className="text-center">Amount</span>
            <span className="text-right">Time</span>
          </div>

          <div
            className="max-h-[320px] overflow-y-auto divide-y divide-[#F8F7F4] mt-1 pr-1"
            onScroll={(e) => {
              const el = e.currentTarget;
              if (!tradesHasMore || tradesLoadingMore) return;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 32) {
                onLoadMoreTrades?.();
              }
            }}
          >
            {trades.length === 0 && (
              <p className="py-3 text-[11.5px] text-[#71717A]">
                No ledger executions for this ticker yet — the first trade will appear here.
              </p>
            )}
            {trades.map((tr) => {
              return (
                <div
                  key={tr.id}
                  className="grid grid-cols-3 py-2 text-[11.5px] font-mono tabular-nums items-center"
                >
                  <span
                    className={`font-medium ${
                      tr.side === 'buy' ? 'text-[#10B981]' : 'text-[#EF4444]'
                    }`}
                  >
                    ${fmtPoints(tr.price)}
                  </span>
                  <span className="text-center text-[#3F3F46]">{tr.amount.toLocaleString()}</span>
                  <span className="text-right text-[#71717A]">{tr.time}</span>
                </div>
              );
            })}

            {tradesLoadingMore && (
              <div className="flex items-center justify-center gap-1.5 py-2.5 text-[11px] text-[#71717A]">
                <span className="inline-block w-3 h-3 border-2 border-[#D4D4D8] border-t-[#18181B] rounded-full animate-spin" />
                <span>Loading earlier executions…</span>
              </div>
            )}

            {!tradesLoadingMore && !tradesHasMore && trades.length > 0 && (
              <div className="py-2.5 text-center text-[10.5px] text-[#A1A1AA]">
                End of ledger — all {trades.length} executed orders shown
              </div>
            )}
          </div>
        </section>

        {/* My Position Card */}
        <section className="bg-white border border-[#EAE9E4] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-[14px] font-semibold text-[#18181B]">My Position</h2>
            <button
              onClick={() => onSelectTab('Portfolio')}
              className="text-[11.5px] text-[#71717A] hover:text-[#18181B] inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-[#71717A]">Holdings</p>
              <p className="text-[14.5px] font-bold text-[#18181B] tabular-nums mt-0.5">
                {holdingsCount > 0 ? holdingsCount.toLocaleString() : '0 (no open position)'}{' '}
                {holdingsCount > 0 ? <span className="font-normal text-[#52525B]">{selectedServer.ticker}</span> : null}
              </p>
            </div>

            {holdingsCount > 0 ? (
              <>
                <div>
                  <p className="text-[11px] text-[#71717A]">Avg. Price</p>
                  <p className="text-[14.5px] font-bold text-[#18181B] tabular-nums mt-0.5">
                    ${fmtPoints(avgPrice)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-[#71717A]">Current Value</p>
                  <p className="text-[14.5px] font-bold text-[#18181B] tabular-nums mt-0.5">
                    ${fmtPoints(positionValue)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-[#71717A]">P&L</p>
                  <p
                    className={`text-[14.5px] font-bold inline-flex items-center gap-1 tabular-nums mt-0.5 ${
                      pnlUp ? 'text-[#10B981]' : pnlDown ? 'text-[#EF4444]' : 'text-[#A1A1AA]'
                    }`}
                  >
                    {pnlUp ? <ArrowUpRight className="w-4 h-4" /> : pnlDown ? <ArrowDownRight className="w-4 h-4" /> : null}
                    {pnlUp ? '+' : ''}
                    {pnlPct}%
                  </p>
                </div>
              </>
            ) : (
              <div className="text-[11.5px] text-[#71717A] leading-[1.5]">
                You don't hold any {selectedServer.ticker} shares. Jump into the buy ticket to open a position — values
                here stay zero until you own shares.
              </div>
            )}
          </div>
        </section>

        {/* Sponsored Native View */}
        <GoogleAdView format="card" label="Featured Partner" />
      </aside>

      {/* Tokenize Discord Server Modal */}
      <TokenizeServerModal
        isOpen={isTokenizeModalOpen}
        onClose={() => setIsTokenizeModalOpen(false)}
        existingServers={allServers}
        onTokenize={(newServer) => {
          onCreateServer?.(newServer);
          onSelectServer(newServer.id);
        }}
        discordGuilds={discordGuilds}
        onConnectDiscord={onConnectDiscord}
        isLoggedIn={isLoggedIn}
      />
    </div>
  );
};
