# Subplan 01: Database Schema & Data Models

> **Phase 1 Execution Plan**
> Target Packages: [`lib/db`](file:///home/runner/workspace/lib/db), [`lib/api-spec`](file:///home/runner/workspace/lib/api-spec), [`lib/api-zod`](file:///home/runner/workspace/lib/api-zod), [`scripts`](file:///home/runner/workspace/scripts)
> Status: Ready for Execution

---

## 1. Objectives

1. Implement the complete CordChain dual-wallet database schema using Drizzle ORM in [`lib/db/src/schema`](file:///home/runner/workspace/lib/db/src/schema).
2. Establish clean foreign keys, indices, and check constraints to guarantee ledger integrity.
3. Define Zod validation schemas using `drizzle-zod` and update OpenAPI specifications in [`lib/api-spec/openapi.yaml`](file:///home/runner/workspace/lib/api-spec/openapi.yaml).
4. Run Orval codegen to generate TypeScript contracts and React Query client hooks.
5. Provide a deterministic database seed script (`scripts/seed-cordchain.ts`) with populated servers across all 4 league tiers and sample active ad campaigns.

---

## 2. Table Specifications & Drizzle Schema

### 1. `guilds` (Listed Servers on the Exchange)
Stores listed Discord servers, current market prices, league tiers, and rolling high-water marks.
- `guild_id`: `varchar(32)` PRIMARY KEY (Discord Guild Snowflake)
- `name`: `varchar(100)` NOT NULL
- `ticker`: `varchar(10)` UNIQUE NOT NULL (e.g. `'$SQUAD'`, `'$CODE'`)
- `icon_url`: `text` NULLABLE
- `league_tier`: `integer` NOT NULL DEFAULT 1 (1: Squad, 2: Club, 3: Arena, 4: Titan)
- `member_count_current`: `integer` NOT NULL DEFAULT 0
- `member_count_peak_7d`: `integer` NOT NULL DEFAULT 0 (Rolling 7d peak for ghost kick defense)
- `stock_price`: `numeric(12, 2)` NOT NULL DEFAULT 100.00 (in `$CRED`)
- `previous_day_price`: `numeric(12, 2)` NOT NULL DEFAULT 100.00
- `circulating_shares`: `integer` NOT NULL DEFAULT 0
- `owner_id`: `varchar(32)` NOT NULL (Discord User ID of Server Owner)
- `owner_cash_wallet_inr`: `numeric(12, 2)` NOT NULL DEFAULT 0.00 (Owner Rev-share)
- `is_promoted_until`: `timestamp with time zone` NULLABLE
- `created_at`: `timestamp with time zone` NOT NULL DEFAULT `now()`

### 2. `users` (Dual-Wallet Architecture)
Maintains the separation between fantasy game currency (`$CRED`) and fiat dividend earnings (`₹ INR`).
- `discord_id`: `varchar(32)` PRIMARY KEY (Discord User Snowflake)
- `username`: `varchar(100)` NOT NULL
- `avatar`: `text` NULLABLE
- `account_created_at`: `timestamp with time zone` NOT NULL (Extracted from Snowflake)
- `is_discord_verified`: `boolean` NOT NULL DEFAULT true
- `has_nitro_or_avatar`: `boolean` NOT NULL DEFAULT false
- `cred_balance`: `numeric(14, 2)` NOT NULL DEFAULT 10000.00 (30-day reset fantasy balance)
- `cash_wallet_inr`: `numeric(12, 2)` NOT NULL DEFAULT 0.00 (Real withdrawable cash)
- `upi_hash`: `varchar(64)` UNIQUE NULLABLE (Salted SHA-256 for cashout deduplication)
- `is_vip_until`: `timestamp with time zone` NULLABLE (Discord SKU VIP pass)
- `last_paid_checkin_date`: `date` NULLABLE (Restricts real ₹ dividend to max 1/day)
- `daily_boost_count`: `integer` NOT NULL DEFAULT 0 (Restricts total boosts to max 3/day)
- `last_boost_date`: `date` NULLABLE
- `created_at`: `timestamp with time zone` NOT NULL DEFAULT `now()`

### 3. `holdings` (Stock Portfolios)
Tracks share ownership per user per server.
- `user_id`: `varchar(32)` REFERENCES `users(discord_id)` ON DELETE CASCADE
- `guild_id`: `varchar(32)` REFERENCES `guilds(guild_id)` ON DELETE CASCADE
- `shares`: `integer` NOT NULL CHECK (`shares >= 0`)
- `avg_buy_price`: `numeric(12, 2)` NOT NULL
- `updated_at`: `timestamp with time zone` NOT NULL DEFAULT `now()`
- PRIMARY KEY (`user_id`, `guild_id`)

### 4. `ad_campaigns` (Sponsor Ad Pools)
Contains verified sponsor creatives, attention quizzes, and remaining budget.
- `campaign_id`: `uuid` PRIMARY KEY DEFAULT `gen_random_uuid()`
- `sponsor_name`: `varchar(100)` NOT NULL
- `media_url`: `text` NOT NULL (Video/banner asset URL)
- `title`: `varchar(150)` NOT NULL
- `description`: `text` NOT NULL
- `verify_question`: `text` NOT NULL (Proof-of-attention question)
- `correct_option`: `varchar(100)` NOT NULL
- `wrong_options`: `jsonb` NOT NULL (Array of 2 wrong choices)
- `cpi_rate_inr`: `numeric(6, 2)` NOT NULL DEFAULT 6.00 (Total advertiser cost per engagement)
- `user_reward_inr`: `numeric(6, 2)` NOT NULL DEFAULT 3.50 (User share)
- `owner_reward_inr`: `numeric(6, 2)` NOT NULL DEFAULT 1.00 (Guild owner share)
- `platform_fee_inr`: `numeric(6, 2)` NOT NULL DEFAULT 1.50 (Platform fee = 25%)
- `remaining_budget_inr`: `numeric(12, 2)` NOT NULL
- `target_category`: `varchar(50)` NOT NULL DEFAULT 'all'
- `is_active`: `boolean` NOT NULL DEFAULT true
- `created_at`: `timestamp with time zone` NOT NULL DEFAULT `now()`

### 5. `checkin_logs` (Daily Dividend Ledger)
Immutable audit trail of all verified check-ins and monetary distributions.
- `id`: `bigserial` PRIMARY KEY
- `user_id`: `varchar(32)` REFERENCES `users(discord_id)`
- `guild_id`: `varchar(32)` REFERENCES `guilds(guild_id)`
- `campaign_id`: `uuid` REFERENCES `ad_campaigns(campaign_id)` NULLABLE
- `is_paid_drop`: `boolean` NOT NULL DEFAULT false
- `cred_awarded`: `numeric(10, 2)` NOT NULL DEFAULT 250.00
- `user_payout_inr`: `numeric(6, 2)` NOT NULL DEFAULT 0.00
- `owner_payout_inr`: `numeric(6, 2)` NOT NULL DEFAULT 0.00
- `platform_fee_inr`: `numeric(6, 2)` NOT NULL DEFAULT 0.00
- `quiz_answered_correctly`: `boolean` NOT NULL DEFAULT true
- `created_at`: `timestamp with time zone` NOT NULL DEFAULT `now()`

### 6. `trade_transactions` (Market Trades)
Full trade history for price discovery and auditing.
- `id`: `uuid` PRIMARY KEY DEFAULT `gen_random_uuid()`
- `user_id`: `varchar(32)` REFERENCES `users(discord_id)`
- `guild_id`: `varchar(32)` REFERENCES `guilds(guild_id)`
- `action`: `varchar(4)` NOT NULL CHECK (`action IN ('BUY', 'SELL')`)
- `shares`: `integer` NOT NULL CHECK (`shares > 0`)
- `price_per_share`: `numeric(12, 2)` NOT NULL
- `total_cred`: `numeric(14, 2)` NOT NULL
- `created_at`: `timestamp with time zone` NOT NULL DEFAULT `now()`

### 7. `withdrawals` (UPI Cashout Queue)
Queue for real cash withdrawals with deduplication and status tracking.
- `id`: `uuid` PRIMARY KEY DEFAULT `gen_random_uuid()`
- `user_id`: `varchar(32)` REFERENCES `users(discord_id)`
- `amount_inr`: `numeric(10, 2)` NOT NULL CHECK (`amount_inr >= 100.00`)
- `upi_vpa_masked`: `varchar(100)` NOT NULL (e.g. `user****@okaxis`)
- `upi_hash`: `varchar(64)` NOT NULL
- `status`: `varchar(20)` NOT NULL DEFAULT 'PENDING' CHECK (`status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED')`)
- `payout_reference`: `varchar(100)` NULLABLE
- `created_at`: `timestamp with time zone` NOT NULL DEFAULT `now()`
- `processed_at`: `timestamp with time zone` NULLABLE

---

## 3. Implementation Steps

1. **Create Table Files in `lib/db/src/schema/`:**
   - `guilds.ts`
   - `users.ts`
   - `holdings.ts`
   - `adCampaigns.ts`
   - `checkinLogs.ts`
   - `tradeTransactions.ts`
   - `withdrawals.ts`
2. **Export and Export Relations in `lib/db/src/schema/index.ts`:**
   - Define Drizzle relations between `users`, `guilds`, `holdings`, `checkinLogs`, `adCampaigns`.
   - Export Zod schemas via `createInsertSchema` and `createSelectSchema`.
3. **Database Migration:**
   - Run `pnpm --filter @workspace/db run push` to synchronize PostgreSQL database.
4. **Update API Contracts:**
   - Update `lib/api-spec/openapi.yaml` with models for Guild, UserProfile, Holding, AdCampaign, CheckinResult, TradeResult, and WithdrawalRequest.
   - Run `pnpm --filter @workspace/api-spec run codegen`.
5. **Deterministic Seeding Script:**
   - Write `scripts/src/seed-cordchain.ts` with 12 realistic guilds across all 4 tiers:
     - Tier 1 (Squad): `$SQUAD`, `$DEV`, `$PIXEL`
     - Tier 2 (Club): `$CODE`, `$CHILL`, `$BUILD`
     - Tier 3 (Arena): `$ARENA`, `$CLAN`, `$WAR`
     - Tier 4 (Titan): `$TITAN`, `$ESPORT`, `$PRIME`
   - Add 3 realistic sponsor campaigns with verified questions and answers.

---

## 4. Acceptance Criteria
- [ ] `pnpm run typecheck` succeeds without errors across the workspace.
- [ ] Database schema is pushed to PostgreSQL.
- [ ] Seed script executes cleanly and populates all 7 tables.
- [ ] OpenAPI spec codegen generates synchronized Zod schemas and React Query hooks.
