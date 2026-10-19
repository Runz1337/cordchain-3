# Subplan 07: Testing, Deployment & 14-Day Launch Playbook

> **Phase 7 Execution Plan**
> Target Packages: Full Monorepo, Simulation Harness, Deployment Runbooks
> Status: Ready for Execution

---

## 1. Objectives

1. Implement an automated **Market Simulation Harness** to stress-test the Bayesian pricing formula and tanh volume damping.
2. Build an **Anti-Cheat Penetration Test Suite** validating all 5 defense layers against adversarial bots.
3. Deploy a **Local Browser Mock Runner** for the Discord Embedded App SDK.
4. Execute the **14-Day Zero-Cost Cold-Start Rollout Plan** from [`Mvp.md`](file:///home/runner/workspace/Mvp.md).

---

## 2. Market Simulation & Stress Harness

Create `scripts/src/simulate-market.ts`:
- **Scenario 1: Organic Activity vs Dormant Servers:**
  - 10 active servers with 70% daily participation.
  - 10 dead servers with 5% participation.
  - Verifies active server tickers climb consistently while dormant tickers decay gracefully.
- **Scenario 2: Whale Pump-and-Dump Attack:**
  - Virtual trader injects 100,000 `$CRED` into a Squad League stock.
  - Verifies the $\tanh$ saturation curve prevents daily price movement from exceeding $+12\%$.
- **Scenario 3: Ghost Kick Exploit:**
  - Server owner kicks 70% of members mid-week.
  - Verifies the 7-day high-water mark keeps the denominator stable, completely negating the artificial boost.

---

## 3. Anti-Cheat Penetration Test Suite

Automated integration test suite in `tests/penetration.test.ts`:

| Test Case | Attack Vector | Expected Outcome |
|---|---|---|
| `fresh_account_test` | Snowflake age = 5 days | `$CRED` awarded; Real ₹ dividend withheld with `REASON_NEW_ACCOUNT`. |
| `ghost_kick_test` | Owner kicks 300 members | Denominator remains at 7d peak; activity score does not spike. |
| `multi_drop_test` | User check-ins on 4 servers | 1st gets Cash + CRED; 2nd & 3rd get CRED only; 4th rejected. |
| `speed_macro_test` | Quiz submitted in 1.1s | Rejected with `ERROR_SPEED_VIOLATION`. Cooldown applied. |
| `wrong_answer_test` | Incorrect quiz option chosen | ₹0 dividend awarded; 1-hour penalty cooldown recorded. |
| `upi_collision_test` | Account B inputs Account A's UPI | Rejected with `DUPLICATE_PAYOUT_DESTINATION`. |

---

## 4. Local Browser Mock Environment

To enable fast iteration without constantly loading the Discord desktop client:
- Create `artifacts/mockup-sandbox/src/lib/mockDiscordSdk.ts`.
- Implements the `@discord/embedded-app-sdk` interface:
  - Mock user profile with avatar and Snowflake.
  - Mock current guild context (`$SQUAD`, 85 members, Squad League).
  - Mock `commands.startPurchase` returning test purchase success.
- Automatically activated when `window.parent === window` (standard browser window).

---

## 5. Staging & Production Deployment Runbook

### Environment Variables Checklist
```bash
# Database & Cache
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Discord Bot & Embedded App
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_BOT_TOKEN=...
DISCORD_PUBLIC_KEY=...

# Payments & Security
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
UPI_SALT_SECRET=...
JWT_SECRET=...
```

### Pre-Deployment Verification Commands
```bash
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run test
```

---

## 6. The 14-Day Zero-Cost Cold-Start Roadmap

```
Week 1 (Days 1–7): Foundation & Core Engine
  [Day 1–3]  PostgreSQL schema + Discord bot registration + daily message embed
  [Day 4–8]  Next.js/React Embedded App 3-screen interface + Bayesian pricing cron

Week 2 (Days 8–14): Monetization & Viral Launch
  [Day 9–11] Anti-cheat verification + Razorpay B2B deposit link
  [Day 12–14] Cold Start:
             - Seed ₹2,000 ad pool (or partner with 20 college/gaming servers using
               their own server promotion cards as initial drops).
             - Launch "Season 1: Squad League" with ₹1,500 prize pool to pit
               10 rival servers against each other for viral organic growth.
```

---

## 7. Acceptance Criteria
- [ ] Simulation script demonstrates mathematical stability under whale dumping and ghost kicking.
- [ ] All penetration tests pass with 100% defense rate.
- [ ] Browser mock environment renders all 3 screens without crashing.
- [ ] Full deployment runbook validated and documented.
