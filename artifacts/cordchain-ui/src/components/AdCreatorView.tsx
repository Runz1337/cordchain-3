import React, { useState } from 'react';
import { Megaphone, Plus, Eye, MousePointerClick, Zap, CheckCircle2, ArrowRight } from 'lucide-react';
import { AdCampaign, ServerAsset } from '../types';
import { ServerIcon } from './Icons';

interface AdCreatorViewProps {
  campaigns: AdCampaign[];
  servers: ServerAsset[];
  credBalance: number;
  onCreateCampaign: (campaign: AdCampaign) => void;
  onTriggerToast: (msg: string) => void;
}

export const AdCreatorView: React.FC<AdCreatorViewProps> = ({
  campaigns,
  servers,
  credBalance,
  onCreateCampaign,
  onTriggerToast,
}) => {
  const [selectedServerId, setSelectedServerId] = useState(servers[0]?.id || '');
  const [tagline, setTagline] = useState('Join our verified Discord community and earn daily Cordchain rewards!');
  const [budget, setBudget] = useState('1000');

  const selectedServer = servers.find((s) => s.id === selectedServerId) || servers[0];
  const numBudget = Number(budget) || 500;
  const estimatedImpressions = numBudget * 14;
  const estimatedClicks = Math.round(estimatedImpressions * 0.08);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer) {
      onTriggerToast('No server selected or available to advertise.');
      return;
    }
    if (numBudget > credBalance) {
      onTriggerToast('Insufficient $CRED balance for this ad budget!');
      return;
    }

    const newCampaign: AdCampaign = {
      id: `camp-${Date.now()}`,
      ticker: selectedServer.ticker,
      serverName: selectedServer.name,
      tagline,
      budgetCred: numBudget,
      spentCred: 0,
      impressions: 0,
      clicks: 0,
      status: 'active',
      createdAt: 'Just now',
    };

    onCreateCampaign(newCampaign);
    onTriggerToast(`Ad campaign for ${selectedServer.ticker} launched!`);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-5 py-6 space-y-6 select-none">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Megaphone className="w-5 h-5 text-[#18181B]" />
            <h1 className="text-[24px] font-bold text-[#18181B] tracking-tight">Ad Creator Studio</h1>
          </div>
          <p className="text-[13px] text-[#71717A]">
            Spend $CRED fantasy tokens to promote your Discord server across the Cordchain network.
          </p>
        </div>

        <div className="px-4 py-2 rounded-2xl bg-white border border-[#EAE9E4] text-[12.5px] font-mono">
          <span className="text-[#71717A]">Available Balance:</span>{' '}
          <span className="font-bold text-[#18181B]">{credBalance.toLocaleString()} $CRED</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Creator Form */}
        <div className="lg:col-span-7 bg-white border border-[#EAE9E4] rounded-2xl p-6">
          <h2 className="text-[16px] font-semibold text-[#18181B] mb-4">Create New Sponsored Ad</h2>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-[#52525B] mb-1.5">
                Target Discord Server
              </label>
              <select
                value={selectedServerId}
                onChange={(e) => setSelectedServerId(e.target.value)}
                className="w-full bg-[#F8F7F4] border border-[#EAE9E4] rounded-xl px-3.5 py-2.5 text-[13px] text-[#18181B]"
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ticker} — {s.name} ({s.members} members)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#52525B] mb-1.5">
                Sponsored Headline / Pitch (max 100 characters)
              </label>
              <textarea
                rows={2}
                maxLength={100}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full bg-[#F8F7F4] border border-[#EAE9E4] rounded-xl p-3 text-[13px] text-[#18181B] resize-none"
              />
              <span className="text-[11px] text-[#A1A1AA]">{tagline.length}/100 characters</span>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#52525B] mb-1.5">
                Campaign Budget ($CRED)
              </label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {['500', '1000', '2500', '5000'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setBudget(val)}
                    className={`py-2 rounded-xl text-[12px] font-medium border transition-colors cursor-pointer ${
                      budget === val
                        ? 'bg-[#18181B] text-white border-[#18181B]'
                        : 'bg-white border-[#EAE9E4] text-[#52525B] hover:bg-[#F8F7F4]'
                    }`}
                  >
                    {val} $CRED
                  </button>
                ))}
              </div>
            </div>

            {/* Campaign Projections */}
            <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE9E4] grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-[#71717A]">Estimated Impressions</p>
                <p className="text-[16px] font-bold text-[#18181B] font-mono tabular-nums">
                  ~{estimatedImpressions.toLocaleString()} views
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#71717A]">Estimated Member Joins</p>
                <p className="text-[16px] font-bold text-[#10B981] font-mono tabular-nums">
                  ~{estimatedClicks} clicks
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#141416] hover:bg-[#27272A] text-white text-[13px] font-semibold cursor-pointer"
            >
              Launch Ad Campaign ({numBudget} $CRED)
            </button>
          </form>
        </div>

        {/* Live Ad Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-[#EAE9E4] rounded-2xl p-6">
            <h3 className="text-[14px] font-semibold text-[#18181B] mb-1">Live Ad Preview</h3>
            <p className="text-[11.5px] text-[#71717A] mb-4">
              This is how your ad appears in the Cordchain rewarded video and banner slots:
            </p>

            <div className="bg-[#18181B] text-white rounded-2xl p-5 relative overflow-hidden">
              <span className="absolute top-3 right-3 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-white/70">
                Sponsored
              </span>
              <div className="flex items-center gap-3 mb-3">
                <ServerIcon id={selectedServer?.id || 'default'} variant="header" className="w-10 h-10 rounded-xl" />
                <div>
                  <h4 className="text-[14px] font-bold">{selectedServer?.ticker || '$SERVER'}</h4>
                  <p className="text-[11px] text-white/70">{selectedServer?.name || 'Discord Community'}</p>
                </div>
              </div>
              <p className="text-[12.5px] text-white/90 leading-relaxed mb-4">
                "{tagline}"
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-[11px] text-[#10B981] font-medium">+250 $CRED reward to viewers</span>
                <button
                  type="button"
                  className="px-3 py-1 rounded-lg bg-white text-[#18181B] text-[11px] font-semibold"
                >
                  Join Server →
                </button>
              </div>
            </div>
          </div>

          {/* Active Campaigns */}
          <div className="bg-white border border-[#EAE9E4] rounded-2xl p-6">
            <h3 className="text-[14px] font-semibold text-[#18181B] mb-3">Your Ad Campaigns</h3>
            <div className="space-y-3">
              {campaigns.map((c) => (
                <div key={c.id} className="p-3.5 rounded-xl border border-[#EAE9E4] bg-[#FAF9F6]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[13px] text-[#18181B]">{c.ticker}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-[#DCFCE7] text-[#15803D]">
                      {c.status}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[#71717A] truncate">{c.tagline}</p>
                  <div className="flex items-center justify-between text-[11px] font-mono mt-2 pt-2 border-t border-[#EAE9E4]">
                    <span>{c.impressions.toLocaleString()} views</span>
                    <span>{c.clicks} clicks</span>
                    <span className="text-[#18181B] font-semibold">{c.budgetCred} $CRED</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
