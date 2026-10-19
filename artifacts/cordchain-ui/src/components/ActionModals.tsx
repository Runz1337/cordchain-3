import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Zap,
  Play,
  Wallet,
  Megaphone,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import { ServerAsset } from '../types';
import {

  DEMO_USER,
  initiateCheckin,
  verifyCheckin,
  ApiError,
  type ApiCheckinInitiate,
  type ApiCheckinVerify,
} from '../lib/api';
import { fmtPoints } from '../lib/formatters';

interface AdLaunchPayload {
  sponsorName: string;
  title: string;
  description: string;
  mediaUrl: string;
  verifyQuestion: string;
  correctOption: string;
  wrongOptions: string[];
  budgetInr: number;
}

interface ModalProps {
  activeModal: 'boost' | 'video' | 'withdraw' | 'ad' | null;
  onClose: () => void;
  servers: ServerAsset[];
  credBalance: number;
  inrBalance: number;
  boostServer?: ServerAsset | null;
  userId?: string;
  canClaimCashDrop?: boolean;
  boostsUsedToday?: number;
  onBoostVerified?: (result: ApiCheckinVerify, ticker: string) => void;
  busy?: boolean;
  onCompleteBoost?: (serverId: string) => void;
  onCompleteVideo?: () => void;
  onWithdraw: (amount: number, upiId: string) => void | Promise<void>;
  onLaunchAd: (payload: AdLaunchPayload) => boolean | void | Promise<boolean | void>;
  onOpenTokenizeModal?: () => void;
}

type Phase = 'select' | 'watch' | 'quiz' | 'submitting' | 'result';

const DEFAULT_MEDIA =
  'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=60';

const fireConfetti = async () => {
  try {
    const confetti = (await import('canvas-confetti')).default;
    confetti({ particleCount: 160, spread: 75, origin: { y: 0.65 }, colors: ['#10B981', '#8B5CF6', '#06B6D4', '#F59E0B'] });
    setTimeout(() => confetti({ particleCount: 90, spread: 110, origin: { y: 0.5 } }), 220);
  } catch {
    // confetti is enhancement-only
  }
};

export const ActionModals: React.FC<ModalProps> = ({
  activeModal,
  onClose,
  servers,
  credBalance,
  inrBalance,
  boostServer,
  userId,
  canClaimCashDrop = true,
  boostsUsedToday = 0,
  onBoostVerified,
  busy = false,
  onWithdraw,
  onLaunchAd,
  onOpenTokenizeModal,
}) => {
  // Boost flow state
  const [phase, setPhase] = useState<Phase>('select');
  const [selectedServerId, setSelectedServerId] = useState<string>(boostServer?.id || '');
  const [session, setSession] = useState<ApiCheckinInitiate | null>(null);
  const [watchSeconds, setWatchSeconds] = useState<number>(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [result, setResult] = useState<ApiCheckinVerify | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const startedRef = useRef(false);

  // Withdraw state
  const [withdrawAmt, setWithdrawAmt] = useState('100');
  const [upiId, setUpiId] = useState('trader@okhdfcbank');
  const [withdrawBusy, setWithdrawBusy] = useState(false);

  // Ad state
  const [adServerId, setAdServerId] = useState<string>('');
  const [adTitle, setAdTitle] = useState('Join our 24/7 gaming & rewards community');
  const [adDesc, setAdDesc] = useState('Daily tournaments, anime watchparties, and a friendly, verified community.');
  const [adQuestion, setAdQuestion] = useState('Which event do we host every single day?');
  const [adCorrect, setAdCorrect] = useState('Tournaments & Watchparties');
  const [adWrong1, setAdWrong1] = useState('Math homework');
  const [adWrong2, setAdWrong2] = useState('Nothing, we sleep');
  const [adBudget, setAdBudget] = useState('500');
  const [adBusy, setAdBusy] = useState(false);
  const [adSuccess, setAdSuccess] = useState<{
    ticker: string;
    serverName: string;
    budgetInr: number;
    boostsFunded: number;
  } | null>(null);
  const [adError, setAdError] = useState<string | null>(null);

  // Latest servers snapshot without re-triggering the reset effect below
  const serversRef = useRef(servers);
  serversRef.current = servers;
  const firstServer = servers[0];
  const targetServer =
    servers.find((s) => s.id === (selectedServerId || boostServer?.id || firstServer?.id)) || firstServer;

  // Reset flow when a modal opens — but NOT on every servers refresh (the 25s
  // market poll used to cancel in-flight boost sessions when this depended on `servers`)
  useEffect(() => {
    if (!activeModal) return;
    const srvs = serversRef.current;
    setPhase(activeModal === 'boost' ? 'select' : 'watch');
    setSession(null);
    setResult(null);
    setAnswer(null);
    setFlowError(null);
    setWatchSeconds(0);
    setAdServerId(boostServer?.id || srvs[0]?.id || '');
    setSelectedServerId(boostServer?.id || srvs[0]?.id || '');
    setAdSuccess(null);
    setAdError(null);
    startedRef.current = activeModal === 'video';
  }, [activeModal, boostServer?.id]);

  // Kick off the backend session on entering watch phase
  useEffect(() => {
    if (!activeModal || (activeModal !== 'boost' && activeModal !== 'video')) return;
    if (phase !== 'watch' || session || startedRef.current) return;
    startedRef.current = true;
    const guildId = targetServer?.id || DEMO_USER.guildId;
    initiateCheckin(guildId, userId || DEMO_USER.id)
      .then((s) => {
        setSession(s);
        setWatchSeconds(s.minWatchSeconds ?? 10);
      })
      .catch((err) => {
        setFlowError(
          err instanceof ApiError && err.status === 429
            ? 'Daily boost limit (3/3) already reached today. Come back tomorrow for a fresh boost!'
            : err instanceof ApiError
              ? err.message
              : 'Could not reach the CordChain sponsor network.',
        );
        setPhase('result');
        setResult(null);
      });
  }, [activeModal, phase, session, targetServer?.id, userId]);

  // Watch countdown (anti-macro: buttons unlock after N seconds)
  useEffect(() => {
    if ((phase === 'watch' || phase === 'quiz') && watchSeconds > 0) {
      const t = setTimeout(() => setWatchSeconds((s) => Math.max(0, s - 1)), 1000);
      return () => clearTimeout(t);
    }
    if (phase === 'watch' && watchSeconds === 0 && session) setPhase('quiz');
  }, [phase, watchSeconds, session]);

  const totalWatch = session?.minWatchSeconds ?? 10;

  const submitVerify = async (choice: string) => {
    if (!session) return;
    setAnswer(choice);
    setPhase('submitting');
    try {
      const guildId = session.guild.id;
      const res = await verifyCheckin({
        guildId,
        userId: userId || DEMO_USER.id,
        campaignId: session.campaign.campaignId,
        selectedOption: choice,
      });
      setResult(res);
      setPhase('result');
      if (res.verified) {
        void fireConfetti();
        onBoostVerified?.(res, session.guild.ticker);
      }
    } catch (err) {
      setFlowError(err instanceof ApiError ? err.message : 'Verification failed.');
      setResult(null);
      setPhase('result');
    } finally {
      setAnswer(null);
    }
  };

  const restartFlow = async () => {
    setPhase('watch');
    setSession(null);
    startedRef.current = false;
    setWatchSeconds(0);
    setFlowError(null);
    setResult(null);
  };

  const handleWithdraw = async () => {
    const amt = Math.max(100, Number(withdrawAmt) || 100);
    setWithdrawBusy(true);
    try {
      await onWithdraw(amt, upiId);
      onClose();
    } finally {
      setWithdrawBusy(false);
    }
  };

  const handleLaunchAd = async () => {
    const srv = serversRef.current.find((s) => s.id === adServerId) || serversRef.current[0];
    if (!srv) {
      if (onOpenTokenizeModal) {
        onClose();
        onOpenTokenizeModal();
      }
      return;
    }
    setAdBusy(true);
    setAdError(null);
    const budget = Math.max(10, Number(adBudget) || 50);
    try {
      const res = await onLaunchAd({
        sponsorName: srv.ticker.replace('$', ''),
        title: adTitle,
        description: adDesc,
        mediaUrl: DEFAULT_MEDIA,
        verifyQuestion: adQuestion,
        correctOption: adCorrect,
        wrongOptions: [adWrong1, adWrong2].filter(Boolean),
        budgetInr: budget,
      });
      if (res === false) {
        setAdError('Campaign deposit failed — check your balance or budget and try again.');
        return;
      }
      setAdSuccess({
        ticker: srv.ticker,
        serverName: srv.name,
        budgetInr: budget,
        boostsFunded: Math.floor(budget / 0.2),
      });
    } catch (err) {
      setAdError(err instanceof ApiError ? err.message : 'Campaign creation failed — please try again.');
    } finally {
      setAdBusy(false);
    }
  };

  if (!activeModal) return null;

  const inputClass =
    'w-full bg-[#F8F7F4] border border-[#EAE9E4] rounded-xl px-3.5 py-2 text-[13px] text-[#18181B]';
  const primaryBtn =
    'w-full py-2.5 rounded-xl bg-[#141416] hover:bg-[#27272A] disabled:opacity-60 disabled:cursor-not-allowed text-white text-[13px] font-semibold cursor-pointer';

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-[1px] z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#EAE9E4] rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---------- BOOST / SPONSORED VIDEO FLOW ---------- */}
        {(activeModal === 'boost' || activeModal === 'video') && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#EFECE6] flex items-center justify-center text-[#18181B]">
                  {activeModal === 'boost' ? <Zap className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#18181B]">
                    {activeModal === 'boost' ? 'Boost Server Stock' : 'Watch Sponsored Server Ad'}
                  </h3>
                  <p className="text-[11.5px] text-[#71717A]">
                    15s Community Spotlight · +250 $CRED{canClaimCashDrop ? ' + real $ dividend' : ' (fantasy only today)'}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-1 text-[#71717A] hover:text-[#18181B] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {servers.length === 0 ? (
              <div className="text-center py-6 px-3">
                <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#5865F2] flex items-center justify-center mx-auto mb-3.5 border border-[#C7D2FE]">
                  <Zap className="w-6 h-6" />
                </div>
                <h4 className="text-[15px] font-bold text-[#18181B] mb-1.5">No Server Stocks Listed Yet</h4>
                <p className="text-[12px] text-[#71717A] max-w-sm mx-auto mb-5 leading-relaxed">
                  There are currently no tokenized Discord communities listed on the exchange. Tokenize your server to begin boosting its engagement advantage and earning dividends.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      onOpenTokenizeModal?.();
                    }}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-[12.5px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <span>+ List & Tokenize Your Server</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-[#EAE9E4] hover:bg-[#F8F7F4] text-[#52525B] text-[12.5px] font-semibold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (phase === 'select') ? (
              <div>
                <label className="block text-[12px] font-medium text-[#52525B] mb-2">
                  Select Discord Server to Boost
                </label>
                <select
                  value={selectedServerId}
                  onChange={(e) => setSelectedServerId(e.target.value)}
                  className={`${inputClass} mb-4`}
                >
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.ticker} — {s.name} (${fmtPoints(s.priceUsd)})
                    </option>
                  ))}
                </select>

                <div className="p-3.5 rounded-xl bg-[#F2F9F5] border border-[#DFEFE5] text-[12px] text-[#15803D] mb-4 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    +250 $CRED per boost ({boostsUsedToday}/3 used today).{' '}
                    {canClaimCashDrop
                      ? 'Your first verified boost today also pays a real cash dividend.'
                      : 'Today’s real-cash drop was already claimed — next boost is fantasy coins only.'}
                  </span>
                </div>

                <button
                  onClick={() => {
                    startedRef.current = false;
                    setPhase('watch');
                  }}
                  className={primaryBtn}
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                  Start Sponsored Boost ({targetServer?.ticker || '$SQUAD'})
                </button>
              </div>
            ) : null}

            {(phase === 'watch' || phase === 'quiz' || phase === 'submitting') && (
              <div>
                {!session && (
                  <div className="py-10 text-center text-[13px] text-[#71717A]">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mb-2" />
                    <p>Loading sponsor card from the CordChain ad network…</p>
                  </div>
                )}
                {session && (
                  <>
                    {/* Sponsor media card */}
                    <div className="rounded-xl bg-[#18181B] text-white overflow-hidden mb-4">
                      <div className="relative h-40">
                        <img
                          src={session.campaign.mediaUrl || DEFAULT_MEDIA}
                          alt={session.campaign.sponsorName}
                          className="w-full h-full object-cover opacity-85"
                        />
                        <span className="absolute top-2.5 right-2.5 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-black/50 text-white/90">
                          Sponsored
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#18181B] to-transparent" />
                        <div className="absolute bottom-2.5 left-3 right-3">
                          <p className="text-[10px] uppercase tracking-widest text-[#A1A1AA]">{session.campaign.sponsorName}</p>
                          <p className="text-[14px] font-bold truncate">{session.campaign.title}</p>
                        </div>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[12px] text-[#D4D4D8] line-clamp-2">{session.campaign.description}</p>
                        <div className="mt-3 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#10B981] transition-all duration-1000 ease-linear"
                            style={{ width: `${100 - Math.min(100, (watchSeconds / totalWatch) * 100)}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[10.5px] text-[#A1A1AA] flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {watchSeconds > 0
                            ? `Verification unlocks in ${watchSeconds}s — proof-of-attention required`
                            : 'Reward ready · answer the question below'}
                        </p>
                      </div>
                    </div>

                    {phase === 'quiz' ? (
                      <div>
                        <p className="text-[13px] font-semibold text-[#18181B] mb-2.5">{session.campaign.verifyQuestion}</p>
                        <div className="space-y-2">
                          {session.campaign.options.map((opt) => (
                            <button
                              key={opt}
                              onClick={() => void submitVerify(opt)}
                              className="w-full text-left px-3.5 py-2.5 rounded-xl border border-[#EAE9E4] bg-[#FAF9F6] hover:bg-[#F1EFE9] hover:border-[#D9D7D0] text-[13px] font-medium text-[#18181B] cursor-pointer transition-colors"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                        <p className="mt-3 text-[11px] text-[#A1A1AA]">
                          Wrong answers earn nothing and trigger a 1-hour cooldown. Page is randomized per user.
                        </p>
                      </div>
                    ) : phase === 'submitting' ? (
                      <div className="py-6 text-center text-[13px] text-[#71717A]">
                        <Loader2 className="w-5 h-5 animate-spin inline-block mb-2" />
                        <p>Verifying attention check with the anti-cheat engine…</p>
                      </div>
                    ) : (
                      <div className="py-6 text-center text-[13px] text-[#71717A]">
                        <p>Studying the sponsor card… verification unlocks in {watchSeconds}s</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {phase === 'result' && (
              <div className="text-center py-2">
                {result?.verified ? (
                  <>
                    <div className="w-12 h-12 rounded-full bg-[#DCFCE7] flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="w-6 h-6 text-[#16A34A]" />
                    </div>
                    <p className="text-[16px] font-bold text-[#18181B]">
                      {session?.guild.ticker} Stock Boosted +0.8%!
                    </p>
                    <div className="my-4 space-y-2 text-left">
                      <div className="p-3 rounded-xl bg-[#F2F9F5] border border-[#DFEFE5] flex items-center justify-between">
                        <span className="text-[12.5px] text-[#15803D] font-medium">Trading Wallet</span>
                        <span className="font-mono font-bold text-[#15803D]">
                          +{result.credAwarded?.toLocaleString()} $CRED
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-[#EAE9E4] flex items-center justify-between">
                        <span className="text-[12.5px] text-[#52525B] font-medium">Real Cash Dividend (Wallet Vault)</span>
                        <span className="font-mono font-bold text-[#18181B]">
                          {result.isPaidDrop && (result.userPayoutInr ?? 0) > 0
                            ? `+$${result.userPayoutInr?.toFixed(2)}`
                            : '—'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#71717A]">
                        Daily boosts: {result.dailyBoostCount}/3 · New balance {result.newCredBalance} $CRED
                        {result.newCashWalletInr ? ` · $${result.newCashWalletInr}` : ''}
                      </p>
                    </div>
                    <button onClick={onClose} className={primaryBtn}>
                      Awesome, done!
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-[#FEE2E2] flex items-center justify-center mx-auto mb-3">
                      <XCircle className="w-6 h-6 text-[#DC2626]" />
                    </div>
                    <p className="text-[15px] font-bold text-[#18181B] mb-1">
                      {result ? 'Attention check failed' : 'Boost unavailable'}
                    </p>
                    <p className="text-[12.5px] text-[#71717A] mb-4">
                      {result?.message || flowError || 'A 1-hour cooldown has been initiated.'}
                    </p>
                    <button onClick={onClose} className={primaryBtn}>
                      Got it
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* ---------- DAILY $CRED ALLOWANCE & VAULT ---------- */}
        {activeModal === 'withdraw' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] border border-[#BBF7D0] flex items-center justify-center text-[#059669]">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#18181B]">Daily $CRED Login Allowance</h3>
                  <p className="text-[11.5px] text-[#71717A]">
                    Pure Fantasy Economy · CordLedger Verified
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-1 text-[#71717A] hover:text-[#18181B] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] space-y-3 mb-5 text-[12.5px]">
              <div className="flex justify-between items-center py-1 border-b border-[#F0EFEA]">
                <span className="text-[#71717A]">Liquid Trading Balance:</span>
                <span className="font-mono font-bold text-[#18181B]">{credBalance.toLocaleString()} $CRED</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#F0EFEA]">
                <span className="text-[#71717A]">Starter Season Grant:</span>
                <span className="font-mono font-semibold text-[#10B981]">1,000 $CRED (Active)</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[#71717A]">Daily Login Bonus:</span>
                <span className="font-mono font-semibold text-[#10B981]">+50 $CRED / Day</span>
              </div>
              <p className="text-[11px] text-[#71717A] pt-1 leading-relaxed">
                CordChain is a 100% fantasy trading exchange. All transactions, bonuses, and weekly shareholder dividends settle in <strong>$CRED</strong> and are cryptographically chained to the tamper-evident CordLedger.
              </p>
            </div>

            <button
              disabled={withdrawBusy || busy}
              onClick={() => void handleWithdraw()}
              className="w-full bg-[#18181B] hover:bg-[#27272A] text-white py-2.5 rounded-xl text-[13px] font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {withdrawBusy ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
              {withdrawBusy ? 'Claiming allowance on CordLedger…' : 'Claim +50 $CRED Daily Bonus'}
            </button>
          </div>
        )}

        {/* ---------- SELF-SERVE SPONSOR CAMPAIGN (B2B) ---------- */}
        {activeModal === 'ad' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#EFECE6] flex items-center justify-center text-[#18181B]">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#18181B]">Launch Sponsor Campaign</h3>
                  <p className="text-[11.5px] text-[#71717A]">From $50 · Deposit meters the network</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1 text-[#71717A] hover:text-[#18181B] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {servers.length === 0 ? (
              <div className="text-center py-6 px-3">
                <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#5865F2] flex items-center justify-center mx-auto mb-3.5 border border-[#C7D2FE]">
                  <Megaphone className="w-6 h-6" />
                </div>
                <h4 className="text-[15px] font-bold text-[#18181B] mb-1.5">No Communities Available to Sponsor</h4>
                <p className="text-[12px] text-[#71717A] max-w-sm mx-auto mb-5 leading-relaxed">
                  There are currently no tokenized Discord communities on the exchange to attach a sponsored campaign to. Tokenize your server to begin running sponsored promotions.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      onOpenTokenizeModal?.();
                    }}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-[12.5px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <span>+ List & Tokenize Your Server</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-[#EAE9E4] hover:bg-[#F8F7F4] text-[#52525B] text-[12.5px] font-semibold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : adSuccess ? (
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-full bg-[#DCFCE7] flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6 text-[#16A34A]" />
                </div>
                <p className="text-[16px] font-bold text-[#18181B]">Campaign Live on the Network!</p>
                <p className="text-[12px] text-[#71717A] mb-4">
                  {adSuccess.ticker} is now promoted across every sponsored boost slot.
                </p>
                <div className="my-4 space-y-2 text-left">
                  <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] flex items-center justify-between">
                    <span className="text-[12.5px] text-[#52525B] font-medium">Sponsoring</span>
                    <span className="font-mono font-bold text-[#18181B] text-[12.5px] truncate max-w-[180px]">
                      {adSuccess.ticker} — {adSuccess.serverName}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F2F9F5] border border-[#DFEFE5] flex items-center justify-between">
                    <span className="text-[12.5px] text-[#15803D] font-medium">Deposit Locked</span>
                    <span className="font-mono font-bold text-[#15803D]">${adSuccess.budgetInr.toFixed(2)}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-[#EAE9E4] flex items-center justify-between">
                    <span className="text-[12.5px] text-[#52525B] font-medium">Verified Boosts Funded</span>
                    <span className="font-mono font-bold text-[#18181B]">~{adSuccess.boostsFunded.toLocaleString()}</span>
                  </div>
                  <p className="text-[11px] text-[#71717A]">
                    Budget drains $0.20 per verified attention check (~$0.12 user · $0.04 owner · $0.04 platform). The campaign auto-deactivates when the deposit is spent.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setAdSuccess(null)}
                    className="flex-1 py-2.5 rounded-xl border border-[#EAE9E4] hover:bg-[#F8F7F4] text-[#52525B] text-[13px] font-semibold cursor-pointer"
                  >
                    Create Another
                  </button>
                  <button onClick={onClose} className={`${primaryBtn} flex-1`}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                {adError && (
                  <div className="mb-4 p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-[12px] flex items-start gap-2">
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{adError}</span>
                  </div>
                )}
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="block text-[12px] text-[#52525B] mb-1">Target Server</label>
                    <select value={adServerId} onChange={(e) => setAdServerId(e.target.value)} className={inputClass}>
                      {servers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.ticker} — {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#52525B] mb-1">Sponsored Headline</label>
                    <input type="text" value={adTitle} onChange={(e) => setAdTitle(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#52525B] mb-1">Pitch / Description</label>
                    <textarea
                      rows={2}
                      value={adDesc}
                      onChange={(e) => setAdDesc(e.target.value)}
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="block text-[12px] text-[#52525B] mb-1">Attention question shown to boosters</label>
                      <input type="text" value={adQuestion} onChange={(e) => setAdQuestion(e.target.value)} className={inputClass} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] text-[#52525B] mb-1">Correct</label>
                        <input type="text" value={adCorrect} onChange={(e) => setAdCorrect(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#52525B] mb-1">Wrong A</label>
                        <input type="text" value={adWrong1} onChange={(e) => setAdWrong1(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#52525B] mb-1">Wrong B</label>
                        <input type="text" value={adWrong2} onChange={(e) => setAdWrong2(e.target.value)} className={inputClass} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#52525B] mb-1">Deposit Budget (USD)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['50', '100', '250'].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAdBudget(val)}
                          className={`py-2 rounded-xl text-[12px] font-medium border transition-colors cursor-pointer ${
                            adBudget === val
                              ? 'bg-[#18181B] text-white border-[#18181B]'
                              : 'bg-white border-[#EAE9E4] text-[#52525B] hover:bg-[#F8F7F4]'
                          }`}
                        >
                          ${val}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-[#71717A] mt-1.5">
                      At $0.20 CPI (~$0.12 user, $0.04 owner, $0.04 platform) that funds ~{Math.floor((Number(adBudget) || 50) / 0.2)} verified boosts.
                    </p>
                  </div>
                </div>

                <button
                  disabled={adBusy || busy}
                  onClick={() => void handleLaunchAd()}
                  className={primaryBtn}
                >
                  {adBusy ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                  {adBusy ? 'Publishing campaign…' : `Launch Campaign ($${adBudget || '50'})`}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
