import React, { useEffect, useRef } from 'react';
import { ExternalLink, Sparkles, Megaphone, Info, Zap } from 'lucide-react';

interface GoogleAdViewProps {
  format?: 'sidebar' | 'horizontal' | 'card';
  slot?: string;
  className?: string;
  label?: string;
}

export const GoogleAdView: React.FC<GoogleAdViewProps> = ({
  format = 'sidebar',
  slot = '2867319106',
  className = '',
  label = 'Sponsored',
}) => {
  const adRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    try {
      const win = window as any;
      if (typeof win !== 'undefined' && win.adsbygoogle) {
        win.adsbygoogle.push({});
      }
    } catch (e) {
      // AdSense script push failure handled gracefully (e.g. ad blocker or test environment)
    }
  }, []);

  if (format === 'horizontal') {
    return (
      <div
        className={`w-full bg-[#FAF9F6] border border-[#EAE9E4] rounded-2xl p-3 sm:p-3.5 relative overflow-hidden transition-all hover:border-[#D4D4D8] ${className}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[10px] text-[#71717A] uppercase font-mono font-semibold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EAB308]" />
            <span>{label}</span>
            <span>•</span>
            <span>Google AdSense</span>
          </div>
          <span className="text-[10px] text-[#A1A1AA] flex items-center gap-1 font-mono">
            <span>pub-2867319106630058</span>
          </span>
        </div>

        {/* AdSense Live Slot Container */}
        <div className="min-h-[60px] flex items-center justify-between gap-4 bg-white border border-[#F0EFEA] rounded-xl px-4 py-2.5">
          <ins
            ref={adRef}
            className="adsbygoogle block w-full"
            style={{ display: 'block' }}
            data-ad-client="ca-pub-2867319106630058"
            data-ad-slot={slot}
            data-ad-format="horizontal"
            data-full-width-responsive="true"
          />

          {/* Clean Native Ad Placement Content */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#18181B] text-white flex items-center justify-center font-bold text-[12px] shrink-0 shadow-2xs">
                <Sparkles className="w-4 h-4 text-[#FDE047]" />
              </div>
              <div className="min-w-0">
                <p className="text-[12.5px] font-bold text-[#18181B] truncate">
                  Web3 Guilds & Liquidity Launchpad
                </p>
                <p className="text-[11px] text-[#71717A] truncate">
                  Deploy verified community tokens on CordLedger. Zero upfront protocol fees.
                </p>
              </div>
            </div>
            <a
              href="https://google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-[#FAF9F6] border border-[#EAE9E4] hover:bg-white text-[11px] font-semibold text-[#18181B] shrink-0 inline-flex items-center gap-1.5 transition-colors"
            >
              <span>Explore</span>
              <ExternalLink className="w-3 h-3 text-[#71717A]" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (format === 'sidebar') {
    return (
      <div
        className={`w-full bg-[#FAF9F6] border border-[#EAE9E4] rounded-2xl p-3.5 relative overflow-hidden transition-all hover:border-[#D4D4D8] ${className}`}
      >
        <div className="flex items-center justify-between mb-2 text-[9.5px] font-mono text-[#71717A]">
          <span className="flex items-center gap-1 font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EAB308]" />
            <span>{label}</span>
          </span>
          <span>Google AdSense</span>
        </div>

        {/* AdSense Live Slot */}
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client="ca-pub-2867319106630058"
          data-ad-slot={slot}
          data-ad-format="rectangle"
          data-full-width-responsive="true"
        />

        {/* Clean, Non-Intrusive Sponsored Widget */}
        <div className="bg-white border border-[#F0EFEA] rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#5865F2] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
              CC
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-[#18181B] truncate leading-tight">
                Discord Alpha Drops
              </p>
              <p className="text-[10px] text-[#71717A] font-mono">CordLedger Partner</p>
            </div>
          </div>
          <p className="text-[11px] text-[#52525B] leading-relaxed">
            Boost your server shares to unlock community dividends and staking yields.
          </p>
          <div className="pt-1 flex items-center justify-between">
            <span className="text-[9.5px] text-[#A1A1AA] font-mono">ca-pub-2867319106630058</span>
            <span className="text-[10.5px] text-[#4F46E5] font-semibold flex items-center gap-0.5">
              <span>Learn more</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Native Card Format
  return (
    <div
      className={`bg-white border border-[#EAE9E4] rounded-2xl p-4 relative overflow-hidden transition-all hover:border-[#D4D4D8] ${className}`}
    >
      <div className="flex items-center justify-between mb-2.5 text-[10px] text-[#71717A] font-mono">
        <span className="uppercase font-semibold tracking-wider flex items-center gap-1 text-[#8C734B]">
          <Zap className="w-3 h-3 text-[#B45309]" />
          <span>{label}</span>
        </span>
        <span className="text-[9.5px]">Google AdSense</span>
      </div>

      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-2867319106630058"
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />

      <div className="p-3 bg-[#FAF9F6] border border-[#F0EFEA] rounded-xl flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-[#18181B] truncate">
            Trade Discord Stocks with Lowest Slippage
          </p>
          <p className="text-[10.5px] text-[#71717A] mt-0.5">
            Decentralized AMM routing on CordLedger.
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-white border border-[#EAE9E4] text-[10.5px] font-semibold text-[#18181B] shrink-0 font-mono">
          Ad
        </span>
      </div>
    </div>
  );
};
