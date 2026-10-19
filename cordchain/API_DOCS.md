# CordChain Web MVP API Specification

> **For Frontend Agents & Developers**
> Live Server Base URL: `http://localhost:5000`
> Interactive Swagger UI: `http://localhost:5000/docs`
> OpenAPI JSON Spec: `http://localhost:5000/openapi.json`
> Source Implementation: [`cordchain/api.py`](file:///home/runner/workspace/cordchain/api.py)

---

## 🚀 Quick Start for Frontend Agents

All endpoints support CORS, return standard `application/json`, and are running live on port `5000`.

### Reusable Client Snippet (`apiClient.ts`)

```typescript
const BASE_URL = "http://localhost:5000";

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.error || `HTTP ${res.status}`);
  }
  return res.json();
}
```

---

## 📈 Screen 1 & Exchange Floor: Guilds & Stocks

### 1. List Listed Stocks
```http
GET /api/guilds?tier=1&sort=gain&search=squad
```
- **Query Parameters (All optional):**
  - `tier`: `1` (Squad 15-150), `2` (Club 151-1k), `3` (Arena 1k-10k), `4` (Titan 10k+)
  - `sort`: `'gain'` (highest 24h gainers), `'activity'` (most active), default is highest price
  - `search`: string to filter server name or ticker
- **Response `200 OK`:**
```json
{
  "guilds": [
    {
      "guildId": "111100000000000001",
      "name": "Squad Alpha",
      "ticker": "$SQUAD",
      "iconUrl": "https://cdn.discordapp.com/embed/avatars/0.png",
      "leagueTier": 1,
      "memberCountCurrent": 45,
      "memberCountPeak7d": 48,
      "stockPrice": "114.50",
      "previousDayPrice": "108.00",
      "circulatingShares": 1250,
      "ownerId": "999000000000000001",
      "ownerCashWalletInr": "28.00",
      "changePct": 6.02,
      "isGain": true
    }
  ]
}
```

### 2. Get Featured IPO Stocks (Carousel)
```http
GET /api/guilds/featured
```
- **Response `200 OK`:**
```json
{
  "featured": [
    {
      "guildId": "444400000000000001",
      "name": "Titan Megahub",
      "ticker": "$TITAN",
      "iconUrl": "https://cdn.discordapp.com/embed/avatars/3.png",
      "leagueTier": 4,
      "stockPrice": "520.00",
      "changePct": 4.42,
      "isGain": true
    }
  ]
}
```

### 3. Get Single Stock Detail
```http
GET /api/guilds/111100000000000001
```
- **Response `200 OK`:**
```json
{
  "guild": {
    "guildId": "111100000000000001",
    "name": "Squad Alpha",
    "ticker": "$SQUAD",
    "stockPrice": "114.50",
    "previousDayPrice": "108.00",
    "circulatingShares": 1250,
    "changePct": 6.02,
    "isGain": true
  }
}
```

---

## ⚡ Screen 2: 15-Second Daily Boost & Attention Quiz

### 1. Initiate Boost Session
```http
POST /api/checkin/initiate
Content-Type: application/json

{
  "guildId": "111100000000000001",
  "userId": "123456789012345678"
}
```
- **Response `200 OK`:**
```json
{
  "guild": {
    "id": "111100000000000001",
    "name": "Squad Alpha",
    "ticker": "$SQUAD",
    "stockPrice": "114.50"
  },
  "campaign": {
    "campaignId": "1b8a4a5e-a004-44a2-afad-6aa61b2c29c0",
    "sponsorName": "Vortex Gaming Gear",
    "title": "Vortex Pro Wireless Headset 2.0",
    "description": "Experience spatial 7.1 surround sound with zero latency wireless transmission.",
    "mediaUrl": "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=60",
    "verifyQuestion": "What type of wireless audio transmission does Vortex Pro feature?",
    "options": [
      "Wired-only audio jack",
      "Bluetooth 1.0 mono",
      "Ultra-low latency 7.1 spatial"
    ]
  },
  "isPaidDrop": true,
  "accountAgeQualified": true,
  "currentDailyBoosts": 0,
  "minWatchSeconds": 10
}
```

### 2. Verify Attention Quiz & Claim Rewards
```http
POST /api/checkin/verify
Content-Type: application/json

{
  "guildId": "111100000000000001",
  "userId": "123456789012345678",
  "campaignId": "1b8a4a5e-a004-44a2-afad-6aa61b2c29c0",
  "selectedOption": "Ultra-low latency 7.1 spatial"
}
```
- **Response `200 OK` (Correct Answer):**
```json
{
  "success": true,
  "verified": true,
  "credAwarded": 250.0,
  "isPaidDrop": true,
  "userPayoutInr": 3.5,
  "newCredBalance": "10250.00",
  "newCashWalletInr": "3.50",
  "newStockPrice": "115.42",
  "dailyBoostCount": 1,
  "boostsRemainingToday": 2
}
```
- **Response (Wrong Answer):**
```json
{
  "success": false,
  "verified": false,
  "message": "Incorrect answer to attention question. A 1-hour cooldown has been initiated."
}
```

---

## 💼 Live Exchange Floor: Share Trading

### 1. Request Trade Execution Quote
```http
POST /api/trade/quote
Content-Type: application/json

{
  "guildId": "111100000000000001",
  "action": "BUY",
  "shares": 10
}
```
- **Response `200 OK`:**
```json
{
  "guildId": "111100000000000001",
  "ticker": "$SQUAD",
  "currentPrice": "114.50",
  "shares": 10,
  "action": "BUY",
  "totalCred": "1145.00",
  "estimatedSlippagePct": 0.1
}
```

### 2. Buy Shares
```http
POST /api/trade/buy
Content-Type: application/json

{
  "guildId": "111100000000000001",
  "userId": "123456789012345678",
  "shares": 10
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "action": "BUY",
  "ticker": "$SQUAD",
  "sharesBought": 10,
  "pricePerShare": "114.50",
  "totalCredSpent": "1145.00",
  "newCredBalance": "9105.00",
  "holding": {
    "shares": 10,
    "avgBuyPrice": "114.50"
  },
  "transactionId": "3ee3c59f-743d-4891-9d8d-09f230a0f3c3"
}
```

### 3. Sell Shares
```http
POST /api/trade/sell
Content-Type: application/json

{
  "guildId": "111100000000000001",
  "userId": "123456789012345678",
  "shares": 5
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "action": "SELL",
  "ticker": "$SQUAD",
  "sharesSold": 5,
  "pricePerShare": "114.50",
  "totalCredReceived": "572.50",
  "newCredBalance": "9677.50",
  "remainingShares": 5,
  "transactionId": "5fa23d11-9a99-4cde-a1b2-13248888b1a2"
}
```

---

## 💳 Screen 3: Dual Wallet & Cashout Vault

### 1. Get Wallet & Portfolio Summary
```http
GET /api/wallet/summary?userId=123456789012345678
```
- **Response `200 OK`:**
```json
{
  "user": {
    "discordId": "123456789012345678",
    "username": "CordTrader",
    "avatar": "https://cdn.discordapp.com/embed/avatars/0.png"
  },
  "wallets": {
    "credBalance": "9677.50",
    "cashWalletInr": "46.00",
    "portfolioStockValueCred": "572.50",
    "totalNetWorthCred": "10250.00"
  },
  "cashout": {
    "minWithdrawalThresholdInr": 100.0,
    "canWithdraw": false,
    "progressPct": "46.0"
  },
  "dailyStatus": {
    "boostsUsedToday": 1,
    "maxDailyBoosts": 3,
    "canClaimCashDrop": false
  },
  "holdings": [
    {
      "guildId": "111100000000000001",
      "ticker": "$SQUAD",
      "serverName": "Squad Alpha",
      "shares": 5,
      "avgBuyPrice": "114.50",
      "currentPrice": "114.50",
      "totalValueCred": "572.50",
      "unrealizedPnlCred": "0.00"
    }
  ]
}
```

### 2. Request UPI Cashout (Min ₹100)
```http
POST /api/wallet/cashout
Content-Type: application/json

{
  "userId": "123456789012345678",
  "upiVpa": "trader@okhdfcbank",
  "amountInr": 100.00
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "withdrawalId": "8f810166-7e3e-43a9-9520-22c6085a6a02",
  "amountInr": "100.00",
  "destinationUpi": "tra****@okhdfcbank",
  "status": "PENDING",
  "newCashWalletInr": "0.00"
}
```

---

## 📢 Sponsor Campaigns Portal (Self-Serve Deposits)

### 1. List Active Campaigns
```http
GET /api/campaigns
```

### 2. Create Campaign (Starting from ₹500)
```http
POST /api/campaigns/create
Content-Type: application/json

{
  "sponsorName": "My Awesome Server",
  "title": "Join our 24/7 Gaming Server",
  "description": "Daily tournaments, anime watchparties, and friendly community.",
  "mediaUrl": "https://example.com/banner.png",
  "verifyQuestion": "What daily event does our server host?",
  "correctOption": "Tournaments & Watchparties",
  "wrongOptions": ["Math exams", "Boring lectures"],
  "budgetInr": 500.00,
  "targetCategory": "gaming"
}
```

---

## 🏆 Leaderboards (added 2026-10-18 for the web UI)

### 1. Trader Leaderboard (Net worth = CRED + portfolio)
```http
GET /api/leaderboard/traders
```
- **Response `200 OK`:**
```json
{
  "traders": [
    {
      "rank": 1,
      "discordId": "123456789012345678",
      "username": "CordTrader",
      "avatar": "https://cdn.discordapp.com/embed/avatars/0.png",
      "netWorthCred": "11145.0",
      "roiPct": 10.3,
      "winRate": 50,
      "topAsset": "$SQUAD"
    }
  ]
}
```

### 2. Server Leaderboard (market cap + 24h change)
```http
GET /api/leaderboard/servers
```
- **Response `200 OK`:**
```json
{
  "servers": [
    {
      "rank": 1,
      "guildId": "111100000000000002",
      "ticker": "$DEV",
      "name": "Dev Collective",
      "leagueTier": 1,
      "leagueName": "Squad",
      "iconUrl": "https://cdn.discordapp.com/embed/avatars/1.png",
      "memberCountCurrent": 92,
      "marketCapCred": "269220.0",
      "boostPower": 2744,
      "dividendYield": "12.8%",
      "change24hPct": 6.8
    }
  ]
}
```

---

## 📝 Notes for frontend agents (updated 2026-10-18)

- `GET /api/wallet/summary` **auto-creates** unknown users with the 10,000 `$CRED` starting season balance (Mvp.md dual-wallet season rule) — safe to call for brand-new Discord IDs.
- `POST /api/checkin/initiate` returns attention-quiz options **already shuffled server-side** — render them in order and post the user's pick verbatim to `/api/checkin/verify`.
- Wrong answers / daily-limit breaches return `HTTP 429` or `{ "success": false, ... }` — surface the message verbatim (the CordChain web UI toasts it).
- The web trading terminal lives at [`artifacts/cordchain-ui`](file:///home/runner/workspace/artifacts/cordchain-ui) (`./run_web.sh`, port 3000). It wires every endpoint above and degrades to bundled demo data when this server is unreachable.
