# Subplan 06: Payments, Payouts & B2B Monetization

> **Phase 6 Execution Plan**
> Target Packages: [`artifacts/api-server`](file:///home/runner/workspace/artifacts/api-server), webhook handlers, payment connectors
> Status: Ready for Execution

---

## 1. Objectives

1. Integrate **Discord Native SKUs** for 1-click VIP Trader Pass in-app purchases.
2. Integrate **Razorpay / RazorpayX** for B2B advertiser self-serve budget deposits and automated UPI dividend payouts.
3. Enforce **strict double-entry financial ledger integrity** with atomic database row locks.
4. Secure the cashout pipeline against fraud using the Salted SHA-256 UPI deduplication gate.

---

## 2. Discord Native SKU Integration (VIP Trader Pass)

- **Product:** VIP Trader Pass (₹199 / month or $2.99 / month via Discord SKU).
- **Entitlements:**
  - Automated Stop-Loss protection triggers.
  - Advanced market depth charts and trade volume heatmaps.
  - Exclusive VIP badge next to user ticker in leaderboards.
- **Client Flow:**
  ```typescript
  await discordSdk.commands.startPurchase({ sku_id: 'CORDCHAIN_VIP_PASS_SKU' });
  ```
- **Backend Entitlement Webhook (`POST /api/webhooks/discord-entitlements`):**
  - Verifies Ed25519 signature of incoming Discord interaction payload.
  - On `ENTITLEMENT_CREATE`: Sets `users.is_vip_until = now() + 30 days`.
  - On `ENTITLEMENT_DELETE`: Clears `is_vip_until`.

---

## 3. Razorpay B2B Advertiser Self-Serve Deposits

- **Flow:**
  1. Server owner or sponsor fills out campaign creative form and selects deposit amount ($\ge ₹500$).
  2. Client calls `POST /api/payments/razorpay/create-order` with `{ amountInr, campaignDraft }`.
  3. Server creates order via Razorpay API and returns `order_id`.
  4. Client renders standard Razorpay checkout modal (UPI, Cards, NetBanking).
  5. Upon completion, client submits payment ID, or server catches `payment.captured` webhook.
- **Webhook Security (`POST /api/webhooks/razorpay`):**
  - Verifies webhook signature using `crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)`.
  - Atomically marks `ad_campaigns.is_active = true` and allocates `remaining_budget_inr`.

---

## 4. Automated & Deduplicated UPI Cashouts

- **Cashout Constraints:**
  - Minimum cashout: **₹100.00**.
  - Rate limit: 1 cashout request per user per 48 hours.
  - Account age: Must be $\ge 30$ days (Snowflake check).
- **Two-Phase Lock Workflow:**
  ```
  [User Submits UPI ID]
           |
           v
  [Normalize & Hash UPI ID] ---> Matches another Discord ID? ---> REJECT (Multi-account fraud)
           |
           v (Unique)
  [Database Transaction: SELECT ... FOR UPDATE]
  - Verify cash_wallet_inr >= amount
  - Deduct cash_wallet_inr
  - Insert record into withdrawals (status: 'PENDING')
           |
           v
  [Payout Engine: RazorpayX / UPI Payout]
  - If Success: status -> 'PAID', record utr_number
  - If Failure: status -> 'FAILED', refund cash_wallet_inr
  ```

---

## 5. Financial Ledger & Platform Margin Integrity

- **Gross Revenue Split Model (per ₹6.00 verified CPI):**
  - **₹3.50 (58.3%)** $\to$ Direct to user's `cash_wallet_inr`
  - **₹1.00 (16.7%)** $\to$ Direct to server owner's `owner_cash_wallet_inr`
  - **₹1.50 (25.0%)** $\to$ Platform Gross Margin
- **Audit Verification Invariant:**
  $$\sum \text{Campaign Budgets Spent} = \sum \text{User Payouts} + \sum \text{Owner Payouts} + \sum \text{Platform Fees}$$
  An automated daily reconciliation script verifies that ledger columns balance down to the exact paise.

---

## 6. Acceptance Criteria
- [ ] Razorpay webhook validates signatures and credits campaign budgets safely.
- [ ] UPI cashout rejects duplicates matching existing salted hashes.
- [ ] Atomic row locks prevent double-spend during simultaneous cashout requests.
- [ ] Discord SKU entitlement handler properly updates VIP status.
