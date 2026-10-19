# CordChain Master Planning Hub

Welcome to the **CordChain** master planning directory. This directory contains the architectural blueprints, mathematical specifications, implementation subplans, active project context, and living progress tracker for building the entire CordChain fantasy stock exchange and CPA ad-dividend platform.

---

## 🗂️ Planning Navigation

| Document | Purpose & Scope | Status |
|---|---|---|
| **[`context.md`](file:///home/runner/workspace/plans/context.md)** | **Living Context File:** Current state, system vision, domain models, mathematical equations, anti-cheat rules, and active priorities. Consult before creating or editing code files. | 🟢 Active |
| **[`progress.md`](file:///home/runner/workspace/plans/progress.md)** | **Living Progress Tracker:** Phase-by-phase completion checklist, overall status metric, activity logs, and decision records. Update continuously as work progresses. | 🟢 Active |
| **[`01-architecture-and-data-model.md`](file:///home/runner/workspace/plans/01-architecture-and-data-model.md)** | **Phase 1: Database & Data Models:** PostgreSQL Drizzle schemas for all 7 tables, Zod validators, OpenAPI 3.1 specifications, migrations, and deterministic seed script. | 📋 Ready |
| **[`02-anti-cheat-and-pricing-engine.md`](file:///home/runner/workspace/plans/02-anti-cheat-and-pricing-engine.md)** | **Phase 2: Anti-Cheat & Pricing Engine:** Bayesian smoothing formula, tanh AMM volume damping, and the 5-layer anti-cheat pipeline (Snowflake, Ghost Kick, 1-Drop Cap, Proof-of-Attention, UPI Deduplication). | 📋 Ready |
| **[`03-backend-api-and-cron.md`](file:///home/runner/workspace/plans/03-backend-api-and-cron.md)** | **Phase 3: Backend API & Crons:** Express 5 REST endpoints (auth, check-in, order execution, wallets, cashouts) and scheduled cron workers (hourly price update, midnight UTC reset, 7d peak sync). | 📋 Ready |
| **[`04-discord-bot-and-activity-integration.md`](file:///home/runner/workspace/plans/04-discord-bot-and-activity-integration.md)** | **Phase 4: Discord Bot Client:** Discord.js bot, slash commands (`/register-server`, `/boost`, `/portfolio`, `/leaderboard`), automated daily rich embeds, and member scanning. | 📋 Ready |
| **[`05-embedded-app-ui.md`](file:///home/runner/workspace/plans/05-embedded-app-ui.md)** | **Phase 5: 3-Screen Trading Terminal UI:** Discord Embedded App SDK frontend: Screen 1 (Daily Boost & Attention Quiz), Screen 2 (Live Exchange Floor), Screen 3 (Dual Wallet & Sponsor Portal). | 📋 Ready |
| **[`06-payments-payouts-and-b2b.md`](file:///home/runner/workspace/plans/06-payments-payouts-and-b2b.md)** | **Phase 6: Payments, Payouts & B2B:** Discord Native SKU (VIP Pass), Razorpay B2B advertiser deposit webhooks, automated UPI cashout pipeline, and double-entry ledger audits. | 📋 Ready |
| **[`07-testing-deployment-and-launch.md`](file:///home/runner/workspace/plans/07-testing-deployment-and-launch.md)** | **Phase 7: Testing, Simulation & Rollout:** Market simulation scripts, anti-cheat penetration test suite, local browser mock runner, deployment runbooks, and 14-day launch playbook. | 📋 Ready |

---

## ⚙️ Workflow Protocol Before Building Files

Before creating or editing implementation files:
1. **Check [`plans/context.md`](file:///home/runner/workspace/plans/context.md):** Review current system constraints, formulas, active priorities, and shared types.
2. **Review the Target Subplan:** Follow the specific implementation steps and acceptance criteria outlined in the relevant subplan (`01` through `07`).
3. **Execute & Test:** Implement the code, run typechecks (`pnpm run typecheck`), build checks, and relevant unit/integration tests.
4. **Update [`plans/progress.md`](file:///home/runner/workspace/plans/progress.md):** Check off finished items, update the overall completion percentage, and log the action in the Activity Log.
5. **Record Architectural Changes:** If any unexpected edge case requires altering a formula, schema, or route, document it immediately in [`plans/context.md`](file:///home/runner/workspace/plans/context.md) and [`replit.md`](file:///home/runner/workspace/replit.md).
