import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  TrendingUp,
  SlidersHorizontal,
  Ruler,
  Layers,
  BarChart2,
  Activity,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  ExternalLink,
  Users,
  MessageSquare,
  Zap,
  Radio,
  Trophy,
  CheckCircle2,
  Clock,
  Minus,
  Maximize2,
  Minimize2,
  Lightbulb,
  Check,
} from 'lucide-react';
import { CandlePoint, ServerAsset, OrderBookRow, TradeRecord } from '../types';
import { ChartTimeframe } from '../lib/api';
import { getProjectResearch } from '../data/projectResearch';
import { shortenAddress, getCordScanTokenUrl } from '../lib/blockchain';
import { calculateCommunityAdvantage, generateServerMemberStats } from '../lib/advantageEngine';
import { fmtPoints } from '../lib/formatters';

export interface CandlestickChartProps {
  server: ServerAsset;
  candles: CandlePoint[];
  asks?: OrderBookRow[];
  bids?: OrderBookRow[];
  trades?: TradeRecord[];
  activeTimeframe?: ChartTimeframe;
  onChangeTimeframe?: (tf: ChartTimeframe) => void;
  onSelectPrice?: (price: number) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  feedLabel?: string;
}

interface DrawnLine {
  id: string;
  type: 'trend' | 'horizontal';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  price1: number;
  price2?: number;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  server,
  candles,
  asks = [],
  bids = [],
  trades = [],
  activeTimeframe = '1h',
  onChangeTimeframe,
  onSelectPrice,
  isExpanded = false,
  onToggleExpand,
  feedLabel,
}) => {
  const [activeTab, setActiveTab] = useState<'Chart' | 'Order Book' | 'Trades' | 'Community & Alpha' | 'Project Research'>('Chart');
  const [chartType, setChartType] = useState<'candles' | 'hollow' | 'line' | 'area' | 'heikin'>('candles');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [activeTool, setActiveTool] = useState<'crosshair' | 'trend' | 'horizontal' | 'measure'>('crosshair');
  const [drawingStart, setDrawingStart] = useState<{ x: number; y: number; price: number } | null>(null);
  const [drawnLines, setDrawnLines] = useState<DrawnLine[]>([]);
  const [communityRosterTab, setCommunityRosterTab] = useState<'cordchain' | 'discord'>('cordchain');

  const memberStats = useMemo(() => {
    if (server.memberStats) return server.memberStats;
    const num = parseInt(server.members.replace(/[^0-9]/g, '')) || 8500;
    return generateServerMemberStats(server.id, num);
  }, [server]);

  const advantage = useMemo(() => {
    return calculateCommunityAdvantage(
      memberStats.cordchainAffiliatedMembers,
      memberStats.activeDailyMembers,
      memberStats.onlineMembers,
      memberStats.totalMembers
    );
  }, [memberStats]);

  // Responsive Chart Canvas measurement
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(850);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        if (w > 0) setContainerWidth(Math.round(w));
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Indicators toggle state
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(false);
  const [showEMA9, setShowEMA9] = useState(false);
  const [showEMA21, setShowEMA21] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showVWAP, setShowVWAP] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showRSI, setShowRSI] = useState(false);

  const activeIndicatorsCount = [
    showSMA20,
    showSMA50,
    showEMA9,
    showEMA21,
    showBollinger,
    showVWAP,
    showVolume,
    showRSI,
  ].filter(Boolean).length;

  const research = useMemo(() => getProjectResearch(server.ticker), [server.ticker]);

  // Handle Heikin-Ashi transform if selected
  const displayCandles = useMemo(() => {
    if (chartType !== 'heikin') return candles;
    const ha: CandlePoint[] = [];
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      if (i === 0) {
        ha.push({ ...c });
      } else {
        const prevHa = ha[i - 1];
        const haClose = (c.open + c.high + c.low + c.close) / 4;
        const haOpen = (prevHa.open + prevHa.close) / 2;
        const haHigh = Math.max(c.high, haOpen, haClose);
        const haLow = Math.min(c.low, haOpen, haClose);
        ha.push({
          ...c,
          open: +haOpen.toFixed(2),
          high: +haHigh.toFixed(2),
          low: +haLow.toFixed(2),
          close: +haClose.toFixed(2),
        });
      }
    }
    return ha;
  }, [candles, chartType]);

  // Dynamic Price Range from candle data
  const { minPrice, maxPrice, priceSpan } = useMemo(() => {
    if (!displayCandles.length) return { minPrice: 1, maxPrice: 100, priceSpan: 99 };
    const lows = displayCandles.map((c) => c.low);
    const highs = displayCandles.map((c) => c.high);
    const minVal = Math.min(...lows);
    const maxVal = Math.max(...highs);
    const pad = Math.max((maxVal - minVal) * 0.1, maxVal * 0.02, 1);
    const minP = Math.max(0.01, minVal - pad);
    const maxP = maxVal + pad;
    return { minPrice: minP, maxPrice: maxP, priceSpan: Math.max(0.01, maxP - minP) };
  }, [displayCandles]);

  // Dynamic Canvas layout dimensions matching container width exactly
  const svgWidth = Math.max(600, containerWidth);
  const baseHeight = isExpanded ? 460 : 330;
  const rsiHeight = showRSI ? 80 : 0;
  const svgHeight = baseHeight + rsiHeight;
  const leftPad = 14;
  const rightPad = 80;
  const topPad = 22;
  const bottomPad = 26 + rsiHeight;
  const plotWidth = svgWidth - leftPad - rightPad;
  const plotHeight = svgHeight - topPad - bottomPad;
  const volBarMaxHeight = 65;

  const priceToY = (price: number) => {
    return topPad + ((maxPrice - price) / priceSpan) * plotHeight;
  };

  const yToPrice = (y: number) => {
    return +(maxPrice - ((y - topPad) / plotHeight) * priceSpan);
  };

  // Technical Indicators series calculations
  const sma20 = useMemo(() => {
    return displayCandles.map((_, i) => {
      const slice = displayCandles.slice(Math.max(0, i - 19), i + 1);
      return slice.reduce((acc, c) => acc + c.close, 0) / slice.length;
    });
  }, [displayCandles]);

  const sma50 = useMemo(() => {
    return displayCandles.map((_, i) => {
      const slice = displayCandles.slice(Math.max(0, i - 49), i + 1);
      return slice.reduce((acc, c) => acc + c.close, 0) / slice.length;
    });
  }, [displayCandles]);

  const ema9 = useMemo(() => {
    const k = 2 / (9 + 1);
    const res: number[] = [];
    displayCandles.forEach((c, i) => {
      if (i === 0) res.push(c.close);
      else res.push(c.close * k + res[i - 1] * (1 - k));
    });
    return res;
  }, [displayCandles]);

  const ema21 = useMemo(() => {
    const k = 2 / (21 + 1);
    const res: number[] = [];
    displayCandles.forEach((c, i) => {
      if (i === 0) res.push(c.close);
      else res.push(c.close * k + res[i - 1] * (1 - k));
    });
    return res;
  }, [displayCandles]);

  const bollingerBands = useMemo(() => {
    return displayCandles.map((_, i) => {
      const slice = displayCandles.slice(Math.max(0, i - 19), i + 1);
      const mean = slice.reduce((acc, c) => acc + c.close, 0) / slice.length;
      const variance = slice.reduce((acc, c) => acc + Math.pow(c.close - mean, 2), 0) / slice.length;
      const std = Math.sqrt(variance);
      return { upper: mean + 2 * std, middle: mean, lower: mean - 2 * std };
    });
  }, [displayCandles]);

  const vwap = useMemo(() => {
    let cumVol = 0;
    let cumTypVol = 0;
    return displayCandles.map((c) => {
      const typ = (c.high + c.low + c.close) / 3;
      cumVol += c.volume;
      cumTypVol += typ * c.volume;
      return cumVol > 0 ? cumTypVol / cumVol : c.close;
    });
  }, [displayCandles]);

  // RSI 14 calculation
  const rsi14 = useMemo(() => {
    if (!showRSI) return [];
    const values: number[] = [];
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < displayCandles.length; i++) {
      if (i === 0) {
        values.push(50);
        continue;
      }
      const change = displayCandles[i].close - displayCandles[i - 1].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;
      if (i <= 14) {
        avgGain = (avgGain * (i - 1) + gain) / i;
        avgLoss = (avgLoss * (i - 1) + loss) / i;
      } else {
        avgGain = (avgGain * 13 + gain) / 14;
        avgLoss = (avgLoss * 13 + loss) / 14;
      }
      if (avgLoss === 0) values.push(100);
      else {
        const rs = avgGain / avgLoss;
        values.push(+(100 - 100 / (1 + rs)).toFixed(1));
      }
    }
    return values;
  }, [displayCandles, showRSI]);

  // Y-axis Price Ticks (clean step intervals)
  const yTicks = useMemo(() => {
    const count = 5;
    const step = priceSpan / count;
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) {
      ticks.push(minPrice + i * step);
    }
    return ticks;
  }, [minPrice, priceSpan]);

  const candleSpacing = plotWidth / Math.max(1, displayCandles.length);
  const candleWidth = Math.max(2.8, candleSpacing * 0.58);
  const maxVol = Math.max(...displayCandles.map((c) => c.volume), 1);

  const activeCandle = hoveredIdx !== null && displayCandles[hoveredIdx]
    ? displayCandles[hoveredIdx]
    : displayCandles[displayCandles.length - 1] || { open: server.priceUsd, high: server.priceUsd, low: server.priceUsd, close: server.priceUsd, volume: 100, time: '' };

  const lastClose = displayCandles.length ? displayCandles[displayCandles.length - 1].close : server.priceUsd;
  const lastCloseY = priceToY(lastClose);

  const candleChangeVal = activeCandle.close - activeCandle.open;
  const candleChangePct = activeCandle.open > 0 ? ((candleChangeVal / activeCandle.open) * 100) : 0;

  // Chart Click / Drawing Handler
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * svgWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * svgHeight;
    const clickedPrice = yToPrice(clickY);

    onSelectPrice?.(clickedPrice);

    if (activeTool === 'horizontal') {
      const newLine: DrawnLine = {
        id: `h-${Date.now()}`,
        type: 'horizontal',
        x1: leftPad,
        y1: clickY,
        x2: svgWidth - rightPad,
        y2: clickY,
        price1: clickedPrice,
      };
      setDrawnLines((prev) => [...prev, newLine]);
      setActiveTool('crosshair');
    } else if (activeTool === 'trend') {
      if (!drawingStart) {
        setDrawingStart({ x: clickX, y: clickY, price: clickedPrice });
      } else {
        const newLine: DrawnLine = {
          id: `t-${Date.now()}`,
          type: 'trend',
          x1: drawingStart.x,
          y1: drawingStart.y,
          x2: clickX,
          y2: clickY,
          price1: drawingStart.price,
          price2: clickedPrice,
        };
        setDrawnLines((prev) => [...prev, newLine]);
        setDrawingStart(null);
        setActiveTool('crosshair');
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * svgWidth;
    const y = ((e.clientY - rect.top) / rect.height) * svgHeight;
    setMousePos({ x, y });

    const idx = Math.floor((x - leftPad) / candleSpacing);
    if (idx >= 0 && idx < displayCandles.length) {
      setHoveredIdx(idx);
    } else {
      setHoveredIdx(null);
    }
  };

  return (
    <div className="bg-white border border-[#EAE9E4] rounded-2xl p-4 flex flex-col justify-between select-none">
      {/* TOP HEADER TABS */}
      <div>
        <div className="flex items-center justify-between border-b border-[#EAE9E4] px-1 pb-2">
          <div className="flex items-center gap-6">
            {(['Chart', 'Order Book', 'Trades', 'Community & Alpha', 'Project Research'] as const).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-1 text-[13px] font-medium relative transition-colors cursor-pointer ${
                    isActive ? 'text-[#18181B] font-semibold' : 'text-[#71717A] hover:text-[#18181B]'
                  }`}
                >
                  {tab}
                  {isActive && (
                    <span className="absolute -bottom-2 left-0 right-0 h-[2px] bg-[#18181B] rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold ${
                feedLabel === 'Live Feed' || !feedLabel
                  ? 'bg-[#F2F9F5] text-[#15803D]'
                  : feedLabel === 'Syncing ledger…' || feedLabel === 'Ledger stale — retrying…'
                    ? 'bg-[#FEFCE8] text-[#A16207]'
                    : 'bg-[#F4F4F5] text-[#71717A]'
              }`}
            >
              {feedLabel || 'Live Feed'}
            </span>
          </div>
        </div>

        {/* TOOLBAR (Visible on Chart tab) */}
        {activeTab === 'Chart' && (
          <div className="flex flex-wrap items-center justify-between py-2 px-1 border-b border-[#F3F2EE] gap-2">
            {/* Left Controls: Timeframes + Chart Types + Indicators */}
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {/* Timeframe Buttons */}
              <div className="flex items-center bg-[#F5F4F0] p-0.5 rounded-lg shrink-0">
                {(['1m', '5m', '15m', '1h', '4h', '1D', '1W'] as ChartTimeframe[]).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => onChangeTimeframe?.(tf)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      activeTimeframe === tf
                        ? 'bg-white text-[#18181B] font-semibold shadow-xs'
                        : 'text-[#71717A] hover:text-[#18181B]'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              <span className="h-4 w-[1px] bg-[#EAE9E4] shrink-0 mx-0.5" />

              {/* Chart Type Selector */}
              <div className="flex items-center bg-[#F5F4F0] p-0.5 rounded-lg shrink-0">
                <button
                  onClick={() => setChartType('candles')}
                  title="Solid Candlesticks"
                  className={`p-1 rounded text-[11px] transition-colors cursor-pointer ${
                    chartType === 'candles' ? 'bg-white shadow-xs text-[#18181B]' : 'text-[#71717A] hover:text-[#18181B]'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setChartType('hollow')}
                  title="Hollow Candlesticks"
                  className={`p-1 rounded text-[11px] transition-colors cursor-pointer ${
                    chartType === 'hollow' ? 'bg-white shadow-xs text-[#18181B]' : 'text-[#71717A] hover:text-[#18181B]'
                  }`}
                >
                  <div className="w-3.5 h-3.5 border border-current rounded-xs" />
                </button>
                <button
                  onClick={() => setChartType('line')}
                  title="Line Chart"
                  className={`p-1 rounded text-[11px] transition-colors cursor-pointer ${
                    chartType === 'line' ? 'bg-white shadow-xs text-[#18181B]' : 'text-[#71717A] hover:text-[#18181B]'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setChartType('area')}
                  title="Mountain / Area Chart"
                  className={`p-1 rounded text-[11px] transition-colors cursor-pointer ${
                    chartType === 'area' ? 'bg-white shadow-xs text-[#18181B]' : 'text-[#71717A] hover:text-[#18181B]'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setChartType('heikin')}
                  title="Heikin-Ashi Trend Candles"
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer whitespace-nowrap ${
                    chartType === 'heikin' ? 'bg-white shadow-xs text-[#18181B] font-bold' : 'text-[#71717A] hover:text-[#18181B]'
                  }`}
                >
                  HA
                </button>
              </div>

              <span className="h-4 w-[1px] bg-[#EAE9E4] shrink-0 mx-0.5" />

              {/* Technical Indicators Dropdown */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setIndicatorsOpen(!indicatorsOpen)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    indicatorsOpen || activeIndicatorsCount > 0
                      ? 'bg-[#EFECE6] text-[#18181B] font-semibold'
                      : 'text-[#52525B] hover:text-[#18181B] hover:bg-[#F7F6F3]'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Indicators</span>
                  {activeIndicatorsCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-[#18181B] text-white text-[9px] font-mono flex items-center justify-center">
                      {activeIndicatorsCount}
                    </span>
                  )}
                </button>

                {indicatorsOpen && (
                  <div className="absolute left-0 mt-2 w-56 bg-white border border-[#EAE9E4] rounded-xl shadow-xl p-3 z-50 text-[11.5px] space-y-2">
                    <p className="font-semibold text-[#18181B] pb-1.5 border-b border-[#F0EFEA]">
                      Technical Indicators
                    </p>
                    <label className="flex items-center justify-between cursor-pointer hover:bg-[#F8F7F4] p-1 rounded">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                        <span>SMA (20)</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={showSMA20}
                        onChange={(e) => setShowSMA20(e.target.checked)}
                        className="rounded"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer hover:bg-[#F8F7F4] p-1 rounded">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                        <span>SMA (50)</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={showSMA50}
                        onChange={(e) => setShowSMA50(e.target.checked)}
                        className="rounded"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer hover:bg-[#F8F7F4] p-1 rounded">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#06B6D4]" />
                        <span>EMA (9)</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={showEMA9}
                        onChange={(e) => setShowEMA9(e.target.checked)}
                        className="rounded"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer hover:bg-[#F8F7F4] p-1 rounded">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#EC4899]" />
                        <span>EMA (21)</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={showEMA21}
                        onChange={(e) => setShowEMA21(e.target.checked)}
                        className="rounded"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer hover:bg-[#F8F7F4] p-1 rounded">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                        <span>Bollinger Bands (20,2)</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={showBollinger}
                        onChange={(e) => setShowBollinger(e.target.checked)}
                        className="rounded"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer hover:bg-[#F8F7F4] p-1 rounded">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#EAB308]" />
                        <span>VWAP</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={showVWAP}
                        onChange={(e) => setShowVWAP(e.target.checked)}
                        className="rounded"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer hover:bg-[#F8F7F4] p-1 rounded">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                        <span>Volume Sub-Chart</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={showVolume}
                        onChange={(e) => setShowVolume(e.target.checked)}
                        className="rounded"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer hover:bg-[#F8F7F4] p-1 rounded">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#6366F1]" />
                        <span>RSI (14) Oscillator</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={showRSI}
                        onChange={(e) => setShowRSI(e.target.checked)}
                        className="rounded"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Right Controls: Drawing Tools + Expand Toggle */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-0.5 bg-[#F5F4F0] p-0.5 rounded-lg text-[11px]">
                <button
                  onClick={() => {
                    setActiveTool('crosshair');
                    setDrawingStart(null);
                  }}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer whitespace-nowrap ${
                    activeTool === 'crosshair' ? 'bg-white shadow-xs text-[#18181B]' : 'text-[#71717A]'
                  }`}
                  title="Crosshair tool"
                >
                  Crosshair
                </button>
                <button
                  onClick={() => {
                    setActiveTool('trend');
                    setDrawingStart(null);
                  }}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer whitespace-nowrap ${
                    activeTool === 'trend' ? 'bg-white shadow-xs text-[#18181B]' : 'text-[#71717A]'
                  }`}
                  title="Click two points to draw trend line"
                >
                  Trendline
                </button>
                <button
                  onClick={() => {
                    setActiveTool('horizontal');
                    setDrawingStart(null);
                  }}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer whitespace-nowrap ${
                    activeTool === 'horizontal' ? 'bg-white shadow-xs text-[#18181B]' : 'text-[#71717A]'
                  }`}
                  title="Click to place horizontal price line"
                >
                  H-Level
                </button>
                {drawnLines.length > 0 && (
                  <button
                    onClick={() => setDrawnLines([])}
                    className="p-1 text-[#EF4444] hover:bg-white rounded cursor-pointer"
                    title="Clear all drawings"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {onToggleExpand && (
                <button
                  onClick={onToggleExpand}
                  className={`p-1 rounded-lg border transition-colors cursor-pointer ${
                    isExpanded
                      ? 'bg-[#18181B] text-white border-[#18181B]'
                      : 'bg-[#F5F4F0] hover:bg-[#EFECE6] border-transparent text-[#52525B] hover:text-[#18181B]'
                  }`}
                  title={isExpanded ? 'Restore Layout' : 'Expand Chart to Full Width'}
                >
                  {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ADVANCED CHART VIEW */}
      {/* ======================================================== */}
      {activeTab === 'Chart' && (
        <div className="relative pt-2">
          {/* Real-time OHLCV Bar Readout */}
          <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-wrap items-center gap-3 bg-white/85 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-[#EAE9E4]">
            <span className="font-semibold text-[#18181B] text-[12px]">{server.ticker}</span>
            <span className="text-[11px] font-mono text-[#71717A] tabular-nums">
              O <span className="text-[#18181B] font-semibold">{fmtPoints(activeCandle.open)}</span>
            </span>
            <span className="text-[11px] font-mono text-[#71717A] tabular-nums">
              H <span className="text-[#10B981] font-semibold">{fmtPoints(activeCandle.high)}</span>
            </span>
            <span className="text-[11px] font-mono text-[#71717A] tabular-nums">
              L <span className="text-[#EF4444] font-semibold">{fmtPoints(activeCandle.low)}</span>
            </span>
            <span className="text-[11px] font-mono text-[#71717A] tabular-nums">
              C <span className="text-[#18181B] font-semibold">{fmtPoints(activeCandle.close)}</span>
            </span>
            <span
              className={`text-[11px] font-mono font-semibold tabular-nums ${
                candleChangeVal >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
              }`}
            >
              {candleChangeVal >= 0 ? '+' : ''}
              {fmtPoints(candleChangeVal)} ({candleChangePct >= 0 ? '+' : ''}
              {candleChangePct.toFixed(2)}%)
            </span>
            <span className="text-[10px] text-[#A1A1AA] font-mono">Vol: {activeCandle.volume.toLocaleString()}</span>
          </div>

          {/* MAIN INTERACTIVE SVG CHART */}
          <div ref={containerRef} className="w-full relative overflow-hidden">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className={`w-full cursor-crosshair overflow-visible select-none transition-all duration-200 ${
                isExpanded ? 'h-[460px]' : 'h-[330px]'
              }`}
              onClick={handleSvgClick}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => {
                setHoveredIdx(null);
                setMousePos(null);
              }}
            >
              <defs>
                <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines & Price Ticks */}
              {yTicks.map((tick) => {
                const y = priceToY(tick);
                return (
                  <g key={tick}>
                    <line x1={leftPad} y1={y} x2={svgWidth - rightPad} y2={y} stroke="#F2F1ED" strokeWidth="1" strokeDasharray="3 3" />
                    <text x={svgWidth - rightPad + 6} y={y + 3.5} className="fill-[#A1A1AA] text-[9.5px] font-mono tabular-nums">
                      ${fmtPoints(tick)}
                    </text>
                  </g>
                );
              })}

              {/* Vertical Date/Time Gridlines (Evenly Spaced, No Overlap) */}
              {displayCandles.map((c, i) => {
                if (!c.dateLabel) return null;
                const step = Math.max(5, Math.floor(displayCandles.length / 5));
                if (i % step !== 0 && i !== displayCandles.length - 1) return null;
                const x = leftPad + i * candleSpacing + candleSpacing / 2;
                return (
                  <g key={`v-${c.time}-${i}`}>
                    <line x1={x} y1={topPad} x2={x} y2={topPad + plotHeight} stroke="#F5F4F0" strokeWidth="1" />
                    <text x={x} y={topPad + plotHeight + 14} textAnchor="middle" className="fill-[#A1A1AA] text-[9px] font-sans">
                      {c.dateLabel}
                    </text>
                  </g>
                );
              })}

              {/* BOLLINGER BANDS (20, 2) */}
              {showBollinger && (
                <>
                  <path
                    d={bollingerBands
                      .map((b, i) => {
                        const x = leftPad + i * candleSpacing + candleSpacing / 2;
                        const y = priceToY(b.upper);
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .concat(
                        bollingerBands
                          .slice()
                          .reverse()
                          .map((b, i) => {
                            const revIdx = bollingerBands.length - 1 - i;
                            const x = leftPad + revIdx * candleSpacing + candleSpacing / 2;
                            const y = priceToY(b.lower);
                            return `L ${x} ${y}`;
                          })
                      )
                      .join(' ') + ' Z'}
                    fill="rgba(59, 130, 246, 0.08)"
                  />
                  <path
                    d={bollingerBands.map((b, i) => `${i === 0 ? 'M' : 'L'} ${leftPad + i * candleSpacing + candleSpacing / 2} ${priceToY(b.upper)}`).join(' ')}
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <path
                    d={bollingerBands.map((b, i) => `${i === 0 ? 'M' : 'L'} ${leftPad + i * candleSpacing + candleSpacing / 2} ${priceToY(b.lower)}`).join(' ')}
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                </>
              )}

              {/* TECHNICAL INDICATORS */}
              {showSMA20 && (
                <path
                  d={sma20.map((v, i) => `${i === 0 ? 'M' : 'L'} ${leftPad + i * candleSpacing + candleSpacing / 2} ${priceToY(v)}`).join(' ')}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                />
              )}
              {showSMA50 && (
                <path
                  d={sma50.map((v, i) => `${i === 0 ? 'M' : 'L'} ${leftPad + i * candleSpacing + candleSpacing / 2} ${priceToY(v)}`).join(' ')}
                  fill="none"
                  stroke="#8B5CF6"
                  strokeWidth="1.5"
                />
              )}
              {showEMA9 && (
                <path
                  d={ema9.map((v, i) => `${i === 0 ? 'M' : 'L'} ${leftPad + i * candleSpacing + candleSpacing / 2} ${priceToY(v)}`).join(' ')}
                  fill="none"
                  stroke="#06B6D4"
                  strokeWidth="1.5"
                />
              )}
              {showEMA21 && (
                <path
                  d={ema21.map((v, i) => `${i === 0 ? 'M' : 'L'} ${leftPad + i * candleSpacing + candleSpacing / 2} ${priceToY(v)}`).join(' ')}
                  fill="none"
                  stroke="#EC4899"
                  strokeWidth="1.5"
                />
              )}
              {showVWAP && (
                <path
                  d={vwap.map((v, i) => `${i === 0 ? 'M' : 'L'} ${leftPad + i * candleSpacing + candleSpacing / 2} ${priceToY(v)}`).join(' ')}
                  fill="none"
                  stroke="#EAB308"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
              )}

              {/* CANDLESTICKS / PLOT RENDERING */}
              {chartType === 'line' && (
                <path
                  d={displayCandles.map((c, i) => `${i === 0 ? 'M' : 'L'} ${leftPad + i * candleSpacing + candleSpacing / 2} ${priceToY(c.close)}`).join(' ')}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2"
                />
              )}

              {chartType === 'area' && (
                <>
                  <path
                    d={
                      displayCandles.map((c, i) => `${i === 0 ? 'M' : 'L'} ${leftPad + i * candleSpacing + candleSpacing / 2} ${priceToY(c.close)}`).join(' ') +
                      ` L ${leftPad + (displayCandles.length - 1) * candleSpacing + candleSpacing / 2} ${topPad + plotHeight}` +
                      ` L ${leftPad + candleSpacing / 2} ${topPad + plotHeight} Z`
                    }
                    fill="url(#chartAreaGrad)"
                  />
                  <path
                    d={displayCandles.map((c, i) => `${i === 0 ? 'M' : 'L'} ${leftPad + i * candleSpacing + candleSpacing / 2} ${priceToY(c.close)}`).join(' ')}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2"
                  />
                </>
              )}

              {(chartType === 'candles' || chartType === 'hollow' || chartType === 'heikin') &&
                displayCandles.map((c, i) => {
                  const xCenter = leftPad + i * candleSpacing + candleSpacing / 2;
                  const isBull = c.close >= c.open;
                  const color = isBull ? '#10B981' : '#EF4444';

                  const highY = priceToY(c.high);
                  const lowY = priceToY(c.low);
                  const bodyTop = priceToY(Math.max(c.open, c.close));
                  const bodyBottom = priceToY(Math.min(c.open, c.close));
                  const bodyHeight = Math.max(1.8, bodyBottom - bodyTop);

                  return (
                    <g key={`c-${i}`}>
                      <line x1={xCenter} y1={highY} x2={xCenter} y2={lowY} stroke={color} strokeWidth="1.2" />
                      {chartType === 'hollow' && isBull ? (
                        <rect
                          x={xCenter - candleWidth / 2}
                          y={bodyTop}
                          width={candleWidth}
                          height={bodyHeight}
                          fill="white"
                          stroke={color}
                          strokeWidth="1.2"
                          rx="0.5"
                        />
                      ) : (
                        <rect
                          x={xCenter - candleWidth / 2}
                          y={bodyTop}
                          width={candleWidth}
                          height={bodyHeight}
                          fill={color}
                          rx="0.5"
                        />
                      )}
                    </g>
                  );
                })}

              {/* VOLUME BARS SUB-CHART */}
              {showVolume &&
                displayCandles.map((c, i) => {
                  const xCenter = leftPad + i * candleSpacing + candleSpacing / 2;
                  const isBull = c.close >= c.open;
                  const volH = (c.volume / maxVol) * volBarMaxHeight;
                  const volY = topPad + plotHeight - volH;
                  return (
                    <rect
                      key={`vol-${i}`}
                      x={xCenter - candleWidth / 2}
                      y={volY}
                      width={candleWidth}
                      height={volH}
                      fill={isBull ? 'rgba(16, 185, 129, 0.22)' : 'rgba(239, 68, 68, 0.22)'}
                      rx="0.4"
                    />
                  );
                })}

              {/* RSI (14) SUB-PANEL */}
              {showRSI && (
                <g transform={`translate(0, ${topPad + plotHeight + 18})`}>
                  <rect x={leftPad} y={0} width={plotWidth} height={rsiHeight - 8} fill="#FAF9F6" stroke="#EAE9E4" strokeWidth="0.8" rx="4" />
                  {/* 70 Overbought */}
                  <line x1={leftPad} y1={(1 - 70 / 100) * (rsiHeight - 8)} x2={leftPad + plotWidth} y2={(1 - 70 / 100) * (rsiHeight - 8)} stroke="#EF4444" strokeWidth="0.8" strokeDasharray="3 3" />
                  <text x={svgWidth - rightPad + 6} y={(1 - 70 / 100) * (rsiHeight - 8) + 3} className="fill-[#EF4444] text-[8.5px] font-mono">
                    70
                  </text>
                  {/* 30 Oversold */}
                  <line x1={leftPad} y1={(1 - 30 / 100) * (rsiHeight - 8)} x2={leftPad + plotWidth} y2={(1 - 30 / 100) * (rsiHeight - 8)} stroke="#10B981" strokeWidth="0.8" strokeDasharray="3 3" />
                  <text x={svgWidth - rightPad + 6} y={(1 - 30 / 100) * (rsiHeight - 8) + 3} className="fill-[#10B981] text-[8.5px] font-mono">
                    30
                  </text>
                  {/* RSI Curve */}
                  <path
                    d={rsi14
                      .map((val, i) => {
                        const x = leftPad + i * candleSpacing + candleSpacing / 2;
                        const y = (1 - val / 100) * (rsiHeight - 8);
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#6366F1"
                    strokeWidth="1.5"
                  />
                  <text x={leftPad + 8} y={12} className="fill-[#6366F1] text-[9.5px] font-mono font-semibold">
                    RSI (14): {rsi14[hoveredIdx ?? rsi14.length - 1] ?? 50}
                  </text>
                </g>
              )}

              {/* USER DRAWN ANNOTATIONS */}
              {drawnLines.map((line) => {
                if (line.type === 'horizontal') {
                  const y = priceToY(line.price1);
                  return (
                    <g key={line.id}>
                      <line x1={leftPad} y1={y} x2={svgWidth - rightPad} y2={y} stroke="#3B82F6" strokeWidth="1.4" strokeDasharray="4 3" />
                      <g transform={`translate(${svgWidth - rightPad + 2}, ${y - 8})`}>
                        <rect width="56" height="16" rx="3" fill="#3B82F6" />
                        <text x="28" y="11.5" textAnchor="middle" className="fill-white text-[9px] font-mono font-semibold">
                          ${fmtPoints(line.price1)}
                        </text>
                      </g>
                    </g>
                  );
                }
                return (
                  <g key={line.id}>
                    <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="#8B5CF6" strokeWidth="1.8" />
                    <circle cx={line.x1} cy={line.y1} r="3" fill="#8B5CF6" />
                    <circle cx={line.x2} cy={line.y2} r="3" fill="#8B5CF6" />
                  </g>
                );
              })}

              {/* Active drawing preview line */}
              {activeTool === 'trend' && drawingStart && mousePos && (
                <line x1={drawingStart.x} y1={drawingStart.y} x2={mousePos.x} y2={mousePos.y} stroke="#8B5CF6" strokeWidth="1.5" strokeDasharray="3 3" />
              )}

              {/* LAST PRICE DASHED LINE & PILL */}
              <line x1={leftPad} y1={lastCloseY} x2={svgWidth - rightPad} y2={lastCloseY} stroke="#10B981" strokeWidth="1" strokeDasharray="3 3" />
              <g transform={`translate(${svgWidth - rightPad + 2}, ${lastCloseY - 9})`}>
                <rect width="56" height="18" rx="4" fill="#10B981" />
                <text x="28" y="12.5" textAnchor="middle" className="fill-white text-[9.5px] font-mono font-bold tabular-nums">
                  ${fmtPoints(lastClose)}
                </text>
              </g>

              {/* CROSSHAIR CURSOR RETICLE */}
              {mousePos && mousePos.x >= leftPad && mousePos.x <= svgWidth - rightPad && mousePos.y >= topPad && mousePos.y <= topPad + plotHeight && (
                <>
                  <line x1={mousePos.x} y1={topPad} x2={mousePos.x} y2={topPad + plotHeight} stroke="#A1A1AA" strokeWidth="0.8" strokeDasharray="3 3" />
                  <line x1={leftPad} y1={mousePos.y} x2={svgWidth - rightPad} y2={mousePos.y} stroke="#A1A1AA" strokeWidth="0.8" strokeDasharray="3 3" />
                  {/* Floating Price Pill */}
                  <g transform={`translate(${svgWidth - rightPad + 2}, ${mousePos.y - 8})`}>
                    <rect width="56" height="16" rx="3" fill="#27272A" />
                    <text x="28" y="11.5" textAnchor="middle" className="fill-white text-[9px] font-mono font-medium">
                      ${fmtPoints(yToPrice(mousePos.y))}
                    </text>
                  </g>
                </>
              )}
            </svg>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: ORDER BOOK & DEPTH VIEW */}
      {/* ======================================================== */}
      {activeTab === 'Order Book' && (
        <div className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Asks (Sell Orders) */}
            <div className="bg-[#FAF9F6] border border-[#EAE9E4] rounded-xl p-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-[#EAE9E4]">
                <span className="text-[12px] font-semibold text-[#EF4444]">Asks (Sell Depth)</span>
                <span className="text-[11px] text-[#71717A] font-mono">{asks.length} Orders</span>
              </div>
              <div className="divide-y divide-[#F0EFEA] text-[12px] font-mono mt-1">
                {asks.map((ask, i) => (
                  <div
                    key={i}
                    onClick={() => onSelectPrice?.(ask.price)}
                    className="py-2 flex items-center justify-between hover:bg-[#F0ECE1] px-1.5 rounded cursor-pointer transition-colors"
                  >
                    <span className="text-[#EF4444] font-semibold">${fmtPoints(ask.price)}</span>
                    <span className="text-[#3F3F46]">{ask.amount.toLocaleString()}</span>
                    <span className="text-[#71717A]">{ask.total}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bids (Buy Orders) */}
            <div className="bg-[#FAF9F6] border border-[#EAE9E4] rounded-xl p-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-[#EAE9E4]">
                <span className="text-[12px] font-semibold text-[#10B981]">Bids (Buy Depth)</span>
                <span className="text-[11px] text-[#71717A] font-mono">{bids.length} Orders</span>
              </div>
              <div className="divide-y divide-[#F0EFEA] text-[12px] font-mono mt-1">
                {bids.map((bid, i) => (
                  <div
                    key={i}
                    onClick={() => onSelectPrice?.(bid.price)}
                    className="py-2 flex items-center justify-between hover:bg-[#F0ECE1] px-1.5 rounded cursor-pointer transition-colors"
                  >
                    <span className="text-[#10B981] font-semibold">${fmtPoints(bid.price)}</span>
                    <span className="text-[#3F3F46]">{bid.amount.toLocaleString()}</span>
                    <span className="text-[#71717A]">{bid.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[11.5px] text-[#71717A] text-center flex items-center justify-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Click any row to automatically set that price into your Trade Order box.</span>
          </p>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: RECENT TRADES VIEW */}
      {/* ======================================================== */}
      {activeTab === 'Trades' && (
        <div className="pt-3">
          <div className="grid grid-cols-4 pb-2 border-b border-[#EAE9E4] text-[11px] text-[#A1A1AA] font-mono">
            <span>Price (USD)</span>
            <span className="text-center">Amount</span>
            <span className="text-center">Settlement</span>
            <span className="text-right">Timestamp</span>
          </div>
          <div className="divide-y divide-[#FAF9F6] max-h-72 overflow-y-auto mt-1 font-mono text-[12px]">
            {trades.map((t) => (
              <div key={t.id} className="grid grid-cols-4 py-2.5 items-center">
                <span className={`font-semibold ${t.side === 'buy' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                  ${fmtPoints(t.price)}
                </span>
                <span className="text-center text-[#18181B]">{t.amount.toLocaleString()}</span>
                <span className="text-center">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-[#EEF2FF] text-[#4F46E5] font-sans font-medium">
                    Ledger AMM
                  </span>
                </span>
                <span className="text-right text-[#71717A] text-[11px]">{t.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: COMMUNITY & CORDCHAIN ADVANTAGE MULTIPLIER */}
      {/* ======================================================== */}
      {activeTab === 'Community & Alpha' && (
        <div className="pt-4 space-y-4 text-left max-h-[420px] overflow-y-auto pr-1">
          {/* Top Advantage Multiplier Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#FAF9F6] to-[#F5F4EE] border border-[#EAE9E4]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#F59E0B]" />
                  <h3 className="text-[14px] font-bold text-[#18181B]">
                    CordChain Community Valuation & Advantage Multiplier
                  </h3>
                </div>
                <p className="text-[11.5px] text-[#71717A] mt-0.5">
                  Stocks gain direct valuation, dividend APY, and fee advantages based on member engagement.
                </p>
              </div>

              <div className="px-3.5 py-1.5 rounded-xl bg-[#18181B] text-white flex items-center gap-2 shadow-xs">
                <Zap className="w-3.5 h-3.5 text-[#FDE047]" />
                <span className="text-[13px] font-bold font-mono">{advantage.multiplier}x Multiplier</span>
                <span className="text-[10px] text-[#A1A1AA] uppercase border-l border-[#3F3F46] pl-2 font-mono">
                  {advantage.tierBonusLabel}
                </span>
              </div>
            </div>

            {/* 4-Tier Weighting Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
              <div className="bg-white p-2.5 rounded-xl border-2 border-[#8B5CF6]/40">
                <span className="text-[9.5px] font-bold text-[#7C3AED] uppercase block">CordChain Affiliated</span>
                <span className="text-[16px] font-bold text-[#18181B] block mt-0.5">
                  {memberStats.cordchainAffiliatedMembers.toLocaleString()}
                </span>
                <span className="text-[9.5px] text-[#8B5CF6] font-semibold">3x Priority</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-[#3B82F6]/30">
                <span className="text-[9.5px] font-bold text-[#2563EB] uppercase block">Active Daily</span>
                <span className="text-[16px] font-bold text-[#18181B] block mt-0.5">
                  {memberStats.activeDailyMembers.toLocaleString()}
                </span>
                <span className="text-[9.5px] text-[#3B82F6] font-semibold">2x Weight</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-[#10B981]/30">
                <span className="text-[9.5px] font-bold text-[#059669] uppercase block">Online Discord</span>
                <span className="text-[16px] font-bold text-[#18181B] block mt-0.5">
                  {memberStats.onlineMembers.toLocaleString()}
                </span>
                <span className="text-[9.5px] text-[#10B981] font-semibold">1.5x Weight</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-[#EAE9E4]">
                <span className="text-[9.5px] font-bold text-[#71717A] uppercase block">Total Members</span>
                <span className="text-[16px] font-bold text-[#18181B] block mt-0.5">
                  {memberStats.totalMembers.toLocaleString()}
                </span>
                <span className="text-[9.5px] text-[#71717A] font-semibold">1x Weight</span>
              </div>
            </div>

            {/* Concrete Stock Advantages */}
            <div className="mt-3 pt-2.5 border-t border-[#EAE9E4] grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-[#EAE9E4]">
                <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Dividend APY: <strong className="text-[#10B981]">+{advantage.dividendApyBonusPct}%</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-[#EAE9E4]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span>Trading Fee: <strong className="text-[#18181B]">{advantage.exchangeFeeDiscountPct}%</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-[#EAE9E4]">
                <Activity className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>AMM Depth: <strong className="text-[#18181B]">${advantage.ammLiquidityBonusUsd.toLocaleString()}</strong></span>
              </div>
            </div>
          </div>

          {/* Two Real-Time Member Rosters */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[12.5px] font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span>Two Real-Time Community Member Lists</span>
              </h4>

              <div className="flex items-center bg-[#EFECE6] p-0.5 rounded-lg text-[10.5px] font-medium">
                <button
                  type="button"
                  onClick={() => setCommunityRosterTab('cordchain')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    communityRosterTab === 'cordchain'
                      ? 'bg-white text-[#18181B] font-bold shadow-2xs'
                      : 'text-[#71717A] hover:text-[#18181B]'
                  }`}
                >
                  CordChain Traders ({memberStats.cordchainAffiliatedMembers})
                </button>
                <button
                  type="button"
                  onClick={() => setCommunityRosterTab('discord')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    communityRosterTab === 'discord'
                      ? 'bg-white text-[#18181B] font-bold shadow-2xs'
                      : 'text-[#71717A] hover:text-[#18181B]'
                  }`}
                >
                  Discord Members ({memberStats.totalMembers.toLocaleString()})
                </button>
              </div>
            </div>

            <div className="bg-[#FAF9F6] border border-[#EAE9E4] rounded-xl p-3 max-h-[190px] overflow-y-auto">
              {communityRosterTab === 'cordchain' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {memberStats.cordchainMemberList.map((m) => (
                    <div key={m.id} className="p-2.5 rounded-lg bg-white border border-[#EAE9E4] flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-[#8B5CF6]/15 text-[#7C3AED] flex items-center justify-center font-bold text-[10px] font-mono shrink-0">
                          {m.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#18181B] truncate">{m.username}</p>
                          <p className="text-[9.5px] text-[#71717A] font-mono">{m.traderRank}</p>
                        </div>
                      </div>
                      <div className="text-right font-mono text-[10px] shrink-0">
                        <p className="font-bold text-[#10B981]">{m.sharesHeld.toLocaleString()} shares</p>
                        <p className="text-[#71717A]">{m.walletAddress}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {memberStats.discordMemberList.map((m) => (
                    <div key={m.id} className="p-2 rounded-lg bg-white border border-[#EAE9E4] flex items-center justify-between text-[10.5px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          m.status === 'online' ? 'bg-[#10B981]' : m.status === 'idle' ? 'bg-[#F59E0B]' : m.status === 'dnd' ? 'bg-[#EF4444]' : 'bg-[#A1A1AA]'
                        }`} />
                        <span className="font-medium text-[#18181B] truncate">{m.displayName}</span>
                      </div>
                      <span className="text-[9px] text-[#71717A] font-mono bg-[#F4F4F5] px-1.5 py-0.5 rounded shrink-0">
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: DEEP PROJECT RESEARCH & TOKENOMICS */}
      {/* ======================================================== */}
      {activeTab === 'Project Research' && (
        <div className="pt-4 space-y-5 text-left max-h-[420px] overflow-y-auto pr-1">
          {/* Mission & Overview */}
          <div className="p-4 rounded-xl bg-[#F8F7F4] border border-[#EAE9E4]">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-[15px] font-bold text-[#18181B] flex items-center gap-2">
                  <span>{research.name}</span>
                  <span className="px-2 py-0.5 rounded bg-[#EAE9E4] text-[#18181B] text-[11px] font-mono">
                    {research.ticker}
                  </span>
                </h3>
                <p className="text-[12px] text-[#52525B] font-medium mt-0.5">{research.tagline}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#EEF2FF] text-[#4F46E5] text-[11px] font-semibold">
                {research.league} League
              </span>
            </div>
            <p className="text-[12.5px] text-[#3F3F46] leading-[1.6] mt-2">{research.overview}</p>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-[#EAE9E4] bg-white">
              <span className="text-[11px] text-[#71717A] block mb-1">Dividend APY</span>
              <span className="text-[15px] font-bold text-[#10B981] font-mono">{research.dividendYield}</span>
              <span className="text-[10px] text-[#A1A1AA] block mt-0.5">{research.dividendPayoutFreq}</span>
            </div>
            <div className="p-3 rounded-xl border border-[#EAE9E4] bg-white">
              <span className="text-[11px] text-[#71717A] block mb-1">Circulating Supply</span>
              <span className="text-[14px] font-bold text-[#18181B] font-mono">{research.circulatingSupply}</span>
              <span className="text-[10px] text-[#A1A1AA] block mt-0.5">Cap: {research.maxSupply}</span>
            </div>
            <div className="p-3 rounded-xl border border-[#EAE9E4] bg-white">
              <span className="text-[11px] text-[#71717A] block mb-1">Discord Members</span>
              <span className="text-[14px] font-bold text-[#18181B] font-mono">{research.members}</span>
              <span className="text-[10px] text-[#A1A1AA] block mt-0.5">Peak 7D: {research.peak7d}</span>
            </div>
            <div className="p-3 rounded-xl border border-[#EAE9E4] bg-white">
              <span className="text-[11px] text-[#71717A] block mb-1">Daily Activity</span>
              <span className="text-[14px] font-bold text-[#18181B] font-mono">{research.dailyMessages}</span>
              <span className="text-[10px] text-[#A1A1AA] block mt-0.5">{research.activeVoiceLounges} Voice Lounges</span>
            </div>
          </div>

          {/* On-Chain Smart Contract Details */}
          <div className="p-4 rounded-xl border border-[#EAE9E4] bg-white space-y-2.5">
            <h4 className="text-[13px] font-bold text-[#18181B] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#4F46E5]" />
              <span>CordLedger Tokenomics & Verification</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11.5px] font-mono pt-1">
              <div className="p-2.5 rounded-lg bg-[#FAF9F6] border border-[#F0EFEA]">
                <span className="text-[#71717A] block text-[10.5px]">Token Contract:</span>
                <a
                  href={research.tokenExplorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#4F46E5] font-semibold hover:underline inline-flex items-center gap-1 mt-0.5"
                >
                  <span>{shortenAddress(research.contractAddress)}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="p-2.5 rounded-lg bg-[#FAF9F6] border border-[#F0EFEA]">
                <span className="text-[#71717A] block text-[10.5px]">AMM Router Address:</span>
                <a
                  href={getCordScanTokenUrl(research.ammRouterAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#18181B] font-semibold hover:underline inline-flex items-center gap-1 mt-0.5"
                >
                  <span>{shortenAddress(research.ammRouterAddress)}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            <p className="text-[11.5px] text-[#52525B]">
              <span className="font-semibold text-[#18181B]">Governance:</span> {research.governance}
            </p>
          </div>

          {/* Key Server Channels */}
          <div>
            <h4 className="text-[13px] font-bold text-[#18181B] mb-2">Key Discord Server Channels</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {research.keyChannels.map((ch, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#F0EFEA]">
                  <p className="text-[12px] font-semibold text-[#18181B] font-mono">{ch.name}</p>
                  <p className="text-[11px] text-[#71717A] mt-0.5">{ch.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Project Roadmap */}
          <div>
            <h4 className="text-[13px] font-bold text-[#18181B] mb-2">Project Roadmap</h4>
            <div className="space-y-2">
              {research.roadmap.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl border border-[#EAE9E4] bg-white">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-mono font-bold text-[#71717A]">{item.quarter}</span>
                    <span className="text-[12px] text-[#18181B] font-medium">{item.title}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10.5px] font-semibold flex items-center gap-1 ${
                      item.status === 'completed'
                        ? 'bg-[#DCFCE7] text-[#166534]'
                        : item.status === 'in-progress'
                          ? 'bg-[#FEF3C7] text-[#92400E]'
                          : 'bg-[#F3F4F6] text-[#4B5563]'
                    }`}
                  >
                    {item.status === 'completed' ? (
                      <>
                        <Check className="w-3 h-3 text-[#166534]" />
                        <span>Completed</span>
                      </>
                    ) : item.status === 'in-progress' ? (
                      <>
                        <Zap className="w-3 h-3 text-[#92400E]" />
                        <span>In Progress</span>
                      </>
                    ) : (
                      <span>Planned</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
