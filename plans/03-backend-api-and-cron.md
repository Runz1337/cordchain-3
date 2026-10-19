# Subplan 03: Backend API Server & Scheduled Crons

> **Phase 3 Execution Plan**
> Target Package: [`artifacts/api-server`](file:///home/runner/workspace/artifacts/api-server)
> Status: Ready for Execution

---

## 1. Objectives

1. Build production-grade REST API endpoints in [`artifacts/api-server`](file:///home/runner/workspace/artifacts/api-server) powering the Discord Embedded App client.
2. Implement secure Discord OAuth2 token verification and authenticated user sessions.
3. Build the core trading execution engine with atomic balance updates and race-condition safety.
4. Set up background cron workers for hourly price ticks, midnight UTC daily resets, and 30-day season rollovers.

---

## 2. API Endpoints Specification

### A. Authentication & User Profile
- `POST /api/auth/session`
  - Body: `{ code: string }` (Discord OAuth2 code from `@discord/embedded-app-sdk`)
  - Exchanges code with Discord API for access token and user identity.
  - Decodes Snowflake ID for account age verification.
  - Upserts user record in `users` table.
  - Returns JWT session token and user profile.

### B. Exchange & Guilds
- `GET /api/guilds`
  - Query: `tier?: 1|2|3|4, sort?: 'gain'|'activity'|'price', search?: string`
  - Returns paginated list of listed servers with 24h percentage change, ticker, stock price, and activity score.
- `GET /api/guilds/featured`
  - Returns currently promoted IPO servers (`is_promoted_until > now()`).
- `GET /api/guilds/:guildId`
  - Returns detailed server profile, historical price candles (24h/7d), circulating shares, and current activity status.

### C. Daily Boost & Check-In
- `POST /api/checkin/initiate`
  - Auth required.
  - Body: `{ guildId: string }`
  - Validates user has not exceeded 3 boosts for today.
  - Determines if user qualifies for real cash drop (`last_paid_checkin_date < todayUTC` AND `accountAge >= 30d`).
  - Fetches an active sponsor ad campaign from `ad_campaigns`.
  - Creates an in-memory / Redis signed session nonce with shuffled options and timestamp.
  - Returns creative media URL, title, description, and shuffled choice array (without revealing correct option).
- `POST /api/checkin/verify`
  - Auth required.
  - Body: `{ sessionId: string, selectedOption: string }`
  - Validates session timing ($10\text{s} \le \text{elapsed} \le 90\text{s}$).
  - Verifies answer.
  - In a database transaction:
    - Increments user's `cred_balance` (+250 `$CRED`).
    - If paid drop: increments `cash_wallet_inr` (+₹3.50), guild owner's `owner_cash_wallet_inr` (+₹1.00), deducts ad budget.
    - Inserts immutable `checkin_logs` record.
    - Increments guild's daily check-in counter.
  - Returns reward breakdown and updated wallet balances.

### D. Stock Trading
- `GET /api/trade/quote`
  - Query: `{ guildId: string, action: 'BUY'|'SELL', shares: number }`
  - Calculates estimated `$CRED` cost or payout including price impact slippage.
- `POST /api/trade/buy`
  - Auth required.
  - Body: `{ guildId: string, shares: number }`
  - Atomic transaction:
    - Checks `cred_balance >= total_cost`.
    - Deducts `$CRED` from user.
    - Upserts `holdings` (increments shares, recalculates weighted `avg_buy_price`).
    - Increments guild's `circulating_shares`.
    - Logs `trade_transactions`.
- `POST /api/trade/sell`
  - Auth required.
  - Body: `{ guildId: string, shares: number }`
  - Atomic transaction:
    - Checks user owns at least `shares`.
    - Deducts shares from `holdings`.
    - Credits `$CRED` to user.
    - Decrements guild's `circulating_shares`.
    - Logs `trade_transactions`.

### E. Wallet & Cashouts
- `GET /api/wallet/summary`
  - Auth required.
  - Returns `$CRED` balance, real cash balance (`cash_wallet_inr`), season leaderboard rank, portfolio net worth, and days remaining in the 30-day season.
- `POST /api/wallet/cashout`
  - Auth required.
  - Body: `{ upiVpa: string, amountInr: number }`
  - Validates `amountInr >= 100.00` and `cash_wallet_inr >= amountInr`.
  - Computes salted SHA-256 `upi_hash`.
  - Checks if `upi_hash` is already registered to a different `discord_id`.
  - Atomically locks balance and inserts record into `withdrawals`.

---

## 3. Scheduled Cron Workers

We implement standard Node.js schedule workers or cron tasks in `artifacts/api-server/src/workers/`:

1. **Hourly Price Ticker Worker (Every hour at :00):**
   - Fetches all active guilds grouped by league tier.
   - Calculates league average activity $\bar{A}_{\text{league}}$.
   - Computes net trading volume $V_{\text{net}}$ over trailing 24 hours.
   - Computes $P_{\text{new}}$ using the Bayesian and $\tanh$ formula.
   - Updates `guilds.stock_price` and logs to `price_history`.
2. **Midnight UTC Daily Reset Worker (00:00 UTC):**
   - Resets daily check-in counters across all servers.
   - Resets `users.daily_boost_count = 0`.
3. **Rolling 7-Day Peak Worker (Every 6 hours):**
   - Recalculates `member_count_peak_7d` to keep high-water marks accurate.
4. **30-Day Season Reset Worker (1st of each month):**
   - Snapshots final season leaderboard.
   - Distributes seasonal awards to top traders.
   - Resets all users' `cred_balance` back to 10,000 `$CRED`.

---

## 4. Acceptance Criteria
- [ ] All endpoints implemented with strict Zod request/response validation.
- [ ] Atomic database transactions ensure no double-spending or currency dupe bugs.
- [ ] Price recalculation worker tested and verified against mock trading data.
- [ ] API server starts cleanly and passes all health and integration checks.
