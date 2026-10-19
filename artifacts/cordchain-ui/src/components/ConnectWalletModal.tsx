import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Smartphone,
  ExternalLink,
  Copy,
  Check,
  Globe,
  ShieldCheck,
  ArrowRight,
  X,
  Laptop,
  Sparkles,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { connectWeb3Wallet, Web3WalletState, shortenAddress } from '../lib/blockchain';

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: (state: Web3WalletState) => void;
  currentAddress?: string | null;
}

export const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({
  isOpen,
  onClose,
  onConnected,
  currentAddress,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [hasInjected, setHasInjected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'mobile' | 'desktop' | 'manual'>('mobile');
  const [manualAddress, setManualAddress] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    // Detect mobile device
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    const mobileDetected = mobileRegex.test(userAgent) || (typeof window !== 'undefined' && window.innerWidth < 768);
    setIsMobile(mobileDetected);

    // Detect if an injected Web3 provider (MetaMask / Coinbase / Rabby) is present
    const ethereum = typeof window !== 'undefined' ? (window as unknown as { ethereum?: any }).ethereum : undefined;
    const injectedPresent = Boolean(ethereum);
    setHasInjected(injectedPresent);

    // Default tab based on device detection
    if (injectedPresent) {
      setActiveTab('desktop');
    } else if (mobileDetected) {
      setActiveTab('mobile');
    } else {
      setActiveTab('desktop');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://cordchain.app';
  const cleanUrl = currentUrl.replace(/^https?:\/\//, '');

  // Mobile Deep Link URLs
  const mobileDeepLinks = [
    {
      name: 'MetaMask Mobile',
      description: 'Open in MetaMask mobile in-app Web3 browser with FaceID approval.',
      badge: 'Popular',
      url: `https://metamask.app.link/dapp/${cleanUrl}`,
      protocol: 'metamask',
    },
    {
      name: 'Coinbase Wallet',
      description: 'Open in Coinbase Wallet mobile app with instant biometric connect.',
      badge: 'Base Native',
      url: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(currentUrl)}`,
      protocol: 'coinbase',
    },
    {
      name: 'Trust Wallet',
      description: 'Open directly inside Trust Wallet mobile multi-chain DApp browser.',
      badge: 'Multi-Chain',
      url: `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(currentUrl)}`,
      protocol: 'trust',
    },
    {
      name: 'Rainbow Wallet',
      description: 'Ethereum & Base native wallet with built-in mobile browser.',
      badge: 'Fast',
      url: `https://rainbow.me/`,
      protocol: 'rainbow',
    },
  ];

  // Direct Injected Connection (Desktop extension or Inside Wallet Browser)
  const handleInjectedConnect = async () => {
    setConnecting(true);
    setErrorMsg(null);
    try {
      const state = await connectWeb3Wallet();
      onConnected(state);
      onClose();
    } catch (err: any) {
      console.warn('Connect error:', err);
      setErrorMsg(err.message || 'Could not connect Web3 wallet. Ensure CordLedger is approved.');
    } finally {
      setConnecting(false);
    }
  };

  // Manual Address Link (Read-Only address connection)
  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault();
    const addr = manualAddress.trim();
    if (!addr.startsWith('0x') || addr.length !== 42) {
      setErrorMsg('Please enter a valid 42-character Ethereum/Base address (starts with 0x).');
      return;
    }
    const state: Web3WalletState = {
      address: addr,
      isConnected: true,
      chainId: 84532,
      balanceEth: null,
    };
    onConnected(state);
    onClose();
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-white border border-[#EAE9E4] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#EAE9E4] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#18181B] flex items-center justify-center text-white shadow-xs">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-bold text-[#18181B]">Connect Web3 Wallet</h3>
                <span className="px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#4F46E5] text-[10px] font-semibold font-mono">
                  CordLedger (SHA-256)
                </span>
              </div>
              <p className="text-[11.5px] text-[#71717A]">
                Hold real community stocks, deploy ERC-20s, and track on CordScan.
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

        {/* Device Mode Switcher */}
        <div className="px-5 pt-3.5 pb-2 border-b border-[#F4F3EE] bg-[#FAF9F6] flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('mobile')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
              activeTab === 'mobile'
                ? 'bg-white text-[#18181B] shadow-xs border border-[#EAE9E4]'
                : 'text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile Device (No Extension)</span>
          </button>

          <button
            onClick={() => setActiveTab('desktop')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
              activeTab === 'desktop'
                ? 'bg-white text-[#18181B] shadow-xs border border-[#EAE9E4]'
                : 'text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Browser Extension</span>
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-white text-[#18181B] shadow-xs border border-[#EAE9E4]'
                : 'text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            <span>Address Link</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-[12.5px]">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] flex items-start gap-2.5 text-[#B91C1C]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-[12px]">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* TAB 1: MOBILE DEVICE DEEP-LINKING */}
          {activeTab === 'mobile' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="p-3 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] text-[#3730A3]">
                <div className="flex items-center gap-2 font-bold text-[12px] mb-0.5">
                  <Smartphone className="w-4 h-4 text-[#4F46E5]" />
                  <span>How Mobile Web3 Works (Zero Extensions Needed)</span>
                </div>
                <p className="text-[11.5px] text-[#4338CA] leading-relaxed">
                  Mobile browsers (Safari/Chrome) do not support extensions. Instead, tap any wallet below to open CordChain inside your wallet app&apos;s built-in Web3 browser, where your wallet connects instantly using FaceID or fingerprint.
                </p>
              </div>

              {/* Injected Wallet Quick Connect (if user is currently browsing inside MetaMask/Coinbase in-app browser) */}
              {hasInjected && (
                <div className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#166534]">
                      <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                      <span className="font-bold text-[12.5px]">In-App Wallet Detected!</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-semibold">
                      Ready to Connect
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[#15803D]">
                    You are already using an authorized Web3 mobile browser. Connect in one tap:
                  </p>
                  <button
                    onClick={handleInjectedConnect}
                    disabled={connecting}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#10B981] text-white hover:bg-[#059669] font-bold text-[12px] transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{connecting ? 'Approving Connection...' : '1-Tap Connect In-App Wallet'}</span>
                  </button>
                </div>
              )}

              {/* Mobile Deep-Link Cards */}
              <div className="space-y-2">
                <p className="text-[11.5px] font-bold text-[#52525B] uppercase tracking-wider">
                  Select Your Mobile Wallet App:
                </p>
                {mobileDeepLinks.map((item) => (
                  <a
                    key={item.protocol}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl border border-[#EAE9E4] hover:border-[#18181B] bg-white hover:bg-[#FAF9F6] transition-all flex items-center justify-between group cursor-pointer block text-inherit no-underline"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] flex items-center justify-center text-[#18181B] shrink-0 font-bold text-[13px] group-hover:bg-[#18181B] group-hover:text-white transition-colors">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[13px] text-[#18181B]">{item.name}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-[#F4F3EE] text-[#52525B]">
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#71717A] leading-tight mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[#71717A] group-hover:text-[#18181B] shrink-0 ml-2">
                      <span className="text-[11px] font-medium hidden sm:inline">Launch App</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  </a>
                ))}
              </div>

              {/* Copy URL Helper */}
              <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-2">
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="font-semibold text-[#18181B]">Alternative: Paste Link in Wallet Browser</span>
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1 text-[#4F46E5] font-semibold hover:underline cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied!' : 'Copy Site URL'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-[#71717A] leading-relaxed">
                  Open MetaMask or Coinbase Wallet on your phone &rarr; Tap the bottom <strong>Browser</strong> tab &rarr; Paste this link.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: DESKTOP BROWSER EXTENSION */}
          {activeTab === 'desktop' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {hasInjected ? (
                <div className="p-4 rounded-xl bg-white border border-[#10B981] space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 text-[#059669]">
                    <ShieldCheck className="w-5 h-5 text-[#10B981]" />
                    <span className="font-bold text-[13px]">Browser Extension Ready</span>
                  </div>
                  <p className="text-[12px] text-[#52525B] leading-relaxed">
                    A supported Web3 wallet extension (MetaMask, Coinbase Wallet, or Rabby) was detected in your browser.
                  </p>
                  <button
                    onClick={handleInjectedConnect}
                    disabled={connecting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#18181B] text-white hover:bg-[#27272A] font-bold text-[12.5px] transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>{connecting ? 'Connecting to CordLedger...' : 'Connect Injected Wallet'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-2">
                    <p className="font-semibold text-[12.5px] text-[#18181B]">
                      No Desktop Wallet Extension Detected
                    </p>
                    <p className="text-[11.5px] text-[#71717A] leading-relaxed">
                      Install a free, verified Web3 wallet extension to sign CordLedger transactions directly:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <a
                      href="https://metamask.io/download/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl border border-[#EAE9E4] hover:border-[#18181B] bg-white transition-all flex items-center justify-between text-inherit no-underline group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Wallet className="w-4 h-4 text-[#F59E0B]" />
                        <span className="font-bold text-[12.5px]">Install MetaMask Extension</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[#71717A] group-hover:text-[#18181B]" />
                    </a>

                    <a
                      href="https://www.coinbase.com/wallet/downloads"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl border border-[#EAE9E4] hover:border-[#18181B] bg-white transition-all flex items-center justify-between text-inherit no-underline group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Wallet className="w-4 h-4 text-[#2563EB]" />
                        <span className="font-bold text-[12.5px]">Install Coinbase Wallet Extension</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[#71717A] group-hover:text-[#18181B]" />
                    </a>
                  </div>

                  <div className="pt-2 text-center">
                    <button
                      onClick={() => setActiveTab('mobile')}
                      className="text-[11.5px] text-[#4F46E5] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Using a mobile phone or tablet? Switch to Mobile Connection &rarr;</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MANUAL ADDRESS LINK (Read-Only) */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualConnect} className="space-y-3 animate-in fade-in duration-150">
              <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-1">
                <span className="font-semibold text-[12px] text-[#18181B]">Link Wallet Address Directly</span>
                <p className="text-[11px] text-[#71717A] leading-relaxed">
                  Enter your public Ethereum/Base address (e.g., from your mobile wallet) to link your account to CordChain without requiring a browser signature.
                </p>
              </div>

              <div>
                <label className="block text-[11.5px] font-medium text-[#52525B] mb-1">
                  Public Wallet Address (0x...)
                </label>
                <input
                  type="text"
                  placeholder="0x71C...3921"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#EAE9E4] text-[#18181B] text-[12px] font-mono focus:outline-hidden focus:border-[#4F46E5]"
                />
              </div>

              <button
                type="submit"
                disabled={!manualAddress.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#18181B] text-white hover:bg-[#27272A] font-bold text-[12px] transition-all cursor-pointer shadow-xs disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Link Wallet to CordChain Account</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#EAE9E4] bg-[#FAF9F6] flex items-center justify-between text-[11.5px] text-[#71717A] shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Encrypted & Verified on CordLedger</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg hover:bg-[#EAE9E4] text-[#52525B] font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
