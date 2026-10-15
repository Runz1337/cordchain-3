
**Project Codename: Cordchain** is a cross-server fantasy stock exchange and cost-per-action (CPA) ad-dividend network built on Discord’s **Embedded App SDK**. Every Discord server becomes a tradable stock ticker (`$SQUAD`, `$CODE`, `$CLAN`) segmented into size-matched leagues, where daily check-ins trigger 15-second sponsored interactions that pay real cash dividends to users and server owners while generating a 30%+ platform margin for you.

---

## 1. System Architecture & Tech Stack

Because Discord’s Embedded App SDK renders a full web application inside an iframe right inside Discord (on both Desktop and Mobile), you only need a clean modern web stack:

| Layer | Technology | Role in MVP |
| --- | --- | --- |
| **Discord Bot Client** | Node.js (`discord.js`) or Python (`discord.py`) | Posts the daily `"⚡ Boost Server Stock"` button in servers, reads real member counts, and launches the Embedded Activity. |
| **Trading Terminal UI** | Next.js (React) + Tailwind CSS + `@discord/embedded-app-sdk` | The clickable 3-screen app inside Discord showing live charts, Buy/Sell buttons, 15-sec sponsor cards, and the UPI/Gift Card wallet. |
| **Backend API & Cron** | Node.js (Express/Fastify) or Python (FastAPI) | Calculates stock prices, verifies anti-cheat filters, processes trades, and distributes ad-pool dividends. |
| **Database & Cache** | PostgreSQL (Supabase) + Upstash Redis | Stores user wallets, server tickers, and stock holdings; Redis handles rate-limiting and live price ticks. |
| **Payments & Payouts** | **Discord Native SKUs** (`startPurchase`) + **RazorpayX / Stripe** | Discord SKUs handle 1-click VIP passes; Razorpay handles B2B advertiser deposits and automated UPI cashouts for Indian users. |

---

## 2. The Fair-Play Pricing & League Engine

To guarantee that a 40-person friend group can compete fairly against a 50,000-member gaming community, the backend enforces **League Brackets** and a **Bayesian-Smoothed Activity Formula**.

### A. Automatic Size-Bracket Leagues (No Cross-Weight Bullying)

When a server installs your bot, it is automatically placed into one of 4 divisions based on `total_human_members` (bots are excluded via Discord’s `member.user.bot` flag):

* **Tier 1 — Squad League:** 15 to 150 humans
* **Tier 2 — Club League:** 151 to 1,000 humans
* **Tier 3 — Arena League:** 1,001 to 10,000 humans
* **Tier 4 — Titan League:** 10,001+ humans

*Rule:* Servers only compete for leaderboard multipliers and seasonal prize pools against servers in their **exact same tier**.

### B. The Anti-Manipulation Stock Price Formula

If a server only has 5 members and all 5 click Check-In, raw percentage math would give them 100% activity instantly. To prevent tiny dead servers from gaming the math, use **Bayesian Smoothing** (adding a virtual baseline constants $C$ to the denominator) combined with a capped **Automated Market Maker (AMM)**:

$$\text{Effective Activity Score } (A_s) = \frac{\text{Verified Daily Check-Ins}}{\text{Total Non-Bot Members} + C}$$

*(Where $C = 25$ for Squad League, $100$ for Club League, etc. This prevents a 3-person alt-server from hitting 100% activity).*

Every hour, each server’s stock price ($P_{\text{new}}$) updates using two capped inputs—**Server Activity** (70% weight) and **Trader Buy/Sell Demand** (30% weight):

$$P_{\text{new}} = P_{\text{base}} \times \left(1 + 0.70 \cdot \text{clamp}(A_s - \bar{A}_{\text{league}}, -0.15, +0.25) + 0.30 \cdot \tanh\left(\frac{\text{Shares Bought} - \text{Shares Sold}}{V_{\text{cap}}}\right)\right)$$

* **Why $\tanh$ (Hyperbolic Tangent) is critical:** If a rich trader dumps 100,000 `$CRED` into one server to artificially pump it, the $\tanh$ curve flattens out so buying pressure can never move a stock more than **$\pm 12\%$ in a single day**. Only real human check-ins can sustain a rally.

---

## 3. The 5-Layer Anti-Cheat & Fair Participation Filters

Whenever real money (UPI/Gift Cards) is on the line, users will try to farm it with alt accounts or scripts. Build these **5 automatic filters** into your `/checkin` endpoint from Day 1:

### Filter 1: Discord Account Trust Gate (Blocks Fresh Alt Accounts)

Before crediting a check-in or ad dividend, inspect the user's Discord OAuth payload and Snowflake ID:

1. **Account Age Check:** Decode the Discord User ID (Snowflake timestamp). Reject dividend payouts for accounts created less than **30 days ago**.
2. **Verified Flag:** Require `user.verified === true` (verified email) and boost trust scores for users with Discord Nitro, profile avatars, or linked connections (GitHub/Steam/Spotify).

### Filter 2: "Ghost Kick" Penalty (Stops Server Owners from Kicking Inactive Members)

A sneaky server owner might try to kick 500 offline members so their `Active / Total` percentage looks artificially high.

* **The Fix:** Your database records a **7-Day Rolling High-Water Mark** of `total_human_members`. If a server kicks 200 people today, their denominator stays locked at the 7-day peak for the rest of the week.

### Filter 3: Global 1-Paid-Drop-Per-Day Cap (Anti-Grind & Anti-Hopping)

A user might join 50 servers and try to click "Check-In" 50 times a day to farm ₹150/day.

* **The Fix:** A user can boost up to **3 servers per day** for game coins (`$CRED`), **but only their FIRST check-in of the day across all of Discord triggers a Paid Advertiser Drop (Real ₹ Dividend).** This caps your daily payout liability per human and guarantees nobody has to grind for hours.

### Filter 4: Interactive "Proof-of-Attention" Ad Check (Blocks Auto-Clickers)

Never pay out real cash just for clicking a static Discord button (which a simple macro script can automate).

* **The Fix:** Clicking the button opens your **Embedded Activity Window**. The user watches a 12-second sponsor card and must answer a **1-click Randomized Context Question** (e.g., *"Which weapon skin was shown in the clip? [A] [B] [C]"* where button positions shuffle per user). Wrong answer = $0 dividend and a 1-hour cooldown.

### Filter 5: UPI / Phone Hash Deduplication at Cashout

A cheater might pass all Discord checks with 5 old Discord accounts. You catch them at the exit door:

* When a user reaches the **₹100 withdrawal threshold**, they must link a **unique UPI VPA (or mobile OTP)**. Store a salted SHA-256 hash of their UPI ID. One UPI ID can only ever be linked to **one Discord ID**.

---

## 4. Database Schema Blueprint (PostgreSQL / Supabase)

Drop this schema directly into Supabase or PostgreSQL to run the entire dual-wallet exchange and ad ledger:

```sql
-- 1. SERVERS (Listed Guilds on the Exchange)
CREATE TABLE guilds (
    guild_id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    ticker VARCHAR(8) UNIQUE NOT NULL,         -- e.g., '$CODE', '$MED'
    league_tier INT NOT NULL DEFAULT 1,        -- 1: Squad, 2: Club, 3: Arena, 4: Titan
    member_count_peak_7d INT NOT NULL,         -- Rolling 7-day peak to prevent kick-gaming
    stock_price NUMERIC(10, 2) DEFAULT 100.00, -- Virtual price in $CRED
    circulating_shares INT DEFAULT 0,
    owner_cash_wallet_inr NUMERIC(10, 2) DEFAULT 0.00, -- Real ₹ rev-share for server owner
    is_promoted_until TIMESTAMPTZ,             -- Paid B2B Front-Page Promotion timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS (Dual-Wallet Architecture: Fantasy Coins vs Real Cash)
CREATE TABLE users (
    discord_id VARCHAR(32) PRIMARY KEY,
    account_created_at TIMESTAMPTZ NOT NULL,   -- Extracted from Discord Snowflake
    cred_balance NUMERIC(12, 2) DEFAULT 10000.00, -- Resets every 30-day Season (100% Legal)
    cash_wallet_inr NUMERIC(10, 2) DEFAULT 0.00,  -- Real withdrawable ₹ from Ad Dividends
    upi_hash VARCHAR(64) UNIQUE,               -- Prevents multi-account cashout farming
    is_vip_until TIMESTAMPTZ,                  -- Discord SKU VIP Trader Pass status
    last_paid_checkin_date DATE                -- Enforces max 1 paid ad drop per 24h
);

-- 3. PORTFOLIO HOLDINGS (Who owns which server's shares)
CREATE TABLE holdings (
    user_id VARCHAR(32) REFERENCES users(discord_id),
    guild_id VARCHAR(32) REFERENCES guilds(guild_id),
    shares INT NOT NULL CHECK (shares >= 0),
    avg_buy_price NUMERIC(10, 2) NOT NULL,
    PRIMARY KEY (user_id, guild_id)
);

-- 4. SPONSOR AD CAMPAIGNS (Funded by Brands / Indie Devs / Server Owners)
CREATE TABLE ad_campaigns (
    campaign_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_name VARCHAR(100) NOT NULL,
    media_url TEXT NOT NULL,
    verify_question TEXT NOT NULL,             -- Anti-bot attention check question
    correct_option VARCHAR(50) NOT NULL,
    wrong_options TEXT[] NOT NULL,
    cpi_rate_inr NUMERIC(6, 2) DEFAULT 6.00,   -- Sponsor pays ₹6 per verified interaction
    remaining_budget_inr NUMERIC(10, 2) NOT NULL,
    target_category VARCHAR(50)                -- 'coding', 'gaming', 'study', 'all'
);

-- 5. DAILY CHECK-IN & DIVIDEND LEDGER
CREATE TABLE checkin_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(32) REFERENCES users(discord_id),
    guild_id VARCHAR(32) REFERENCES guilds(guild_id),
    campaign_id UUID REFERENCES ad_campaigns(campaign_id),
    user_payout_inr NUMERIC(6, 2) NOT NULL,    -- e.g., ₹3.00 to User
    owner_payout_inr NUMERIC(6, 2) NOT NULL,   -- e.g., ₹1.00 to Server Owner
    platform_fee_inr NUMERIC(6, 2) NOT NULL,   -- e.g., ₹2.00 to You (Platform Profit)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

```

---

## 5. The 3-Screen MVP User Interface (Inside Discord)

Build your Next.js frontend as a single responsive window loaded via `@discord/embedded-app-sdk` with three bottom navigation tabs:

### Screen 1: The "15-Second Daily Boost" Modal (Entry Point)

* **Trigger:** User clicks `"⚡ Boost $SQUAD & Claim Dividend"` on the bot's daily message in their server chat.
* **What They See:**
1. A sleek 12-second interactive card from a sponsor (or a promoted Discord server) with a countdown bar.
2. Three shuffled verification buttons at the bottom to prove they actually looked at it.
3. **Instant Dopamine Burst:** As soon as they click the right button, confetti pops:
* `"$SQUAD Stock Boosted +1.4%!"`
* `"+250 Free $CRED added to Trading Wallet"`
* `"+₹3.50 Real Cash Dividend added to UPI Wallet"`





### Screen 2: The Live Exchange Floor (Trading & Server Discovery)

* **Top Bar:** League Selector (`Squad` | `Club` | `Arena` | `Titan`) + User’s `$CRED` balance.
* **Featured IPO Banner (Your Paid Ad Slot):** Top 3 promoted servers with a glowing **"Join Server (+50 $CRED Bonus)"** button.
* **Live Stock List:** Displays each server’s icon, `$TICKER`, 24h % change in green/red, current activity %, and a 1-click **`[BUY]` / `[SELL]**` drawer.
* **Pro Tool Upsell:** Below the Buy button is a toggle: *"Set Auto-Sell Stop-Loss while you sleep 🔒 (Unlock with VIP Pass — ₹199/mo)"*, triggering `discordSdk.commands.startPurchase({ sku_id })`.

### Screen 3: The Dual Wallet & Sponsor Portal

* **Left Card (Season Rank):** Shows their `$CRED` net worth, current leaderboard rank, and how many days remain in the 30-day season.
* **Right Card (Real Cash Dividend Vault):**
* Shows real cash balance (e.g., `₹68.50 / ₹100.00 minimum to withdraw`).
* Visual progress bar showing: *"9 more daily check-ins to unlock instant UPI / Steam / Amazon Gift Card payout!"*


* **Bottom Button ("Advertise Your Server or App — From ₹500"):** Lets any server owner or indie creator self-serve deposit ₹500 via Razorpay to launch their own interactive card into the network.

---

## 6. Your 14-Day MVP Build & Launch Roadmap

1. **Days 1–3 (Core Bot & Database):** Set up Supabase with the 5 tables above. Build the lightweight Discord bot with `/register-server` (assigns ticker and league tier) and the daily check-in message embed.
2. **Days 4–8 (Next.js Embedded Activity):** Scaffold the Next.js app using Discord’s official Embedded App SDK template. Build the 3 tabs (Daily Boost, Exchange Floor, Dual Wallet) and wire up the Bayesian pricing cron job.
3. **Days 9–11 (Anti-Cheat & Self-Serve Ad Checkout):** Add the Snowflake 30-day account age check, the 3-choice attention quiz, and a Razorpay payment link so server owners can buy "Featured IPO" slots or fund ₹500 ad pools.
4. **Days 12–14 (The "Zero-Cost" Cold Start):** Seed the very first ₹2,000 ad pool yourself—or partner with 20 college/gaming server owners where **their own server promotion cards** act as the first daily drops. Pit 10 rival servers against each other in "Season 1: Squad League" with a ₹1,500 prize pool to ignite word-of-mouth viral installs.