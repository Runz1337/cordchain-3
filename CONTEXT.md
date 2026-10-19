# CordChain — Living Active Project Context

> **Living Context File**
> **Maintained at:** [`plans/context.md`](file:///home/runner/workspace/plans/context.md) and [`CONTEXT.md`](file:///home/runner/workspace/CONTEXT.md)
> **Last Updated:** 2026-10-19
> **Status:** Redesign Complete & Verified — 100% Fantasy $CRED Economy & CordLedger Engine

---

## 1. Project Vision & Architecture Paradigm Shift

**CordChain** is a Discord-native fantasy stock exchange where every Discord community has a tradable stock ticker (`$CORDC`, `$SQUAD`, `$CODE`, etc.) backed by constant-product AMM liquidity pools and community fundamentals.

### The Redesign: Dropping Blockchain for "CordLedger"
External EVM testnets, MetaMask popups, gas fees, and wallet friction have been replaced by **CordLedger**: a local, append-only, SHA-256 hash-chained ledger.

> [!NOTE]
> **Tamper-Evident, Not Trustless:** Because the platform runs the central server, CordLedger is mathematically *tamper-evident*, not *tamper-proof*. If historical records were ever secretly altered, every downstream SHA-256 hash, Merkle root, and Ed25519 block signature would instantly break.

---

## 2. The 6-Section Redesign Blueprint & Deliverables

### Section 1: The CordLedger Engine
- **Append-Only Hash Chain:** Every event (`IPO`, `TRADE_BUY`, `TRADE_SELL`, `ALLOWANCE`, `DAILY_BONUS`, `WEEKLY_EARNINGS`, `VESTING_UNLOCK`) is a row in PostgreSQL with `prev_hash` linked to the previous row's SHA-256 hash.
- **Postgres WORM Guard:** Enforced via `trg_cord_ledger_worm` trigger blocking `UPDATE` and `DELETE` on historical entries.
- **Periodic 1-Minute Block Producer:** `_block_producer_loop()` in [`cordchain/api.py`](file:///home/runner/workspace/cordchain/api.py) groups unmined entries into blocks with pairwise SHA-256 Merkle tree roots and Ed25519 signatures.
- **Public Explorer ("CordScan"):** Live at `/scan` in [`CordScanView.tsx`](file:///home/runner/workspace/artifacts/cordchain-ui/src/components/CordScanView.tsx) with token explorers, holders lists, block headers, and live transaction receipts.
- **Client-Side Hash Verification:** "Verify Ledger" button runs an in-browser audit (`verifyLedgerInBrowser()`).
- **Daily Checkpoints:** Daily hash checkpoint exportable via `/api/ledger/checkpoint` for posting to Discord/GitHub.
- **Cryptographic Audit CLI:** [`scripts/verify_cordchain.py`](file:///home/runner/workspace/scripts/verify_cordchain.py) verifies entry hashes, chain linkage, Merkle roots, and Ed25519 signatures independently.

### Section 2: Simplified Economy ($CRED Only)
- **One Currency:** `$CRED` only. All real-money fiat (`₹ INR`, `USD`), AdSense monetization, and UPI cashouts are removed.
- **Starter Allowance:** 1,000 `$CRED` granted automatically to every new trader on first visit (`ensure_user`).
- **Daily Login Bonus:** 50 `$CRED` claimable once per calendar day via `POST /api/wallet/claim-allowance` (wired to Web UI modal & bot).
- **Daily Earn Cap:** 250 `$CRED` maximum daily boost earnings to prevent grinding from dominating.
- **Fixed Supply per Server:** Exactly **1,000,000 shares** per server, enabling clean cross-server market cap comparison (`Price × 1,000,000`).
- **Balanced Reserve Split & Ledger-Enforced Vesting:**
  - **75% Public Float (750,000 shares):** Seeded into the AMM pool for liquid trading.
  - **25% Creator Reserve (250,000 shares):**
    - 50,000 shares (5%) unlocked at IPO.
    - 200,000 shares (20%) locked under monthly vesting: releases 50,000 shares (5%) every 30 days via `POST /api/guilds/:id/vesting-unlock`, logging `VESTING_UNLOCK` to CordLedger.

### Section 3: Two-Layer Pricing & Market Defenses
- **Layer 1 — Market Price (AMM Trading):**
  - Constant-product pool ($x \cdot y = k$) alongside order books guarantees instant execution for both micro-servers and mega-servers.
  - Formula: Spot price = $\frac{\text{Pool CRED}}{\text{Pool Shares}}$.
- **Layer 2 — Fair Value Fundamentals (Fantasy Dividends):**
  - Weekly Earnings Report translates the server's Community Score into fantasy `$CRED` payouts distributed to shareholders ([`calculate_weekly_earnings`](file:///home/runner/workspace/cordchain/pricing.py#L183-L205)).
  - Implied Fair Value calculated using a 10% capitalization rate: $\text{Fair Value} = \frac{\text{Annual Dividend per Share}}{0.10}$.
- **Market Microstructure Defenses:**
  - **Circuit Breaker:** Trading pauses for 30 minutes if a stock swings $\ge 20\%$ within a 15-minute window ([`check_circuit_breaker`](file:///home/runner/workspace/cordchain/pricing.py#L78-L136)).
  - **Position Concentration Limit:** Max 10% of total server supply (100,000 shares) per account ([`check_position_limit`](file:///home/runner/workspace/cordchain/pricing.py#L138-L152)).
  - **Wash-Trade Protection:** Rejects opposing buy/sell flips executed within 60 seconds ([`check_wash_trade`](file:///home/runner/workspace/cordchain/pricing.py#L154-L179)).

### Section 4: Bot-Resistant Community Score
Implemented in [`cordchain/anti_cheat.py`](file:///home/runner/workspace/cordchain/anti_cheat.py):
$$\text{Score} = \left(\sqrt{\text{Unique Chatters}} \times 12 \times W_{\text{spread}} \times W_{\text{retention}} \times (1 + B_{\text{growth}}) + B_{\text{voice}}\right) \times \text{Age Factor}$$
1. **Unique Active Chatters:** Scaled with square root ($\sqrt{N}$); raw message spam capped at 25 messages/user/day.
2. **Retention Rate ($W_{\text{retention}}$):** Percentage of last week's active chatters that returned this week.
3. **Conversation Spread ($W_{\text{spread}}$):** Normalized Shannon entropy across the chatter distribution (many participants chatting beats 3 users flooding 10,000 messages).
4. **Voice Minutes & Account Age:** Secondary bonus for voice participation; snowflake age filter penalizes burner accounts under 14 days old.
5. **Growth vs. Baseline ($B_{\text{growth}}$):** Compares engagement against the server's own rolling history, enabling a doubling 200-member community to outscore a stagnant 100,000-member server.
6. **Leagues by Size:**
   - 🥉 **Bronze League:** 15 to 200 members.
   - 🥈 **Silver League:** 201 to 2,000 members.
   - 🥇 **Gold League:** 2,001+ members.
7. **Strict Privacy:** Zero message content stored. All activity metrics operate strictly on hashed Discord IDs ([`hash_discord_id`](file:///home/runner/workspace/cordchain/anti_cheat.py#L22-L24)) and integer aggregates.

### Section 5: Discord-Native Social Mechanics & Clean Embeds
- **House Embed Style:** Preserves `INK_COLOR = 0x252429` with deep neutral aesthetic across all 24 commands.
- **Weekly Earnings Reports:** `/earnings <ticker>` command and weekly automated announcements detailing shareholder payouts.
- **Seasons & Hall of Fame:** `/seasons` command showing 30-day competitive seasons, dates, and Hall of Fame champions (`/api/seasons`).
- **Server vs. Server Rivalries:** `/rivalry` command showing weekly derby competitions between paired communities (`/api/rivalries`).
- **Community Quests:** `/quests` command displaying collaborative objectives (e.g., reaching 50 unique chatters) boosting Community Score (`/api/quests`).
- **Prediction Markets:** `/predictions` command for fantasy `$CRED` wagering on server milestones (`/api/predictions`).
- **Verified Receipts:** Trade execution embeds contain canonical CordLedger transaction hashes linking to CordScan receipts.

### Section 6: Technical Architecture & Running Services
- **Backend API:** Python FastAPI in [`cordchain/api.py`](file:///home/runner/workspace/cordchain/api.py) on port `5000` (`./run_api.sh`).
- **Discord Bot:** Pokétwo-style `AutoShardedBot` in [`cordchain/bot.py`](file:///home/runner/workspace/cordchain/bot.py) + 7 cogs in [`cordchain/cogs/`](file:///home/runner/workspace/cordchain/cogs/) (`./run_bot.sh`).
- **Web Terminal:** React 19 + Vite 8 + Tailwind 4 in [`artifacts/cordchain-ui`](file:///home/runner/workspace/artifacts/cordchain-ui) on port `3000` (`./run_web.sh`).
- **Database:** PostgreSQL with `cord_ledger` (hash chain) and `cord_blocks` (Merkle + Ed25519).

---

## 3. Progress Scorecard

| Area | Status | Deliverables |
| :--- | :---: | :--- |
| **CordLedger Core Engine** | 🟢 100% | Append-only hash chain, WORM trigger, pairwise Merkle root blocks, Ed25519 signing. |
| **Cryptographic Verifier CLI** | 🟢 100% | `scripts/verify_cordchain.py` passes 100% with Ed25519 signature checks. |
| **CordScan Web Explorer** | 🟢 100% | Live at `/scan` with block browsing, entry inspection, and in-browser verify button. |
| **$CRED Fantasy Economy** | 🟢 100% | Cashouts disabled; starter grant (1,000 CRED) and daily login bonus (+50 CRED) active. |
| **Fixed Supply & Vesting** | 🟢 100% | 1M shares, 75% float, 25% creator reserve, monthly 5% vesting unlock endpoint active. |
| **Two-Layer AMM & Fundamentals** | 🟢 100% | $x \cdot y = k$ pool, fair value yield calculations, circuit breakers, wash-trade guards. |
| **Bot-Resistant Community Score** | 🟢 100% | Shannon entropy, square-root chatter scaling, retention, and growth metrics active. |
| **Discord Bot Commands & Embeds** | 🟢 100% | All 24 commands active (`/quests`, `/seasons`, `/predictions`, `/rivalry`, `/earnings`, `/buy`, etc.) inked #252429. |
| **Web UI Cleanup** | 🟢 100% | Tokenize modal & Action modals updated to CordLedger & pure $CRED; builds in 1.2s. |
| **Periodic 1-Min Block Producer** | 🟢 100% | Background loop in FastAPI sealing unmined entries into blocks every 60s. |
| **Interactive Project Guide (/guide)** | 🟢 100% | Full 8-section interactive guide view at `/guide` in Web UI + revised [`PROJECT_GUIDE.md`](file:///home/runner/workspace/PROJECT_GUIDE.md). |
| **Browser Audit & Hash Parity** | 🟢 100% | Solved JSON float serialization disparity (IEEE 754 vs Python dumps) & entryIndex sorting; browser verifier 100% passes. |
| **Purged All Base Sepolia Mentions** | 🟢 100% | Complete eradication of Base Sepolia & BaseScan in Exchange UI, TopBar, and modals. |
| **Clean Token Database Reset** | 🟢 100% | Truncated tokens, trade history, and test records; clean Genesis Block #0 ready for fresh user token creation. |
