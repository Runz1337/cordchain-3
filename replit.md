# CordChain

Cross-server fantasy stock exchange and Cost-Per-Action (CPA) ad-dividend network built on Discord's Embedded App SDK.

## Run & Operate

- `./run_bot.sh` — Run the Python Discord bot (`cordchain.bot`) using `process.env.TOKEN`
- `./run_api.sh` — Run the Python FastAPI web MVP server (`cordchain.api`) on port 5000
- `./run_web.sh` — Run the web trading terminal UI (`artifacts/cordchain-ui`, Vite dev) on port 3000
- `.venv/bin/python3 -m cordchain.seed` — Seed PostgreSQL with initial leagues, servers, and ad campaigns
- Required env: `TOKEN` (Discord bot token), `DATABASE_URL` (Postgres connection string)
- Optional env (web UI): `VITE_API_URL` (default `http://localhost:5000`), `VITE_DEMO_USER_ID` (browser mock user)

## Stack

- Web Trading Terminal: React 19 + Vite 8 + Tailwind 4 + motion (`artifacts/cordchain-ui`) — the working 3-screen UI
- Discord Bot: Python 3.14 + `discord.py` (`cordchain/bot.py`)
- Web Features Backend MVP: Python 3.14 + `fastapi` + `uvicorn` (`cordchain/api.py`)
- Database: PostgreSQL + `pg8000.native` (`cordchain/db.py`)
- Anti-Cheat: Python 3.14 (`cordchain/anti_cheat.py`)
- Monorepo: Node.js 24 + pnpm (for web frontend building)

## Where things live

- [`plans/`](file:///home/runner/workspace/plans) — Master planning directory
  - [`plans/context.md`](file:///home/runner/workspace/plans/context.md) — Source-of-truth living context for formulas, rules, and architecture
  - [`plans/progress.md`](file:///home/runner/workspace/plans/progress.md) — Living progress tracker and phase checklists
  - [`plans/README.md`](file:///home/runner/workspace/plans/README.md) — Navigation index and execution workflow
- [`artifacts/cordchain-ui`](file:///home/runner/workspace/artifacts/cordchain-ui) — **Integrated web UI (from `cordchain-ui-replicator` zip), all 3 screens wired to the live API**
  - [`src/lib/api.ts`](file:///home/runner/workspace/artifacts/cordchain-ui/src/lib/api.ts) — typed live-API client, demo user context, chart hydration helpers
  - [`src/App.tsx`](file:///home/runner/workspace/artifacts/cordchain-ui/src/App.tsx) — central state/data plumbing, trade/boost/cashout/campaign handlers
  - [`src/components/ActionModals.tsx`](file:///home/runner/workspace/artifacts/cordchain-ui/src/components/ActionModals.tsx) — boost + attention quiz + UPI cashout + sponsor campaign flows
- [`WEB_MVP_PROMPT.md`](file:///home/runner/workspace/WEB_MVP_PROMPT.md) — Comprehensive copy-pasteable prompt for frontend agents building the web UI
- [`cordchain/API_DOCS.md`](file:///home/runner/workspace/cordchain/API_DOCS.md) — Comprehensive API reference with curl and fetch() snippets for frontend agents
- [`cordchain/api.py`](file:///home/runner/workspace/cordchain/api.py) — Live FastAPI web backend (running on http://localhost:5000)
- [`cordchain/bot.py`](file:///home/runner/workspace/cordchain/bot.py) — Pokétwo-style AutoSharded Discord Bot
- [`cordchain/cogs/`](file:///home/runner/workspace/cordchain/cogs) — Modular Discord bot cogs (server, boost, trading, profile, admin)

## Architecture decisions

- **Dual-Wallet Separation:** Resettable 30-day fantasy currency (`$CRED`) for market trading vs withdrawable fiat cash (`₹ INR`) from verified sponsor dividends with ₹100 threshold.
- **Web UI lives off the Python API:** `artifacts/cordchain-ui/src/lib/api.ts` targets `http://localhost:5000` (`VITE_API_URL`); when the API is offline the UI degrades to bundled demo data instead of erroring.
- **Leaderboards + first-visit wallets are API-side (added 2026-10-18):** `/api/leaderboard/traders`, `/api/leaderboard/servers`; `GET /api/wallet/summary` auto-creates users with the 10,000 $CRED season grant.
- **Server-join bonus & watchlists are client-side cosmetics** until dedicated endpoints exist (documented in progress.md Phase 5).
- **Fair-Play Size Brackets:** 4 non-overlapping leagues (Squad, Club, Arena, Titan) preventing large communities from dominating small friend groups.
- **Bayesian Smoothing & Tanh AMM:** Bayesian constants ($C$) in denominators prevent micro-server 100% activity gaming; hyperbolic tangent caps trading price movement to $\pm 12\%$ per day.
- **5-Layer Anti-Cheat Matrix:** Snowflake account age check ($\ge 30$d), rolling 7-day high-water peak (anti-ghost-kick), global 1 paid drop/day cap, 12s interactive attention quiz, and salted SHA-256 UPI deduplication.

## Protocol Before Building Files

1. Always check [`plans/context.md`](file:///home/runner/workspace/plans/context.md) and [`plans/progress.md`](file:///home/runner/workspace/plans/progress.md).
2. Execute tasks following the target subplan in [`plans/`](file:///home/runner/workspace/plans).
3. Mark completed items in [`plans/progress.md`](file:///home/runner/workspace/plans/progress.md) and update logs.

