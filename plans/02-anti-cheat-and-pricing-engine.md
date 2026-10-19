# Subplan 02: Anti-Cheat & Mathematical Pricing Engine

> **Phase 2 Execution Plan**
> Target Packages: [`lib/anti-cheat`](file:///home/runner/workspace/lib/anti-cheat) (or module in [`artifacts/api-server`](file:///home/runner/workspace/artifacts/api-server)), unit test suites
> Status: Ready for Execution

---

## 1. Objectives

1. Implement the **5-Layer Anti-Cheat Defense Pipeline** to stop sybil alt-farming, macro clicking, ghost-kicking, and cashout multi-accounting.
2. Implement the **Bayesian-Smoothed Fair-Play Pricing Engine** with hyperbolic tangent ($\tanh$) volume damping.
3. Provide robust unit tests with mathematical boundary verification.

---

## 2. 5-Layer Anti-Cheat Pipeline Implementation

### Layer 1: Discord Account Trust Gate
- **Snowflake Decoder:**
  Discord Snowflake IDs encode the account creation timestamp:
  ```typescript
  export function getDiscordCreationDate(snowflake: string): Date {
    const DISCORD_EPOCH = 1420070400000n;
    const id = BigInt(snowflake);
    const timestampMs = (id >> 22n) + DISCORD_EPOCH;
    return new Date(Number(timestampMs));
  }
  ```
- **Trust Rules:**
  - Account age must be $\ge 30$ days for real cash dividend drops (`cash_wallet_inr`).
  - Users with accounts $< 30$ days may still earn fantasy `$CRED` boosts, but real cash drops are blocked with informative reason.
  - Require `user.verified === true` (verified email).
  - Trust score bonus (higher priority on IPO server promotions) if user has avatar, Discord Nitro, or linked connections.

### Layer 2: "Ghost Kick" High-Water Denominator
- **The Exploit:** A malicious server admin kicks 500 members to lower the denominator and artificially hike the check-in percentage.
- **The Defense:**
  - The database records `member_count_peak_7d`.
  - Every sync or check-in uses:
    $$\text{Effective Denominator} = \max(\text{member\_count\_current}, \text{member\_count\_peak\_7d}) + C$$
  - `member_count_peak_7d` is maintained via a 7-day rolling window cron job.

### Layer 3: Global 1-Paid-Drop-Per-Day Cap
- **Rule:**
  - A user can boost up to **3 servers per day** for game coins (+250 `$CRED` each).
  - Only their **first verified check-in of the calendar day (UTC)** triggers a Paid Sponsor Drop (Real ₹ INR Dividend).
- **Enforcement:**
  - Check `user.last_paid_checkin_date === todayUTC`.
  - If equal: award `$CRED` only (`is_paid_drop = false`, `user_payout_inr = 0`).
  - If null or before today: award `$CRED` + real cash dividend (`is_paid_drop = true`, `user_payout_inr = campaign.user_reward_inr`), then set `user.last_paid_checkin_date = todayUTC`.

### Layer 4: Interactive Proof-of-Attention Verification
- **Mechanism:**
  - Step 1: Client calls `POST /api/checkin/initiate`.
  - Server generates a signed JWT or Redis session containing:
    - `sessionId`, `campaignId`, `issuedAt`, `randomSeed`, `correctAnswerHash`.
  - Creative display requires minimum duration of 10 seconds before submission is accepted.
  - Client presents randomized 3-option multiple-choice question.
  - Step 2: Client calls `POST /api/checkin/verify` with `sessionId` and `selectedOption`.
  - Validation:
    - Submission received in $< 10$ seconds $\to$ Rejected as bot macro.
    - Session expired ($> 90$ seconds) $\to$ Rejected.
    - Incorrect answer $\to$ 1-hour cooldown penalty, ₹0 payout.
    - Correct answer $\to$ Dividend credited and session consumed (nonce invalidated).

### Layer 5: UPI Hash Deduplication at Cashout
- **The Exploit:** Sybil farm using multiple Discord accounts to withdraw to a single bank account.
- **The Defense:**
  - Normalization: `vpa.trim().toLowerCase()`
  - Salted SHA-256 HMAC:
    ```typescript
    export function hashUpi(vpa: string, salt: string): string {
      return crypto.createHmac('sha256', salt).update(vpa.trim().toLowerCase()).digest('hex');
    }
    ```
  - Stored in `users.upi_hash` with `UNIQUE` database constraint.
  - If `upi_hash` matches another user's recorded cashout, the withdrawal is rejected and flagged for review.

---

## 3. Pricing Engine Formulation & Implementation

### League Configuration Matrix

| League | Members | Bayesian $C$ | Volume Cap $V_{\text{cap}}$ | Base Price | Max Daily Swing |
|---|---|---|---|---|---|
| **Tier 1 — Squad** | 15 – 150 | 25 | 5,000 | 100.00 `$CRED` | $\pm 12\%$ |
| **Tier 2 — Club** | 151 – 1,000 | 100 | 25,000 | 100.00 `$CRED` | $\pm 12\%$ |
| **Tier 3 — Arena** | 1,001 – 10,000 | 500 | 100,000 | 100.00 `$CRED` | $\pm 12\%$ |
| **Tier 4 — Titan** | 10,001+ | 2,000 | 500,000 | 100.00 `$CRED` | $\pm 12\%$ |

### Mathematical Formulas

1. **Effective Activity Score ($A_s$):**
   $$A_s = \frac{\text{Verified Daily Check-Ins}}{\text{Effective Denominator}}$$

2. **League Baseline ($\bar{A}_{\text{league}}$):**
   Average activity across all servers within the same league tier.

3. **Hourly Stock Price ($P_{\text{new}}$):**
   $$P_{\text{new}} = P_{\text{base}} \times \left(1 + 0.70 \cdot \text{clamp}(A_s - \bar{A}_{\text{league}}, -0.15, +0.25) + 0.30 \cdot \tanh\left(\frac{V_{\text{net}}}{V_{\text{cap}}}\right)\right)$$
   Where:
   - $V_{\text{net}} = \text{Shares Bought} - \text{Shares Sold}$ over the trailing 24 hours.
   - $\tanh(x)$ ensures that even infinite buy volume flattens at 1.0, limiting trading pressure to $+30\%$ absolute maximum in extreme runs, and typically $\pm 12\%$ in 24-hour cycles.
   - Floor constraint: $P_{\text{new}} = \max(P_{\text{new}}, 5.00)$.

---

## 4. Test Suite Deliverables
- `tests/anti-cheat.test.ts`:
  - Snowflake age verification with edge cases (29 days old vs 31 days old).
  - Ghost-kick denominator persistence.
  - Multi-checkin limits (1st paid drop, 2nd & 3rd unpaid, 4th rejected).
  - Attention timing & answer validation.
  - UPI hash collisions.
- `tests/pricing-engine.test.ts`:
  - Bayesian smoothing across tiers.
  - Tanh saturation test with 10x volume cap.
  - Price bounds verification over 24 simulated hours.
