# CordChain Progress Tracker

> **Living Progress Document**
> Last Updated: 2026-10-18
> Status: Web UI Integrated — Phases 1, 3, 4 Complete & Phase 5 Live

---

## Overall Status Summary

| Metric | Status |
|---|---|
| **Current Phase** | Phase 5 (Embedded App Web UI) LIVE · Phase 6 (Payments) Next |
| **Overall Completion** | 80% |
| **Active Blockers** | None |
| **Health** | 🟢 On Track |

---

## Phase Breakdown & Milestone Checklist

### Phase 0: Project Architecture & Execution Planning
- [x] Read and analyze [`Mvp.md`](file:///home/runner/workspace/Mvp.md) specifications.
- [x] Inspect existing workspace monorepo structure (pnpm, Drizzle, OpenAPI, Express, React sandbox).
- [x] Create dedicated [`plans/`](file:///home/runner/workspace/plans) directory.
- [x] Establish [`plans/context.md`](file:///home/runner/workspace/plans/context.md) for maintaining active architecture, formulas, and domain rules.
- [x] Establish [`plans/progress.md`](file:///home/runner/workspace/plans/progress.md) for continuous progress tracking.
- [x] Author comprehensive modular subplans (01 through 07) covering every subsystem.
- [x] Author [`plans/README.md`](file:///home/runner/workspace/plans/README.md) as master index and workflow guide.

---

### Phase 1: Database Schema & Core Data Models ([Subplan 01](file:///home/runner/workspace/plans/01-architecture-and-data-model.md))
- [x] PostgreSQL schema live (`guilds`, `users`, `holdings`, `ad_campaigns`, `checkin_logs`, `trade_transactions`, `withdrawals`) reachable via `DATABASE_URL` through `cordchain/db.py` (pg8000).
- [x] Seed data: 9 guilds across all 4 league tiers, ad campaigns with attention questions.
- [x] FastAPI + pg8000 persistence layer (Python path) in [`cordchain/api.py`](file:///home/runner/workspace/cordchain/api.py) / [`cordchain/db.py`](file:///home/runner/workspace/cordchain/db.py).

---

### Phase 2: Anti-Cheat & Mathematical Pricing Engine ([Subplan 02](file:///home/runner/workspace/plans/02-anti-cheat-and-pricing-engine.md)) — **LIVE in MVP form**
- [x] Snowflake age decoder + <30d paid-drop rejection (`cordchain/anti_cheat.py`, verified in checkin endpoints).
- [x] Global daily validator: max 3 boosts/$CRED, 1 paid ₹ drop/day (enforced in `/api/checkin/*`).
- [x] Randomized proof-of-attention quiz (server-side option shuffle returned per initiate call).
- [x] Salted HMAC-SHA-256 UPI hash + masking (Filter 5, live in `/api/wallet/cashout`).
- [x] Boost price momentum (+0.8%/verified boost) writing back to `guilds.stock_price`.
- [ ] Hourly Bayesian cron job (As smoothing + tanh AMM full re-pricing) — momentum model in production meanwhile.

---

### Phase 3: Backend API Server & Web Features MVP ([Subplan 03](file:///home/runner/workspace/plans/03-backend-api-and-cron.md)) — **COMPLETE (Python/FastAPI flavor)**
- [x] `GET /api/healthz`, `GET /api/guilds` (tier/sort/search), `GET /api/guilds/featured`, `GET /api/guilds/:id`.
- [x] `POST /api/checkin/initiate` & `POST /api/checkin/verify` (3-boost cap, 30d snowflake gate, ₹3.50 user / ₹1.00 owner / ₹1.50 platform split).
- [x] `POST /api/trade/quote`, `POST /api/trade/buy`, `POST /api/trade/sell` (holding avg-price math, circulating share updates, trade ledger).
- [x] `GET /api/wallet/summary` (auto creates new traders with the 10,000 $CRED season grant), `POST /api/wallet/cashout` (₹100 min, UPI hash dedupe).
- [x] `GET /api/campaigns`, `POST /api/campaigns/create` (₹500 min self-serve B2B deposit).
- [x] `GET /api/leaderboard/traders` & `GET /api/leaderboard/servers` (added 2026-10-18 to power the UI leaderboards).
- [x] CORS wide-open for the embedded iframe, Swagger at `/docs`, OpenAPI at `/openapi.json`.

---

### Phase 4: Discord Bot Client & Pokétwo-Style Sharded Cogs Architecture ([Subplan 04](file:///home/runner/workspace/plans/04-discord-bot-and-activity-integration.md))
- [x] Subclass `commands.AutoShardedBot` for automatic Discord gateway sharding capable of scaling to hundreds of thousands of servers.
- [x] Integrate high-performance `asyncpg` connection pool with 5-20 connection limits to prevent blocking gateway heartbeats.
- [x] Dynamic modular cog loader scanning and registering all extensions in [`cordchain/cogs/`](file:///home/runner/workspace/cordchain/cogs/):
  - [x] [`cogs/server.py`](file:///home/runner/workspace/cordchain/cogs/server.py) (`/register-server`, `/stats`, anti-ghost-kick member listeners)
  - [x] [`cogs/boost.py`](file:///home/runner/workspace/cordchain/cogs/boost.py) (`/boost`, persistent `BoostButtonView`, 1-paid-drop cap, 3-boost daily limit)
  - [x] [`cogs/trading.py`](file:///home/runner/workspace/cordchain/cogs/trading.py) (`/buy`, `/sell`, `/quote`, atomic stock market transactions)
  - [x] [`cogs/profile.py`](file:///home/runner/workspace/cordchain/cogs/profile.py) (`/portfolio`, `/leaderboard`, fantasy net worth & cash vault)
  - [x] [`cogs/admin.py`](file:///home/runner/workspace/cordchain/cogs/admin.py) (`/shards`, `/ping`, `/sync-commands`, shard cluster diagnostics)
- [x] Shard lifecycle monitoring (`on_shard_ready`, `on_shard_resumed`, `on_shard_disconnect`).
- [x] Centralized Pokétwo-style error handling (`on_app_command_error`) for cooldowns, permissions, and exceptions.
- [+] Runtime requires `TOKEN`/`DISCORD_TOKEN` (present in env) — gateway key is available.

---

### Phase 5: Embedded App Web UI ([Subplan 05](file:///home/runner/workspace/plans/05-embedded-app-ui.md)) — **LIVE @ artifacts/cordchain-ui**
- [x] Integrated `cordchain-ui-replicator (1).zip` (AI Studio replica UI) as the working web terminal at
      [`artifacts/cordchain-ui`](file:///home/runner/workspace/artifacts/cordchain-ui) (React 19 + Vite 8 + Tailwind 4 + motion).
- [x] Typed live backend client [`src/lib/api.ts`](file:///home/runner/workspace/artifacts/cordchain-ui/src/lib/api.ts) — checks/every endpoint from `cordchain/API_DOCS.md`, demo-user context via env, API-error mapping.
- [x] Graceful degradation: falls back to bundled demo data + **BACKEND OFFLINE** chip when FastAPI is unreachable.
- [x] Top bar with live $CRED + ₹ wallet chips, API status dot, sync timestamp.
- [x] Landing, Dashboard, Manage, Exchange, Wallet, Leaderboard, Portfolio, Settings, Login views all fed by live data (server assets mapped from `/api/guilds`, featured IPO carousel from `/api/guilds/featured`, holdings overlay from `/api/wallet/summary`).
- [x] **Screen 1 boost flow** in [`ActionModals.tsx`](file:///home/runner/workspace/artifacts/cordchain-ui/src/components/ActionModals.tsx): initiate → sponsor media card + countdown (anti-macro unlock) → shuffled attention quiz → canvas-confetti success state (+250 $CRED, +₹3.50) / failure cooldown state. Same flow powers "Watch Sponsored Ad".
- [x] **Screen 2 exchange**: real-time guild list + candles regenerating around the live price (`generateCandles` ends exactly at spot), order book/trade feed hydration per ticker, BUY/SELL wired to `/api/trade/quote|buy|sell` with error toasts; VIP upsell banner intact.
- [x] **Screen 3 wallet**: ₹100 withdrawal progress bar + remaining check-ins badge, holdings table with avg buy & unrealized PnL from the API, UPI cashout modal → `/api/wallet/cashout`, self-serve sponsor campaign wizard (question/wrong answers/budget chips ₹500-₹2.5k) → `/api/campaigns/create`.
- [x] Leaderboards wired to the two new endpoints with graceful mock fallback.
- [x] Typecheck (`tsc --noEmit`) and production build (`vite build`) both green.
- [ ] Discord `@discord/embedded-app-sdk` iframe handshake (currently browser mock user; SDK wiring prerequisite for real Discord deployment).

---

### Phase 6: Payments, Payouts & B2B Monetization ([Subplan 06](file:///home/runner/workspace/plans/06-payments-payouts-and-b2b.md))
- [ ] Discord Native SKU integration (`startPurchase` for VIP Pass).
- [ ] Razorpay checkout integration for B2B advertiser deposits (UI campaign wizard posts directly today; real gateway capture pending).
- [ ] Webhook listener for Razorpay payment captures with HMAC-SHA256 signature verification.
- [ ] Automated payout queue worker for verified UPI withdrawals (table inserts with PENDING status today).
- [ ] Financial audit ledger preventing negative balances or double-claims.

---

### Phase 7: Verification, Simulation & MVP Launch ([Subplan 07](file:///home/runner/workspace/plans/07-testing-deployment-and-launch.md))
- [ ] Market simulation script (simulating 100 users trading 20 servers over 30 days).
- [ ] Anti-cheat penetration test suite (simulating bot alt-farms, ghost kicks, rapid clickers).
- [ ] Discord Embedded App local testing harness (browser simulation currently running without live Discord client).
- [ ] Staging deployment runbook and seed configurations.
- [ ] 14-day zero-cost cold-start playbook execution.

---

## Activity Log

| Date (UTC) | Action | Result | Notes |
|---|---|---|---|
| 2026-10-15 13:00 | Workspace Analysis & MVP Ingestion | Success | Reviewed `Mvp.md` and repository setup |
| 2026-10-15 13:02 | Created `plans/` structure & `context.md` | Success | Standardized living context and domain rules |
| 2026-10-15 13:05 | Created `plans/progress.md` | Success | Initialized phase tracking checklist |
| 2026-10-15 13:10 | Created Subplans 01 to 07 and `README.md` | Success | Completed Phase 0 planning |
| 2026-10-15 13:20 | Phase 1-3 built (schema, seed, FastAPI, bot cogs) | Success | Python flavor of the stack went live |
| 2026-10-18 19:10 | Integrated `cordchain-ui-replicator` zip → `artifacts/cordchain-ui` | Success | Full 3-screen terminal wired to live API |
| 2026-10-18 19:25 | Added `/api/leaderboard/traders` & `/api/leaderboard/servers`, ensure-user wallet bootstrap | Success | Backfills UI leaderboard + first-visit wallets |
| 2026-10-18 19:30 | E2E test: initiate→verify(+250 CRED/+₹3.50)→quote→buy→sell→cashout-guard→campaign-create | Success | All flows green via curl-level smoke test |
| 2026-10-18 19:35 | tsc + vite build green; dev server on :3000 serving live-data UI | Success | Offline fallback chip validated |
