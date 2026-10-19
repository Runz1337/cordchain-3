import React, { useState } from 'react';
import {
  Settings,
  Bell,
  CreditCard,
  Sliders,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
  Check,
} from 'lucide-react';
import { SettingsState, UserProfile } from '../types';
import { DiscordLogo, AyushAvatar } from './Icons';

interface SettingsViewProps {
  settings: SettingsState;
  onUpdateSettings: (newSettings: Partial<SettingsState>) => void;
  user: UserProfile;
  onOpenDiscordLogin: () => void;
  onTriggerToast: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  user,
  onOpenDiscordLogin,
  onTriggerToast,
}) => {
  const [activeSection, setActiveSection] = useState<'general' | 'trading' | 'payouts' | 'discord'>(
    'general'
  );

  const [upiInput, setUpiInput] = useState(settings.upiId);
  const [webhookInput, setWebhookInput] = useState(settings.discordWebhookUrl);
  const [currency, setCurrency] = useState(settings.currency);
  const [slippage, setSlippage] = useState(settings.slippageTolerance);
  const [confirmOrders, setConfirmOrders] = useState(settings.confirmOrders);
  const [autoWithdraw, setAutoWithdraw] = useState(settings.autoWithdrawalEnabled);

  const handleSave = () => {
    onUpdateSettings({
      upiId: upiInput,
      discordWebhookUrl: webhookInput,
      currency,
      slippageTolerance: slippage,
      confirmOrders,
      autoWithdrawalEnabled: autoWithdraw,
    });
    onTriggerToast('Settings updated successfully!');
  };

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-6 select-none space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-[24px] font-bold text-[#18181B] tracking-tight">Settings</h1>
        <p className="text-[13px] text-[#71717A]">
          Manage your Discord profile connection, trading parameters, and automated cash payouts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Navigation Rail */}
        <aside className="md:col-span-3 space-y-1">
          {[
            { id: 'general' as const, label: 'Profile & Account', icon: <AyushAvatar className="w-4 h-4" /> },
            { id: 'trading' as const, label: 'Trading Preferences', icon: <Sliders className="w-4 h-4" /> },
            { id: 'payouts' as const, label: 'Payouts & UPI', icon: <CreditCard className="w-4 h-4" /> },
            { id: 'discord' as const, label: 'Discord Bot & Webhooks', icon: <DiscordLogo className="w-4 h-4" /> },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] transition-colors cursor-pointer text-left ${
                activeSection === item.id
                  ? 'bg-[#EFECE6] text-[#18181B] font-semibold'
                  : 'text-[#52525B] hover:bg-[#EFECE6]/50 hover:text-[#18181B]'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </aside>

        {/* Content Box */}
        <main className="md:col-span-9 bg-white border border-[#EAE9E4] rounded-2xl p-7 space-y-6">
          {activeSection === 'general' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[16px] font-semibold text-[#18181B]">Discord Account Details</h2>
                <p className="text-[12.5px] text-[#71717A]">
                  Connected via Discord OAuth to automatically verify server ownership and boost dividends.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8F7F4] border border-[#EAE9E4] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <AyushAvatar className="w-12 h-12" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[14px] text-[#18181B]">{user.name}</span>
                      <span className="px-2 py-0.5 rounded bg-[#DCFCE7] text-[#15803D] text-[10.5px] font-semibold flex items-center gap-1">
                        <span>Connected</span>
                        <Check className="w-3 h-3 text-[#15803D]" />
                      </span>
                    </div>
                    <p className="text-[12px] text-[#71717A] mt-0.5">@{user.username} · {user.email}</p>
                    <p className="text-[11px] text-[#A1A1AA] font-mono mt-0.5">Discord ID: {user.discordId}</p>
                  </div>
                </div>

                <button
                  onClick={onOpenDiscordLogin}
                  className="px-3.5 py-2 rounded-xl bg-white border border-[#E4E3DE] hover:bg-[#FAF9F6] text-[12px] font-medium text-[#18181B] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-sync Discord</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#52525B] mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    defaultValue={user.name}
                    className="w-full bg-[#F8F7F4] border border-[#EAE9E4] rounded-xl px-3.5 py-2 text-[13px] text-[#18181B]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#52525B] mb-1.5">
                    Default Currency Display
                  </label>
                  <select
                    value="USD"
                    disabled
                    className="w-full bg-[#F8F7F4] border border-[#EAE9E4] rounded-xl px-3.5 py-2 text-[13px] text-[#18181B] cursor-default opacity-90"
                  >
                    <option value="USD">USD ($ US Dollar)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'trading' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[16px] font-semibold text-[#18181B]">Trading Preferences</h2>
                <p className="text-[12.5px] text-[#71717A]">
                  Configure order execution rules, slippage protection, and interface confirmations.
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#52525B] mb-2">
                  Slippage Tolerance
                </label>
                <div className="flex items-center gap-2">
                  {(['0.1%', '0.5%', '1.0%', 'Custom'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSlippage(s)}
                      className={`px-4 py-2 rounded-xl text-[12px] font-medium border transition-colors cursor-pointer ${
                        slippage === s
                          ? 'bg-[#18181B] text-white border-[#18181B]'
                          : 'bg-white border-[#EAE9E4] text-[#52525B] hover:bg-[#F8F7F4]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="text-[11.5px] text-[#A1A1AA] mt-2">
                  Your order will revert if the stock price moves unfavorably by more than this percentage.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F8F7F4] border border-[#EAE9E4] cursor-pointer">
                  <div>
                    <p className="text-[13px] font-medium text-[#18181B]">Order Confirmation Dialog</p>
                    <p className="text-[11.5px] text-[#71717A]">
                      Show a summary modal before submitting orders exceeding $500
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={confirmOrders}
                    onChange={(e) => setConfirmOrders(e.target.checked)}
                    className="w-4 h-4 accent-[#18181B] cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {activeSection === 'payouts' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[16px] font-semibold text-[#18181B]">Cash & Wallet Payouts</h2>
                <p className="text-[12.5px] text-[#71717A]">
                  Earnings from rewarded server ads and stock dividends are paid out in USD directly to your registered destination.
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#52525B] mb-1.5">
                  Registered Wallet / Payout Address
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={upiInput}
                    onChange={(e) => setUpiInput(e.target.value)}
                    className="flex-1 bg-[#F8F7F4] border border-[#EAE9E4] rounded-xl px-3.5 py-2 text-[13px] font-mono text-[#18181B]"
                  />
                  <span className="text-[12px] text-[#10B981] font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Verified
                  </span>
                </div>
                <p className="text-[11px] text-[#A1A1AA] mt-1.5">
                  Supported: PayPal, Web3 USDC address, Bank IBAN, or UPI ID.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8F7F4] border border-[#EAE9E4] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-[#18181B]">Auto-Withdrawal</p>
                    <p className="text-[11.5px] text-[#71717A]">
                      Automatically disburse balance whenever earnings exceed $50
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoWithdraw}
                    onChange={(e) => setAutoWithdraw(e.target.checked)}
                    className="w-4 h-4 accent-[#18181B] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'discord' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[16px] font-semibold text-[#18181B]">Discord Bot Webhook Integration</h2>
                <p className="text-[12.5px] text-[#71717A]">
                  Send live trade notifications, price pump alerts, and dividend distribution logs directly to your Discord server channel.
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#52525B] mb-1.5">
                  Discord Channel Webhook URL
                </label>
                <input
                  type="text"
                  value={webhookInput}
                  onChange={(e) => setWebhookInput(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full bg-[#F8F7F4] border border-[#EAE9E4] rounded-xl px-3.5 py-2 text-[12.5px] font-mono text-[#18181B]"
                />
              </div>

              <button
                type="button"
                onClick={() => onTriggerToast('Sent test notification ping to your Discord channel!')}
                className="px-4 py-2 rounded-xl bg-white border border-[#E4E3DE] hover:bg-[#F8F7F4] text-[12px] font-medium text-[#18181B] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Test Webhook Ping</span>
              </button>
            </div>
          )}

          {/* Save Button */}
          <div className="pt-4 border-t border-[#EAE9E4] flex items-center justify-between">
            <span className="text-[11.5px] text-[#71717A]">Changes take effect immediately.</span>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-[#141416] hover:bg-[#27272A] text-white text-[13px] font-semibold cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};
