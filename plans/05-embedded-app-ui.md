# Subplan 05: Embedded App 3-Screen Trading Terminal UI

> **Phase 5 Execution Plan**
> Target Package: [`artifacts/mockup-sandbox`](file:///home/runner/workspace/artifacts/mockup-sandbox) / Discord Embedded App Client
> Status: Ready for Execution

---

## 1. Objectives

1. Build a high-performance, dark cyber-fintech trading terminal loaded inside Discord's iframe on Desktop and Mobile via `@discord/embedded-app-sdk`.
2. Construct the 3 core screens defined in [`Mvp.md`](file:///home/runner/workspace/Mvp.md):
   - **Screen 1:** 15-Second Daily Boost Modal (Attention Quiz + Dopamine Burst)
   - **Screen 2:** Live Exchange Floor (Leagues, IPO Banner, Ticker List, Buy/Sell Drawer)
   - **Screen 3:** Dual Wallet & Sponsor Portal (Fantasy Rank, UPI Vault, B2B Self-Serve Ad Portal)
3. Provide a browser-friendly Mock SDK Provider for instant local development without needing an active Discord client.

---

## 2. Visual Design & Shell Architecture

- **Theme & Aesthetic:** High-contrast Dark Cyber-Exchange:
  - Backgrounds: Dark Obsidian (`#0b0e14`, `#121721`), border highlights (`#1e293b`).
  - Accents: Neon Green (`#10b981`) for gains/boosts, Electric Purple (`#8b5cf6`) for VIP/Sponsors, Cyber Cyan (`#06b6d4`) for stats.
- **Top Bar Component:**
  - Discord User Avatar + Username.
  - Active League Badge (Squad / Club / Arena / Titan).
  - Live `$CRED` Wallet Chip with pulsated balance updates.
- **Bottom Navigation Bar:**
  - Tab 1: `⚡ Daily Boost`
  - Tab 2: `📈 Exchange Floor`
  - Tab 3: `💳 Dual Wallet`

---

## 3. Screen 1: The "15-Second Daily Boost" Modal

### Layout & Elements
1. **Sponsor Creative Card:**
   - 12-second countdown linear progress bar with visual timer (`12s ... 0s`).
   - Rich media container (video clip or promotional banner for a partner Discord server/app).
2. **Interactive Proof-of-Attention Quiz:**
   - Appears once the countdown hits zero.
   - Question header (e.g. *"Which feature was highlighted in the showcase?"*).
   - 3 shuffled, randomized option buttons with instant touch/click feedback.
3. **Dopamine Explosion State (On Correct Answer):**
   - Fullscreen confetti burst (`canvas-confetti`).
   - Sound effect triggers (chime/cash register).
   - Glowing reward breakdown cards:
     - `"$SQUAD Stock Boosted +1.4%!"` (Ticker rally meter)
     - `"+250 Free $CRED added to Trading Wallet"`
     - `"+₹3.50 Real Cash Dividend added to UPI Wallet"` (or `"Fantasy Boost Only"` if daily paid cap reached).
4. **Cooldown / Error State (On Wrong Answer):**
   - Red warning card with explanation.
   - 1-hour cooldown countdown timer before next attempt.

---

## 4. Screen 2: The Live Exchange Floor

### Layout & Elements
1. **League Selector Pills:**
   - `[Squad League]` | `[Club League]` | `[Arena League]` | `[Titan League]`
   - Displays server count and current average activity score.
2. **Featured IPO Banner (Paid Promotion Slot):**
   - Carousel of top 3 promoted servers.
   - Server icon, bio, and glowing button: `⚡ Join Server (+50 $CRED Bonus)`.
3. **Live Stock Market Table / Card List:**
   - Server icon & `$TICKER` (e.g. `$CODE`).
   - Server Name & League Tier.
   - Current Price in `$CRED`.
   - 24-Hour Percentage Change badge (emerald green `+5.8%` or coral red `-3.2%`).
   - Bayesian Activity Meter (visual bar showing verified check-in ratio).
   - Quick Action buttons: `[BUY]` / `[SELL]`.
4. **Interactive Buy/Sell Slide-Over Drawer:**
   - Real-time quote preview.
   - Share quantity slider (with 25%, 50%, 75%, MAX quick buttons).
   - Total `$CRED` required / payout.
   - Estimated price impact / slippage notice.
   - Confirm Trade CTA button.
5. **VIP Pro-Tool Upsell:**
   - Below the Buy button:
     > *"Set Auto-Sell Stop-Loss while you sleep 🔒 (Unlock with VIP Pass — ₹199/mo)"*
   - Clicking triggers `discordSdk.commands.startPurchase({ sku_id: 'CORDCHAIN_VIP' })`.

---

## 5. Screen 3: The Dual Wallet & Sponsor Portal

### Layout & Elements
1. **Left Card: Season Rank & Fantasy Net Worth:**
   - `$CRED` Cash + Stock Holdings Net Worth.
   - Leaderboard position: e.g. `#14 in Squad League`.
   - Season Countdown Clock: `18 Days 4 Hours Remaining`.
2. **Right Card: Real Cash Dividend Vault:**
   - Current Withdrawable Cash Balance: e.g. `₹68.50`.
   - Withdrawal threshold bar: `₹68.50 / ₹100.00 Minimum`.
   - Encouragement badge: *"9 more daily check-ins to unlock instant UPI cashout!"*
   - **`[Withdraw to UPI]` Button:**
     - Opens withdrawal modal.
     - Input field for UPI VPA (e.g. `user@okhdfcbank`).
     - Real-time format validation.
     - Security notice regarding 1-to-1 account binding (deduplication warning).
3. **Bottom Card: B2B Self-Serve Sponsor Portal:**
   - Card Banner: *"Advertise Your Server or App — From ₹500"*
   - Opens self-serve campaign wizard:
     - Upload promotional media URL.
     - Enter 1 verification question + 1 correct answer + 2 wrong answers.
     - Select budget (₹500 / ₹1,000 / ₹2,500).
     - Razorpay 1-click payment checkout button.

---

## 6. Acceptance Criteria
- [ ] Responsive layout adapts flawlessly to mobile and desktop Discord iframe sizes.
- [ ] Proof-of-attention 12-second countdown and randomized buttons function smoothly.
- [ ] Confetti animation and celebration state trigger reliably upon boost completion.
- [ ] Buy/Sell drawer submits orders and updates balances in real-time via React Query.
- [ ] UPI cashout modal validates VPA and displays progress bar.
- [ ] Local browser mock environment works without Discord Embedded App SDK runtime errors.
