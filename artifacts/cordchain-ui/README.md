# CordChain Trading Terminal — Web UI

React 19 + Vite + Tailwind 4 frontend for **CordChain**, the cross-server Discord fantasy
stock exchange & CPA ad-dividend network. This artifact is the integrated working web UI:

- Data flows live from the CordChain Python FastAPI backend (`cordchain/api.py`, port `5000`,
  started with `./run_api.sh` at the workspace root).
- If the backend is unreachable the UI gracefully falls back to bundled demo data and shows
  an **OFFLINE** status chip in the top bar, so the interface is always explorable.
- Boosts, attention quizzes, trading, UPI cashouts, leaderboard and ad campaigns are all
  wired to the real endpoints documented in `cordchain/API_DOCS.md`.

## Run

```bash
# 1) Start the backend (workspace root)
export DATABASE_URL="postgres://user:pass@host:5432/db"
./run_api.sh

# 2) Start this UI
pnpm install            # from the repo root (workspace include artifacts/**)
pnpm --filter @cordchain/web-ui dev
```

Open http://localhost:3000 (plain browser), or paste the URL into Discord as the
Embedded App URL when SDK wiring is enabled.

## Env

Copy `.env.example` → `.env.local`. `VITE_API_URL` defaults to `http://localhost:5000`.
`VITE_DEMO_USER_ID` is the fake Discord snowflake used outside the Discord iframe.
