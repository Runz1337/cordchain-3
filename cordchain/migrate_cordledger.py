import os
import urllib.parse
from pg8000.native import Connection

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

url = urllib.parse.urlparse(DATABASE_URL)
con = Connection(
    user=url.username or "postgres",
    password=url.password,
    host=url.hostname or "localhost",
    port=url.port or 5432,
    database=url.path.lstrip("/") or "postgres",
)

statements = [
    # 1. CordBlocks
    """
    CREATE TABLE IF NOT EXISTS cord_blocks (
        height BIGINT PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        entry_count INT NOT NULL DEFAULT 0,
        start_entry_index BIGINT NOT NULL DEFAULT 0,
        end_entry_index BIGINT NOT NULL DEFAULT 0,
        merkle_root VARCHAR(64) NOT NULL,
        prev_block_hash VARCHAR(64) NOT NULL,
        block_hash VARCHAR(64) NOT NULL UNIQUE,
        signature VARCHAR(128) NOT NULL,
        signer_pubkey VARCHAR(64) NOT NULL
    )
    """,
    # 2. CordLedger
    """
    CREATE TABLE IF NOT EXISTS cord_ledger (
        id BIGSERIAL PRIMARY KEY,
        entry_index BIGINT NOT NULL UNIQUE,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        event_type VARCHAR(32) NOT NULL,
        guild_id VARCHAR(32) REFERENCES guilds(guild_id) ON DELETE SET NULL,
        user_id VARCHAR(32) REFERENCES users(discord_id) ON DELETE SET NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        prev_hash VARCHAR(64) NOT NULL,
        hash VARCHAR(64) NOT NULL UNIQUE,
        block_height BIGINT REFERENCES cord_blocks(height)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_cord_ledger_hash ON cord_ledger(hash)",
    "CREATE INDEX IF NOT EXISTS idx_cord_ledger_event_type ON cord_ledger(event_type)",
    "CREATE INDEX IF NOT EXISTS idx_cord_ledger_guild_id ON cord_ledger(guild_id)",
    "CREATE INDEX IF NOT EXISTS idx_cord_ledger_user_id ON cord_ledger(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_cord_ledger_block_height ON cord_ledger(block_height)",
    # 3. Immutability trigger for cord_ledger and cord_blocks
    """
    CREATE OR REPLACE FUNCTION prevent_ledger_tampering()
    RETURNS TRIGGER AS $$
    BEGIN
        RAISE EXCEPTION 'CordLedger is append-only. UPDATE and DELETE are strictly prohibited.';
    END;
    $$ LANGUAGE plpgsql
    """,
    "DROP TRIGGER IF EXISTS trg_cord_ledger_worm ON cord_ledger",
    """
    CREATE TRIGGER trg_cord_ledger_worm
    BEFORE UPDATE OR DELETE ON cord_ledger
    FOR EACH ROW EXECUTE FUNCTION prevent_ledger_tampering()
    """,
    "DROP TRIGGER IF EXISTS trg_cord_blocks_worm ON cord_blocks",
    """
    CREATE TRIGGER trg_cord_blocks_worm
    BEFORE UPDATE OR DELETE ON cord_blocks
    FOR EACH ROW EXECUTE FUNCTION prevent_ledger_tampering()
    """,
    # 4. Guild updates for CordChain
    "ALTER TABLE guilds ADD COLUMN IF NOT EXISTS fixed_supply BIGINT NOT NULL DEFAULT 1000000",
    "ALTER TABLE guilds ADD COLUMN IF NOT EXISTS creator_reserve_shares BIGINT NOT NULL DEFAULT 250000",
    "ALTER TABLE guilds ADD COLUMN IF NOT EXISTS creator_vested_shares BIGINT NOT NULL DEFAULT 50000",
    "ALTER TABLE guilds ADD COLUMN IF NOT EXISTS creator_locked_shares BIGINT NOT NULL DEFAULT 200000",
    "ALTER TABLE guilds ADD COLUMN IF NOT EXISTS vesting_last_unlocked_at TIMESTAMPTZ DEFAULT NOW()",
    "ALTER TABLE guilds ADD COLUMN IF NOT EXISTS community_score NUMERIC(8, 2) NOT NULL DEFAULT 100.00",
    "ALTER TABLE guilds ADD COLUMN IF NOT EXISTS baseline_score NUMERIC(8, 2) NOT NULL DEFAULT 100.00",
    "ALTER TABLE guilds ADD COLUMN IF NOT EXISTS league VARCHAR(16) NOT NULL DEFAULT 'Bronze'",
    "ALTER TABLE guilds ADD COLUMN IF NOT EXISTS circuit_breaker_until TIMESTAMPTZ",
    "ALTER TABLE guilds ADD COLUMN IF NOT EXISTS last_price_tick TIMESTAMPTZ DEFAULT NOW()",
    # 5. User updates
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_allowance_date DATE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_earned_cred NUMERIC(10, 2) NOT NULL DEFAULT 0.00",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_earn_date DATE",
    # 6. Server metrics
    """
    CREATE TABLE IF NOT EXISTS server_metrics (
        id BIGSERIAL PRIMARY KEY,
        guild_id VARCHAR(32) NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
        metric_date DATE NOT NULL,
        unique_chatters INT NOT NULL DEFAULT 0,
        total_messages INT NOT NULL DEFAULT 0,
        chatter_entropy NUMERIC(6, 4) NOT NULL DEFAULT 1.0000,
        retention_rate NUMERIC(6, 4) NOT NULL DEFAULT 1.0000,
        voice_minutes INT NOT NULL DEFAULT 0,
        account_age_median_days INT NOT NULL DEFAULT 180,
        growth_vs_baseline NUMERIC(6, 4) NOT NULL DEFAULT 1.0000,
        community_score NUMERIC(8, 2) NOT NULL DEFAULT 100.00,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (guild_id, metric_date)
    )
    """,
    # 7. Weekly Earnings Reports
    """
    CREATE TABLE IF NOT EXISTS weekly_earnings_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id VARCHAR(32) NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
        week_number INT NOT NULL,
        season_id INT NOT NULL DEFAULT 1,
        community_score NUMERIC(8, 2) NOT NULL,
        total_payout_cred NUMERIC(12, 2) NOT NULL,
        payout_per_share NUMERIC(10, 6) NOT NULL,
        chatter_count INT NOT NULL DEFAULT 0,
        retention_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
        distributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ledger_hash VARCHAR(64)
    )
    """,
    # 8. Seasons
    """
    CREATE TABLE IF NOT EXISTS seasons (
        season_id SERIAL PRIMARY KEY,
        name VARCHAR(64) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        hall_of_fame JSONB NOT NULL DEFAULT '[]'::jsonb
    )
    """,
    """
    INSERT INTO seasons (season_id, name, start_date, end_date, is_active)
    VALUES (1, 'Season 1: Genesis', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', TRUE)
    ON CONFLICT (season_id) DO NOTHING
    """,
    # 9. Server rivalries
    """
    CREATE TABLE IF NOT EXISTS server_rivalries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        season_id INT NOT NULL DEFAULT 1,
        guild_a VARCHAR(32) NOT NULL REFERENCES guilds(guild_id),
        guild_b VARCHAR(32) NOT NULL REFERENCES guilds(guild_id),
        start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        end_time TIMESTAMPTZ NOT NULL,
        score_a NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
        score_b NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
        winner_guild_id VARCHAR(32),
        reward_cred NUMERIC(10, 2) NOT NULL DEFAULT 5000.00,
        status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
    )
    """,
    # 10. Community quests
    """
    CREATE TABLE IF NOT EXISTS community_quests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id VARCHAR(32) NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
        title VARCHAR(128) NOT NULL,
        target_type VARCHAR(32) NOT NULL,
        target_value INT NOT NULL,
        current_value INT NOT NULL DEFAULT 0,
        reward_cred NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        expires_at TIMESTAMPTZ NOT NULL
    )
    """,
    # 11. Prediction markets
    """
    CREATE TABLE IF NOT EXISTS prediction_markets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id VARCHAR(32) NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        options JSONB NOT NULL,
        total_pool_cred NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
        outcome VARCHAR(32),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolves_at TIMESTAMPTZ NOT NULL
    )
    """,
]

for stmt in statements:
    s = stmt.strip()
    if s:
        try:
            con.run(s)
        except Exception as e:
            print(f"Error on: {s[:50]}... => {e}")
            raise

print("✅ CordLedger database schema and WORM triggers applied successfully!")
con.close()
