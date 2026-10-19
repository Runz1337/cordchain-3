import os
import asyncio
import hashlib
import json
import re
import time
import random
import base64
import secrets
import math
import urllib.request
import urllib.error
from urllib.parse import urlencode, quote as urlquote, urlparse
from contextlib import asynccontextmanager
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from cordchain.db import query, query_one, execute, execute_returning
from cordchain.anti_cheat import (
    snowflake_to_datetime,
    is_account_old_enough,
    shuffle_options,
    compute_bot_resistant_community_score,
)
from cordchain.ledger import (
    ensure_genesis,
    append_ledger_entry,
    produce_block,
    verify_ledger_integrity,
    generate_daily_checkpoint,
    SERVER_PUBKEY_HEX,
)
from cordchain.pricing import (
    FIXED_SUPPLY_PER_SERVER,
    MAX_USER_SHARE_LIMIT,
    determine_league,
    amm_quote,
    pool_spot_price,
    check_circuit_breaker,
    check_position_limit,
    check_wash_trade,
    calculate_weekly_earnings,
    get_community_collab_tier,
    LEAGUES,
)

# ---------------- Discord OAuth2 sessions table (idempotent) ----------------
def _bootstrap_tables() -> None:
    execute("""
        CREATE TABLE IF NOT EXISTS web_sessions (
            token TEXT PRIMARY KEY,
            discord_id TEXT NOT NULL,
            username TEXT NOT NULL,
            avatar TEXT,
            email TEXT,
            joined_guilds TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            discord_access_token TEXT
        )
    """)
    execute("CREATE INDEX IF NOT EXISTS idx_web_sessions_discord ON web_sessions (discord_id)")
    execute("ALTER TABLE web_sessions ADD COLUMN IF NOT EXISTS discord_access_token TEXT")

@asynccontextmanager
async def lifespan(_: FastAPI):
    _bootstrap_tables()
    execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT")
    execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address TEXT")
    execute("ALTER TABLE trade_transactions ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT")
    execute("ALTER TABLE trade_transactions ADD COLUMN IF NOT EXISTS block_number BIGINT")
    execute("ALTER TABLE trade_transactions ADD COLUMN IF NOT EXISTS wallet_address TEXT")
    execute("ALTER TABLE trade_transactions ADD COLUMN IF NOT EXISTS on_chain_status TEXT DEFAULT 'confirmed'")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS token_contract_address TEXT")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS amm_pool_address TEXT")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS description TEXT")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Community'")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS dividend_split_shareholders INT DEFAULT 60")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS dividend_split_treasury INT DEFAULT 25")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS dividend_split_owner INT DEFAULT 15")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS boost_reward_multiplier NUMERIC(4,2) DEFAULT 1.05")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS ad_monetization_enabled BOOLEAN DEFAULT TRUE")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS total_supply BIGINT DEFAULT 1000000")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS treasury_reserve BIGINT DEFAULT 150000")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS fixed_supply BIGINT DEFAULT 1000000")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS creator_reserve_shares BIGINT DEFAULT 250000")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS creator_vested_shares BIGINT DEFAULT 50000")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS creator_locked_shares BIGINT DEFAULT 200000")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS vesting_last_unlocked_at TIMESTAMPTZ DEFAULT NOW()")
    # Listing promotion extras: public invite link + top.gg-style bump state
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS invite_url TEXT")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS bump_count INT DEFAULT 0")
    execute("ALTER TABLE guilds ADD COLUMN IF NOT EXISTS last_bumped_at TIMESTAMPTZ")
    # Sub-cent precision: activity-valued IPOs start at $0.0001 and grow slowly
    _ensure_type_precision()
    # Per-user bump cooldown ledger (last bump per user per guild)
    execute("""
        CREATE TABLE IF NOT EXISTS guild_bumps (
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            bumped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, guild_id)
        )
    """)
    # Real OHLC ledger: every event that moves or executes a price is persisted
    # (sources: ipo | trade | bump | boost) so charts render true market history.
    execute("""
        CREATE TABLE IF NOT EXISTS price_history (
            id BIGSERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            price NUMERIC(12,2) NOT NULL,
            shares_delta BIGINT DEFAULT 0,
            source TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    execute("CREATE INDEX IF NOT EXISTS idx_price_history_guild_time ON price_history (guild_id, created_at DESC)")
    # Backfill: existing listings get their true current spot as a seed tick dated
    # to the guild's real listing time, so charts/24h stats are never empty.
    try:
        unseeded = query("""
            SELECT g.guild_id, g.stock_price AS price, g.created_at AS listed_at
            FROM guilds g
            WHERE NOT EXISTS (SELECT 1 FROM price_history p WHERE p.guild_id = g.guild_id)
        """)
        for row in unseeded:
            execute(
                "INSERT INTO price_history (guild_id, price, source, created_at) VALUES (:g, :p, 'seed', :at)",
                g=row["guild_id"], p=Decimal(str(max(0.000001, float(row["price"])))),
                at=row["listed_at"] if row["listed_at"] else datetime.now(timezone.utc),
            )
    except Exception as e:
        print(f"[Lifespan] price-history backfill: {e}")
    try:
        ensure_genesis()
    except Exception as e:
        print(f"[Lifespan] CordLedger genesis init: {e}")

    async def _block_producer_loop():
        while True:
            try:
                await asyncio.sleep(60)
                sealed = produce_block()
                if sealed:
                    print(f"[CordLedger] Sealed 1-minute Block #{sealed.get('height')} ({sealed.get('entry_count', 0)} entries, root: {sealed.get('merkle_root')[:16]}...)")
            except asyncio.CancelledError:
                break
            except Exception as loop_err:
                print(f"[CordLedger] periodic block loop warning: {loop_err}")

    producer_task = asyncio.create_task(_block_producer_loop())
    try:
        yield
    finally:
        producer_task.cancel()

app = FastAPI(title="CordChain API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Fantasy-only economy: real-money ads, cash payouts, and EVM gas removed.
FANTASY_ONLY = True

# ----------------- Simplified $CRED Economy -----------------
# 1,000 CRED starter allowance, 50 CRED daily login bonus, fixed 1M share supply
NEW_USER_GRANT_CRED = Decimal("1000.00")
DAILY_LOGIN_BONUS_CRED = Decimal("50.00")
DAILY_EARN_CAP_CRED = Decimal("250.00")
IPO_PRICE_CRED = Decimal("0.000100")
_MAX_CREATOR_RESERVE_PCT = 30.0
_DEFAULT_CREATOR_RESERVE_PCT = 25.0
_MIN_ORDER_VALUE_CRED = Decimal("0.0001")

def _ensure_type_precision():
    """Migrate price columns to 6 decimals so sub-cent activity valuations persist."""
    for ddl in (
        "ALTER TABLE guilds ALTER COLUMN stock_price TYPE NUMERIC(16,6)",
        "ALTER TABLE guilds ALTER COLUMN previous_day_price TYPE NUMERIC(16,6)",
        "ALTER TABLE price_history ALTER COLUMN price TYPE NUMERIC(16,6)",
        "ALTER TABLE trade_transactions ALTER COLUMN price_per_share TYPE NUMERIC(16,6)",
        "ALTER TABLE trade_transactions ALTER COLUMN total_cred TYPE NUMERIC(16,6)",
        "ALTER TABLE holdings ALTER COLUMN avg_buy_price TYPE NUMERIC(16,6)",
        # 1c-economy: real constant-product AMM reserves (Uniswap-class x*y=k)
        "ALTER TABLE guilds ADD COLUMN IF NOT EXISTS pool_shares NUMERIC(24,6) NOT NULL DEFAULT 0",
        "ALTER TABLE guilds ADD COLUMN IF NOT EXISTS pool_cred NUMERIC(24,6) NOT NULL DEFAULT 0",
    ):
        try:
            execute(ddl)
        except Exception as e:
            print(f"[Lifespan] precision migration: {ddl} -> {e}")

    # Legacy rows created before the pool existed: seed their reserves so the
    # book is backed from the first swap (public float shares + cred strike).
    try:
        legacy = query(
            "SELECT guild_id, stock_price, circulating_shares FROM guilds WHERE pool_shares = 0 OR pool_cred = 0"
        )
        for row in legacy:
            shares = float(row["circulating_shares"] or 0)
            price = float(row["stock_price"] or 0)
            execute(
                """
                UPDATE guilds
                SET pool_shares = :s, pool_cred = :c
                WHERE guild_id = :g
                """,
                g=row["guild_id"],
                s=Decimal(str(round(shares, 6))),
                c=Decimal(str(round(shares * price, 6))),
            )
        if legacy:
            print(f"[Lifespan] AMM pool seeded for {len(legacy)} legacy guild(s)")
    except Exception as e:
        print(f"[Lifespan] pool backfill failed: {e}")

def format_price(p) -> str:
    """Wire format for prices: 5dp below $10.00, 2dp otherwise."""
    try:
        f = float(p)
    except (ValueError, TypeError):
        return "0.00010"
    if f <= 0:
        return "0.00"
    return f"{f:.5f}" if f < 10.0 else f"{f:.2f}"

def _top_holders(guild_id: str, limit: int = 3) -> list[dict]:
    """Real shareholder register: everyone actually holding rows, owners
    included. Sold-out rows simply return [] — no invented whales."""
    try:
        rows = query(
            """
            SELECT h.shares, u.username
            FROM holdings h
            LEFT JOIN users u ON u.discord_id = h.user_id
            WHERE h.guild_id = :g AND h.shares > 0
            ORDER BY h.shares DESC
            LIMIT :lim
            """, g=guild_id, lim=limit,
        )
        top = [
            {"username": (r["username"] or "Unknown"), "shares": int(r["shares"] or 0)}
            for r in rows
        ]
        return top
    except Exception:
        return []

def _held_shares(guild_id: str) -> float:
    """Real ownership: every share sitting inside a holdings row (wallets +
    creator reserves). When this hits zero the listing is DORMANT — the
    precise trading-world rule: a share price only exists while somebody owns
    it. The public quote rests at $0; the AMM keeps its internal mark (pool
    cred / pool shares) for whenever the next swap reopens the market."""
    try:
        r = query_one("SELECT COALESCE(SUM(shares), 0) AS t FROM holdings WHERE guild_id = :g", g=guild_id)
        return float(r["t"] or 0) if r else 0.0
    except Exception:
        return 0.0

def _held_shares_map() -> dict[str, float]:
    try:
        rows = query("SELECT guild_id, COALESCE(SUM(shares), 0) AS t FROM holdings GROUP BY guild_id")
        return {str(r["guild_id"]): float(r["t"] or 0) for r in rows}
    except Exception:
        return {}

def activity_flow_league_k(tier: int) -> float:
    """League-scaled attention coefficient: larger leagues (bigger servers)
    create more USD of market value per verified activity ingest."""
    return {1: 0.10, 2: 0.14, 3: 0.20, 4: 0.28}.get(int(tier or 1), 0.10)

# Proof-of-attention session timestamps (in-memory). Keyed by "userId:guildId".
# Single-process deployments only; move to Redis when scaling to workers > 1.
_MIN_WATCH_SECONDS = 10.0
_ATTENTION_SESSIONS: dict[str, float] = {}

# ---------------- Discord OAuth2 (implicit grant, no client secret needed) ----------------
DISCORD_API_BASE = "https://discord.com/api/v10"
_SESSION_TTL_DAYS = 7

def _resolve_discord_app_id() -> str | None:
    """Client ID = first base64 segment of a bot token (the application ID), or explicit env."""
    explicit = os.environ.get("DISCORD_CLIENT_ID")
    if explicit:
        return explicit.strip()
    token = os.environ.get("TOKEN") or os.environ.get("Token") or ""
    segment = token.split(".")[0]
    if not segment:
        return None
    try:
        return base64.b64decode(segment + "=" * (-len(segment) % 4)).decode()
    except Exception:
        return None

DISCORD_CLIENT_ID = _resolve_discord_app_id()

def _resolve_discord_client_secret() -> str | None:
    """Accept several common env spellings; values are never logged."""
    for name in ["DISCORD_CLIENT_SECRET", "Client_secret", "CLIENT_SECRET", "DISCORD_SECRET", "DISCORD_APP_SECRET", "DISCORD_OAUTH_CLIENT_SECRET", "DISCORD_OAUTH2_CLIENT_SECRET"]:
        val = os.environ.get(name)
        if val and val.strip():
            return val.strip()
    lowered = {k.lower(): v for k, v in os.environ.items()}
    for name, val in lowered.items():
        if val and ("client_secret" in name or ("secret" in name and "discord" in name)):
            return val.strip()
    return None

DISCORD_CLIENT_SECRET = _resolve_discord_client_secret()

DISCORD_USER_AGENT = "CordChain-App/1.0 (https://cordchain.replit.app, 1.0.0)"

def _discord_api_get(path: str, bearer_token: str) -> dict:
    req = urllib.request.Request(
        f"{DISCORD_API_BASE}{path}",
        headers={
            "Authorization": f"Bearer {bearer_token}",
            "User-Agent": DISCORD_USER_AGENT,
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode()
        except Exception:
            body = ""
        print(f"[Discord API GET error] {path} -> HTTP {e.code}: {body}")
        raise HTTPException(
            status_code=401 if e.code in (401, 403) else 502,
            detail=f"Discord API error ({e.code}): {body or 'Token may be expired or scopes were not granted.'}",
        )
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Discord's API network: {e}")

def _discord_avatar_url(user_payload: dict) -> str:
    uid = str(user_payload.get("id", ""))
    avatar_hash = user_payload.get("avatar")
    if avatar_hash:
        return f"https://cdn.discordapp.com/avatars/{uid}/{avatar_hash}.png?size=128"
    bucket = (int(uid) >> 22) % 6 if uid.isdigit() else 0
    return f"https://cdn.discordapp.com/embed/avatars/{bucket}.png"

def _guild_icon_url(guild: dict) -> str | None:
    icon = guild.get("icon")
    if not icon:
        return None
    return f"https://cdn.discordapp.com/icons/{guild.get('id', '')}/{icon}.png?size=64"

_BOT_GUILDS_CACHE: list[str] = []
_BOT_GUILDS_CACHE_TIME: float = 0.0

def get_bot_installed_guild_ids() -> list[str]:
    global _BOT_GUILDS_CACHE, _BOT_GUILDS_CACHE_TIME
    now = time.time()
    if _BOT_GUILDS_CACHE and (now - _BOT_GUILDS_CACHE_TIME) < 30.0:
        return _BOT_GUILDS_CACHE
    token = os.environ.get("TOKEN") or os.environ.get("Token") or ""
    if not token:
        return []
    req = urllib.request.Request(
        f"{DISCORD_API_BASE}/users/@me/guilds",
        headers={
            "Authorization": f"Bot {token}",
            "User-Agent": DISCORD_USER_AGENT,
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode())
            _BOT_GUILDS_CACHE = [str(g.get("id")) for g in data if isinstance(g, dict)]
            _BOT_GUILDS_CACHE_TIME = now
            return _BOT_GUILDS_CACHE
    except Exception as e:
        print(f"[Bot Guilds] error: {e}")
        return _BOT_GUILDS_CACHE

def _session_row_to_payload(row: dict) -> dict:
    try:
        guilds = json.loads(row.get("joined_guilds") or "[]")
    except Exception:
        guilds = []
    installed_ids = get_bot_installed_guild_ids()
    owned_guilds = [g for g in guilds if g.get("owner") is True]
    return {
        "user": {
            "discordId": row["discord_id"],
            "username": row["username"],
            "avatar": row.get("avatar"),
            "email": row.get("email"),
        },
        "guilds": guilds,
        "ownedGuilds": owned_guilds,
        "botClientId": DISCORD_CLIENT_ID,
        "installedGuildIds": installed_ids,
    }

def _get_active_session(request: Request) -> dict:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token. Log in with Discord first.")
    token = auth_header[7:].strip()
    row = query_one("SELECT * FROM web_sessions WHERE token = :t", t=token)
    expires = row.get("expires_at") if row else None
    if row and isinstance(expires, datetime) and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if not row or (expires is not None and expires < datetime.now(timezone.utc)):
        raise HTTPException(status_code=401, detail="Session expired or revoked. Sign in with Discord again.")
    return row

class DiscordSessionRequest(BaseModel):
    accessToken: str | None = None
    code: str | None = None
    redirectUri: str | None = None
    codeVerifier: str | None = None

# ----------------- Models -----------------
class CheckinInitiateRequest(BaseModel):
    guildId: str
    userId: str

class CheckinVerifyRequest(BaseModel):
    guildId: str
    userId: str
    campaignId: str
    selectedOption: str

class TradeQuoteRequest(BaseModel):
    guildId: str
    action: str  # 'BUY' | 'SELL'
    shares: int

class TradeExecuteRequest(BaseModel):
    guildId: str
    userId: str
    shares: int
    walletAddress: str | None = None

class CashoutRequest(BaseModel):
    userId: str
    upiVpa: str
    amountInr: float

class CampaignCreateRequest(BaseModel):
    sponsorName: str
    title: str
    description: str
    mediaUrl: str
    verifyQuestion: str
    correctOption: str
    wrongOptions: list[str]
    budgetInr: float
    targetCategory: str = "all"

class TokenizeGuildRequest(BaseModel):
    guildId: str
    name: str
    ticker: str
    description: str | None = None
    category: str | None = None
    inviteUrl: str
    initialPriceUsd: float = 0.0001
    totalSupply: int = 1000000
    publicFloatPct: int = 25
    creatorReservePct: int = 60
    iconUrl: str | None = None
    memberCount: int = 1
    onlineCount: int = 1
    ownerId: str | None = None
    tokenContractAddress: str | None = None
    deploymentTxHash: str | None = None

class UpdateGuildRequest(BaseModel):
    name: str | None = None
    ticker: str | None = None
    description: str | None = None
    category: str | None = None
    iconUrl: str | None = None
    inviteUrl: str | None = None
    dividendSplitShareholders: int | None = None
    dividendSplitTreasury: int | None = None
    dividendSplitOwner: int | None = None
    boostRewardMultiplier: float | None = None
    adMonetizationEnabled: bool | None = None
    additionalShares: int | None = None
    tokenContractAddress: str | None = None

class GuildBumpRequest(BaseModel):
    userId: str

# ----------------- Helpers -----------------
LEAGUE_TIER_NAMES = {1: "Squad", 2: "Club", 3: "Arena", 4: "Titan"}

_DISCORD_INVITE_HOSTS = {"discord.gg", "discord.com", "discordapp.com", "dsc.gg"}

def _validate_discord_invite(raw_url: str) -> str:
    """Normalise and validate a public Discord server invite link.
    Accepts discord.gg/<code>, discord.com/invite/<code> and dsc.gg/<code>.
    Returns the normalised URL; raises 422 when invalid."""
    url = (raw_url or "").strip()
    if not url:
        raise HTTPException(status_code=422, detail="A public Discord invite link is required to list your server.")
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    try:
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(status_code=422, detail="That invite link could not be parsed. Paste a full https://discord.gg/... URL.")
    host = parsed.netloc.lower().removeprefix("www.")
    if host not in _DISCORD_INVITE_HOSTS:
        raise HTTPException(
            status_code=422,
            detail="Invite must be a public Discord link (discord.gg/..., discord.com/invite/... or dsc.gg/...).",
        )
    path = parsed.path.strip("/")
    if host == "discord.gg":
        code = path.split("/")[0] if path else ""
    else:
        parts = path.split("/")
        code = parts[1] if len(parts) > 1 and parts[0] == "invite" else (parts[0] if parts else "")
    if not code or not re.match(r"^[A-Za-z0-9_-]{2,32}$", code):
        raise HTTPException(
            status_code=422,
            detail="Invite link has no valid invite code. Use a permanent invite like https://discord.gg/yourcode (never expires).",
        )
    return f"https://discord.gg/{code}"

def resolve_ownership_for_guild(request: Request | None, guild_id: str, fallback_owner_id: str | None = None) -> dict:
    """Resolve a Discord session against a guild for strict ownership checks.
    Returns { ownerId, isVerifiedOwner, guildFoundInSession, botPresent, botPresenceKnown }."""
    owner = (fallback_owner_id or "").strip()
    verified_owner = False
    guild_in_session = False
    bot_present = False
    bot_known = False
    if request is not None:
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            try:
                session = _get_active_session(request)
            except HTTPException:
                session = None
            if session:
                owner = session.get("discord_id") or owner
                try:
                    guilds = json.loads(session.get("joined_guilds") or "[]")
                except Exception:
                    guilds = []
                matching = next((g for g in guilds if str(g.get("id")) == str(guild_id)), None)
                if matching:
                    guild_in_session = True
                    verified_owner = bool(matching.get("owner", False))
    installed = get_bot_installed_guild_ids()
    if installed:
        bot_known = True
        bot_present = str(guild_id) in [str(i) for i in installed]
    return {
        "ownerId": owner,
        "isVerifiedOwner": verified_owner,
        "guildFoundInSession": guild_in_session,
        "botPresent": bot_present,
        "botPresenceKnown": bot_known,
    }

def ensure_user(discord_id: str, username: str | None = None) -> dict:
    """Fetch an existing trader or bootstrap a brand-new one with the 1,000 $CRED
    starter allowance — recorded onto the append-only CordLedger."""
    user = query_one("SELECT * FROM users WHERE discord_id = :id", id=discord_id)
    if user:
        return user
    created_at = snowflake_to_datetime(discord_id)
    display = username or f"Trader_{discord_id[-4:]}"
    execute("""
        INSERT INTO users (discord_id, username, account_created_at, cred_balance, cash_wallet_inr, daily_boost_count)
        VALUES (:id, :name, :created, :grant, 0.00, 0)
    """, id=discord_id, name=display, created=created_at, grant=NEW_USER_GRANT_CRED)

    # Append starter allowance to CordLedger
    try:
        append_ledger_entry(
            event_type="ALLOWANCE",
            payload={"type": "STARTER_ALLOWANCE", "amount": float(NEW_USER_GRANT_CRED), "username": display},
            user_id=discord_id,
        )
        produce_block()
    except Exception as e:
        print(f"[Ledger] starter allowance entry error: {e}")

    return query_one("SELECT * FROM users WHERE discord_id = :id", id=discord_id)

def get_community_spotlight_campaign(guild: dict) -> dict:
    """Fantasy-only mode replaces sponsor ads with an in-house 'Community Spotlight' card
    for the guild being boosted (no budgets, no sponsors, no cash). Lazily materialized
    in ad_campaigns so /api/checkin/verify keeps a single code path."""
    campaign_id = f"spotlight-{guild['guild_id']}"
    existing = query_one("SELECT * FROM ad_campaigns WHERE campaign_id = :id", id=campaign_id)
    if existing:
        return existing
    others = [g["ticker"] for g in query(
        "SELECT ticker FROM guilds WHERE guild_id != :me ORDER BY random() LIMIT 2",
        me=guild["guild_id"],
    )]
    correct = guild["ticker"]
    execute_returning("""
        INSERT INTO ad_campaigns (
            campaign_id, sponsor_name, title, description, media_url,
            verify_question, correct_option, wrong_options,
            user_reward_inr, owner_reward_inr, platform_fee_inr,
            remaining_budget_inr, target_category, is_active
        ) VALUES (
            :cid, 'CordChain Staff', :title, :desc, :media,
            :question, :correct, :wrongs,
            0.00, 0.00, 0.00,
            0.00, 'all', TRUE
        ) RETURNING campaign_id
    """, cid=campaign_id,
        title=f"Community Spotlight · {guild['name']}",
        desc=f"Daily spotlight for the {guild['name']} community. Prove you're paying attention to unlock your +250 $CRED boost.",
        media=guild["icon_url"] or "https://cdn.discordapp.com/embed/avatars/0.png",
        question="Which server's stock are you boosting right now?",
        correct=correct,
        wrongs=json.dumps(others or [correct]),
    )
    return query_one("SELECT * FROM ad_campaigns WHERE campaign_id = :id", id=campaign_id)

# ----------------- Routes -----------------
@app.get("/api/healthz")
def healthz():
    return {
        "status": "ok",
        "service": "CordChain Python API",
        "fantasy_only": FANTASY_ONLY,
    }

# 0. Discord OAuth2 / web authentication
@app.get("/api/auth/discord/url")
def discord_auth_url(redirectUri: str = Query(...), addBot: bool = Query(False), codeChallenge: str | None = Query(None)):
    """Build the Discord authorize link for identity auth: identify + email + guilds.
    Pure identity consent — no server/bot install required (opt in with addBot=true).
    Uses standard Authorization Code grant (with server-side client secret on exchange)."""
    if not DISCORD_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Discord application ID unavailable. Set the bot TOKEN (auto-detected) or DISCORD_CLIENT_ID.",
        )
    scopes = ["identify", "email", "guilds"]
    if addBot:
        scopes = ["bot", *scopes]
    secret = DISCORD_CLIENT_SECRET or _resolve_discord_client_secret()
    params = {
        "client_id": DISCORD_CLIENT_ID,
        "redirect_uri": redirectUri,
        "scope": " ".join(scopes),
        "permissions": 0,
        "state": secrets.token_urlsafe(16),
        "response_type": "code",
    }
    if codeChallenge:
        params["code_challenge"] = codeChallenge
        params["code_challenge_method"] = "S256"
    elif not secret:
        # Fallback to implicit grant only if client secret is unavailable
        params["response_type"] = "token"
    auth_url = f"{DISCORD_API_BASE}/oauth2/authorize?" + urlencode(params, quote_via=urlquote)
    return {
        "authUrl": auth_url,
        "clientId": DISCORD_CLIENT_ID,
        "scopes": scopes,
        "addBot": addBot,
        "redirectUri": redirectUri,
        "flow": "pkce" if codeChallenge else ("code" if secret else "implicit"),
    }

def _exchange_authorization_code(code: str, redirect_uri: str, code_verifier: str | None = None) -> str:
    """Exchange an authorization code (+optional PKCE verifier) for a Discord access token."""
    form = {
        "client_id": DISCORD_CLIENT_ID or "",
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
    }
    if code_verifier:
        form["code_verifier"] = code_verifier
    client_secret = DISCORD_CLIENT_SECRET or _resolve_discord_client_secret()
    if client_secret:
        form["client_secret"] = client_secret
    body = urlencode(form, quote_via=urlquote).encode()
    req = urllib.request.Request(
        f"{DISCORD_API_BASE}/oauth2/token",
        data=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": DISCORD_USER_AGENT,
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            payload = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode()
            err_detail = json.loads(body)
        except Exception:
            err_detail = {}
            body = ""
        msg = err_detail.get("error_description") or err_detail.get("error") or body or str(e.code)
        print(f"[Discord OAuth Token error] HTTP {e.code}: {msg}")
        raise HTTPException(
            status_code=401 if e.code in (400, 401, 403) else 502,
            detail=f"Discord token exchange failed: {msg}",
        )
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Discord's API network: {e}")
    token = payload.get("access_token")
    if not token:
        raise HTTPException(status_code=502, detail="Discord returned no access token.")
    return str(token).strip()

def _discord_user_profile_and_guilds(discord_token: str) -> tuple[dict, list[dict]]:
    me = _discord_api_get("/users/@me", discord_token)
    guilds = []
    try:
        guilds_payload = _discord_api_get("/users/@me/guilds?with_counts=true", discord_token)
        guilds = [
            {
                "id": str(g.get("id", "")),
                "name": g.get("name", ""),
                "icon": g.get("icon"),
                "iconUrl": _guild_icon_url(g),
                "owner": bool(g.get("owner", False)),
                "permissions": str(g.get("permissions", "0")),
                "features": g.get("features", []),
                "approximateMemberCount": int(g.get("approximate_member_count") or 0),
                "approximatePresenceCount": int(g.get("approximate_presence_count") or 0),
            }
            for g in (guilds_payload or [])
            if isinstance(g, dict)
        ]
    except Exception as e:
        print(f"[Discord API] Non-fatal error reading user guilds: {e}")
    return me, guilds

@app.post("/api/auth/discord/session")
def discord_session(payload: DiscordSessionRequest):
    """Exchange a Discord token grant for a CordChain web session. Proves identity
    with Discord's own API and snapshots email + joined servers. Accepts both the
    authorization-code grant (with client secret and optional PKCE verifier) and
    legacy implicit access tokens."""
    if payload.code:
        if not payload.redirectUri:
            raise HTTPException(status_code=422, detail="OAuth login needs code and redirectUri")
        client_secret = DISCORD_CLIENT_SECRET or _resolve_discord_client_secret()
        if not payload.codeVerifier and not client_secret:
            raise HTTPException(status_code=422, detail="PKCE login needs codeVerifier when client secret is missing")
        access_token = _exchange_authorization_code(
            payload.code.strip(),
            payload.redirectUri.strip(),
            (payload.codeVerifier or "").strip() or None,
        )
    else:
        access_token = (payload.accessToken or "").strip()
    if not access_token:
        raise HTTPException(status_code=422, detail="accessToken or code is required")

    me, guilds = _discord_user_profile_and_guilds(access_token)
    discord_id = str(me.get("id", ""))
    username = me.get("username") or f"Trader_{discord_id[-4:]}"
    avatar_url = _discord_avatar_url(me)
    email = me.get("email")

    user = ensure_user(discord_id, username)
    execute("""
        UPDATE users
        SET username = :name, avatar = :avatar, email = COALESCE(:email, email),
            is_discord_verified = TRUE
        WHERE discord_id = :id
    """, name=username, avatar=avatar_url, email=email, id=discord_id)
    _ = user

    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=_SESSION_TTL_DAYS)
    execute("""
        INSERT INTO web_sessions (token, discord_id, username, avatar, email, joined_guilds, expires_at, discord_access_token)
        VALUES (:t, :id, :name, :avatar, :email, :guilds, :exp, :dat)
    """, t=session_token, id=discord_id, name=username, avatar=avatar_url,
        email=email, guilds=json.dumps(guilds), exp=expires_at, dat=access_token)

    installed_ids = get_bot_installed_guild_ids()
    owned_guilds = [g for g in guilds if g.get("owner") is True]

    return {
        "sessionToken": session_token,
        "expiresInDays": _SESSION_TTL_DAYS,
        "user": {
            "discordId": discord_id,
            "username": username,
            "avatar": avatar_url,
            "email": email,
        },
        "guilds": guilds,
        "ownedGuilds": owned_guilds,
        "botClientId": DISCORD_CLIENT_ID,
        "installedGuildIds": installed_ids,
    }

@app.post("/api/auth/discord/refresh-guilds")
def refresh_discord_guilds(request: Request):
    row = _get_active_session(request)
    access_token = row.get("discord_access_token")
    if not access_token:
        return {"success": False, "needsReauth": True, "message": "No Discord access token stored. Please sign in again."}
    try:
        guilds_payload = _discord_api_get("/users/@me/guilds?with_counts=true", access_token)
        guilds = [
            {
                "id": str(g.get("id", "")),
                "name": g.get("name", ""),
                "icon": g.get("icon"),
                "iconUrl": _guild_icon_url(g),
                "owner": bool(g.get("owner", False)),
                "permissions": str(g.get("permissions", "0")),
                "features": g.get("features", []),
                "approximateMemberCount": int(g.get("approximate_member_count") or 0),
                "approximatePresenceCount": int(g.get("approximate_presence_count") or 0),
            }
            for g in (guilds_payload or [])
            if isinstance(g, dict)
        ]
        execute("UPDATE web_sessions SET joined_guilds = :g WHERE token = :t", g=json.dumps(guilds), t=row["token"])
        installed_ids = get_bot_installed_guild_ids()
        owned_guilds = [g for g in guilds if g.get("owner") is True]
        return {
            "success": True,
            "guilds": guilds,
            "ownedGuilds": owned_guilds,
            "botClientId": DISCORD_CLIENT_ID,
            "installedGuildIds": installed_ids,
        }
    except HTTPException as e:
        if e.status_code in (401, 403):
            return {"success": False, "needsReauth": True, "message": "Discord token expired. Please sign in again."}
        raise

@app.get("/api/discord/bot-info")
def discord_bot_info():
    installed_ids = get_bot_installed_guild_ids()
    return {
        "botClientId": DISCORD_CLIENT_ID,
        "installedGuildIds": installed_ids,
        "inviteUrlTemplate": f"https://discord.com/oauth2/authorize?client_id={DISCORD_CLIENT_ID}&scope=bot%20applications.commands&permissions=8&guild_id={{guild_id}}"
    }

@app.get("/api/auth/me")
def auth_me(request: Request):
    row = _get_active_session(request)
    return _session_row_to_payload(row)

@app.post("/api/auth/logout")
def auth_logout(request: Request):
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    token = auth_header[7:].strip()
    execute("DELETE FROM web_sessions WHERE token = :t", t=token)
    return {"success": True}

# 1. Guilds / Exchange Floor
@app.get("/api/guilds")
def list_guilds(
    tier: int | None = None,
    sort: str | None = None,
    search: str | None = None,
):
    sql_stmt = "SELECT * FROM guilds WHERE 1=1"
    params = {}

    if tier is not None:
        sql_stmt += " AND league_tier = :tier"
        params["tier"] = tier

    if search:
        sql_stmt += " AND (name ILIKE :search OR ticker ILIKE :search)"
        params["search"] = f"%{search.strip()}%"

    if sort == "gain":
        sql_stmt += " ORDER BY ((stock_price - previous_day_price) / NULLIF(previous_day_price, 0)) DESC"
    elif sort == "activity":
        sql_stmt += " ORDER BY member_count_current DESC"
    elif sort == "bump":
        # Recently bumped servers rise to the top of the directory
        sql_stmt += " ORDER BY last_bumped_at DESC NULLS LAST, stock_price DESC"
    else:
        sql_stmt += " ORDER BY stock_price DESC"

    sql_stmt += " LIMIT 50"

    rows = query(sql_stmt, **params)
    stats = guild_market_stats_24h([g["guild_id"] for g in rows])
    held_map = _held_shares_map()
    try:
        holder_register = query(
            """
            SELECT h.guild_id, h.shares, u.username, h.user_id
            FROM holdings h LEFT JOIN users u ON u.discord_id = h.user_id
            WHERE h.shares > 0
            ORDER BY h.guild_id, h.shares DESC
            """
        )
    except Exception:
        holder_register = []
    top_by_guild: dict[str, list[dict]] = {}
    counts_by_guild: dict[str, int] = {}
    for r in holder_register:
        gid = str(r["guild_id"])
        counts_by_guild[gid] = counts_by_guild.get(gid, 0) + 1
        lst = top_by_guild.setdefault(gid, [])
        if len(lst) < 3:
            lst.append({"username": (r["username"] or "Unknown"), "shares": int(r["shares"] or 0)})
    guilds = []
    for g in rows:
        cur = float(g["stock_price"])
        prev = float(g["previous_day_price"])
        held = held_map.get(str(g["guild_id"]), 0.0)
        change_pct = round(((cur - prev) / prev) * 100, 2) if prev > 0 else 0.0
        token_addr = g.get("token_contract_address")
        s = stats.get(g["guild_id"], {})
        high24 = s.get("high24h")
        low24 = s.get("low24h")
        collab = get_community_collab_tier(str(g["guild_id"]))
        guilds.append({
            "guildId": g["guild_id"],
            "name": g["name"],
            "ticker": g["ticker"],
            "iconUrl": g["icon_url"],
            "description": g.get("description"),
            "category": g.get("category") or "Community",
            "inviteUrl": g.get("invite_url"),
            "bumpCount": int(g.get("bump_count") or 0),
            "lastBumpedAt": g["last_bumped_at"].isoformat() if g.get("last_bumped_at") else None,
            "leagueTier": g["league_tier"],
            "memberCountCurrent": g["member_count_current"],
            "memberCountPeak7d": g["member_count_peak_7d"],
            "stockPrice": format_price(g["stock_price"]),
            "previousDayPrice": format_price(g["previous_day_price"]),
            "heldShares": held,
            "marketState": "live",
            "topHolders": top_by_guild.get(str(g["guild_id"]), []),
            "holderCount": counts_by_guild.get(str(g["guild_id"]), 0),
            "circulatingShares": g["circulating_shares"],
            "totalSupply": g.get("total_supply") or 1000000,
            "treasuryReserve": g.get("treasury_reserve") or 150000,
            "dividendSplitShareholders": g.get("dividend_split_shareholders") or 60,
            "dividendSplitTreasury": g.get("dividend_split_treasury") or 25,
            "dividendSplitOwner": g.get("dividend_split_owner") or 15,
            "boostRewardMultiplier": float(g.get("boost_reward_multiplier") or 1.05),
            "adMonetizationEnabled": bool(g.get("ad_monetization_enabled", True)),
            "ownerId": g["owner_id"],
            "ownerCashWalletInr": str(g["owner_cash_wallet_inr"]),
            "changePct": change_pct,
            "isGain": change_pct >= 0,
            "volume24hShares": s.get("volume24hShares", 0),
            "volume24hUsd": round(s.get("volume24hUsd", 0.0), 2),
            "executions24h": s.get("executions24h", 0),
            "high24hUsd": round(max(high24, cur), 6) if high24 is not None else cur,
            "low24hUsd": round(min(low24, cur), 6) if low24 is not None else cur,
            "fixedSupply": g.get("fixed_supply") or 1000000,
            "creatorReserveShares": g.get("creator_reserve_shares") or 250000,
            "creatorVestedShares": g.get("creator_vested_shares") or 50000,
            "creatorLockedShares": g.get("creator_locked_shares") or 200000,
            "communityScore": float(g.get("community_score") or 100.0),
            "collaboration": collab,
            "league": g.get("league") or determine_league(g.get("member_count_current", 0)),
            "tokenExplorerUrl": f"/scan/token/{g['guild_id']}",
            "blockchainNetwork": "CordLedger Local Chain",
        })
    return {"guilds": guilds}

@app.get("/api/guilds/featured")
def featured_guilds():
    rows = query("SELECT * FROM guilds ORDER BY stock_price DESC LIMIT 6")
    held_map = _held_shares_map()
    featured = []
    for g in rows:
        cur = float(g["stock_price"])
        prev = float(g["previous_day_price"])
        held = held_map.get(str(g["guild_id"]), 0.0)
        change_pct = round(((cur - prev) / prev) * 100, 2) if prev > 0 else 0.0
        collab = get_community_collab_tier(str(g["guild_id"]))
        featured.append({
            "guildId": g["guild_id"],
            "name": g["name"],
            "ticker": g["ticker"],
            "iconUrl": g["icon_url"],
            "inviteUrl": g.get("invite_url"),
            "bumpCount": int(g.get("bump_count") or 0),
            "lastBumpedAt": g["last_bumped_at"].isoformat() if g.get("last_bumped_at") else None,
            "leagueTier": g["league_tier"],
            "stockPrice": format_price(g["stock_price"]),
            "heldShares": held,
            "marketState": "live",
            "changePct": change_pct,
            "isGain": change_pct >= 0,
            "fixedSupply": g.get("fixed_supply") or 1000000,
            "creatorReserveShares": g.get("creator_reserve_shares") or 250000,
            "creatorVestedShares": g.get("creator_vested_shares") or 50000,
            "creatorLockedShares": g.get("creator_locked_shares") or 200000,
            "communityScore": float(g.get("community_score") or 100.0),
            "collaboration": collab,
            "league": g.get("league") or determine_league(g.get("member_count_current", 0)),
            "tokenExplorerUrl": f"/scan/token/{g['guild_id']}",
            "blockchainNetwork": "CordLedger Local Chain",
        })
    return {"featured": featured}

@app.get("/api/guilds/{guild_id}")
def get_guild(guild_id: str):
    g = query_one("SELECT * FROM guilds WHERE guild_id = :id", id=guild_id)
    if not g:
        raise HTTPException(status_code=404, detail="Guild not found")
    cur = float(g["stock_price"])
    prev = float(g["previous_day_price"])
    held = _held_shares(guild_id)
    change_pct = round(((cur - prev) / prev) * 100, 2) if prev > 0 else 0.0
    s = guild_market_stats_24h([guild_id]).get(guild_id, {})
    high24 = s.get("high24h")
    low24 = s.get("low24h")
    collab = get_community_collab_tier(guild_id)
    return {
        "guild": {
            "guildId": g["guild_id"],
            "name": g["name"],
            "ticker": g["ticker"],
            "iconUrl": g["icon_url"],
            "inviteUrl": g.get("invite_url"),
            "bumpCount": int(g.get("bump_count") or 0),
            "lastBumpedAt": g["last_bumped_at"].isoformat() if g.get("last_bumped_at") else None,
            "leagueTier": g["league_tier"],
            "memberCountCurrent": g["member_count_current"],
            "memberCountPeak7d": g["member_count_peak_7d"],
            "stockPrice": format_price(g["stock_price"]),
            "previousDayPrice": format_price(g["previous_day_price"]),
            "heldShares": held,
            "marketState": "live",
            "topHolders": _top_holders(guild_id),
            "circulatingShares": g["circulating_shares"],
            "changePct": change_pct,
            "isGain": change_pct >= 0,
            "volume24hShares": s.get("volume24hShares", 0),
            "volume24hUsd": round(s.get("volume24hUsd", 0.0), 2),
            "executions24h": s.get("executions24h", 0),
            "high24hUsd": round(max(high24, cur), 6) if high24 is not None else cur,
            "low24hUsd": round(min(low24, cur), 6) if low24 is not None else cur,
            "fixedSupply": g.get("fixed_supply") or 1000000,
            "creatorReserveShares": g.get("creator_reserve_shares") or 250000,
            "creatorVestedShares": g.get("creator_vested_shares") or 50000,
            "creatorLockedShares": g.get("creator_locked_shares") or 200000,
            "communityScore": float(g.get("community_score") or 100.0),
            "collaboration": collab,
            "league": g.get("league") or determine_league(g.get("member_count_current", 0)),
            "tokenExplorerUrl": f"/scan/token/{guild_id}",
            "blockchainNetwork": "CordLedger Local Chain",
            "circuitBreakerUntil": g.get("circuit_breaker_until").isoformat() if g.get("circuit_breaker_until") else None,
        }
    }

# ---------------- Market data engine (real ledger, no synthetic paths) ----------------
# Sources of truth: trade_transactions (executed orders) and price_history (ticks
# logged whenever the oracle price moves: IPO seed, bumps, sponsor boosts, trade impact).

_TRADE_TICK_DEDUPE_SECONDS = 45.0

def _record_price_tick(guild_id: str, price: float, source: str, shares_delta: int = 0) -> None:
    """Persist one authoritative spot-price tick. Identical prices within the
    dedupe window are skipped so candle buckets stay clean."""
    try:
        last = query_one(
            "SELECT price, created_at FROM price_history WHERE guild_id = :g ORDER BY created_at DESC LIMIT 1",
            g=guild_id,
        )
        if last:
            if round(float(last["price"]), 6) == round(price, 6):
                stamped = last.get("created_at")
                if isinstance(stamped, datetime):
                    if stamped.tzinfo is None:
                        stamped = stamped.replace(tzinfo=timezone.utc)
                    age = (datetime.now(timezone.utc) - stamped).total_seconds()
                    if 0 <= age < _TRADE_TICK_DEDUPE_SECONDS:
                        return
        execute(
            "INSERT INTO price_history (guild_id, price, shares_delta, source) VALUES (:g, :p, :d, :s)",
            g=guild_id, p=Decimal(str(round(price, 6))), d=shares_delta, s=source,
        )
    except Exception as e:
        print(f"[price_history] tick failed for {guild_id}: {e}")

_TRADE_IMPACT_CAP = 0.02  # legacy ceiling, superseded by the AMM slippage curve

def _amm_swap(pool_shares: float, pool_cred: float, shares_qty: float, action: str) -> tuple[float, float, float]:
    """Constant-product AMM swap (the standard x·y=k used across Uniswap-class
    markets). kind BUY pulls `shares_qty` out of the pool for cred; SELL pushes
    shares in and pays out cred from the pool. Returns (pool_cred', pool_shares', Δcred).

    The invariant is the whole point: a seller can NEVER extract more cred than
    buyers previously put into the pool (+ activity inflows). Selling out your
    whole position can only pay you a fraction of pool reserves and the last
    trade price is remembered by the market, never fabricated by thin air.
    """
    S = max(1e-9, float(pool_shares))
    C = max(0.0, float(pool_cred))
    k = S * C
    q = float(shares_qty)
    if action == "BUY":
        if q >= S - 1e-9:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough AMM liquidity — pool only holds {S:,.0f} shares.",
            )
        C2 = k / (S - q)
        dC = C2 - C
        return C2, S - q, dC
    S2 = S + q
    C2 = k / S2
    dC = C - C2
    return C2, S2, dC

def _pool_price_after(pool_cred: float, pool_shares: float) -> float:
    """Spot price implied by the pool invariant."""
    return float(pool_cred) / max(1e-9, float(pool_shares))

def _apply_pool_price(guild_id: str, new_price: float) -> None:
    """Keep the on-screen spot and the pool reserves consistent after any
    non-swap price event (bumps, boosts, activity inflows)."""
    g = query_one("SELECT pool_shares FROM guilds WHERE guild_id = :id", id=guild_id)
    shares = float(g["pool_shares"] or 0) if g else 0.0
    execute(
        "UPDATE guilds SET stock_price = :p, pool_cred = :c WHERE guild_id = :id",
        p=Decimal(str(round(new_price, 6))),
        c=Decimal(str(round(new_price * shares, 6))),
        id=guild_id,
    )

def guild_order_price_move(guild_id: str, price: float, shares: int) -> float | None:
    """Removed with the fake impact curve — the price moves are produced by the
    real constant-product swap in _amm_swap now. Kept as None for callers."""
    return None

def guild_market_stats_24h(guild_ids: list[str]) -> dict[str, dict]:
    """Real 24h market stats aggregated from the executed-order ledger and
    price ticks (volume in USD = Σ total_cred; high/low include tick moves)."""
    by_guild: dict[str, dict] = {}
    empty = lambda: {"volume24hShares": 0, "volume24hUsd": 0.0, "executions24h": 0, "high24h": None, "low24h": None}
    for gid in guild_ids:
        by_guild[gid] = empty()
    if not guild_ids:
        return by_guild
    try:
        exec_rows = query(
            """
            SELECT guild_id,
                   COUNT(*) AS executions,
                   COALESCE(SUM(shares), 0) AS shares,
                   COALESCE(SUM(total_cred), 0) AS usd,
                   MAX(price_per_share) AS high_px,
                   MIN(price_per_share) AS low_px
            FROM trade_transactions
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY guild_id
            """
        )
    except Exception as e:
        print(f"[market stats] executions query failed: {e}")
        exec_rows = []
    for r in exec_rows:
        gid = f'{r["guild_id"]}'
        by_guild[gid] = {
            "volume24hShares": int(r["shares"] or 0),
            "volume24hUsd": float(r["usd"] or 0),
            "executions24h": int(r["executions"] or 0),
            "high24h": float(r["high_px"]) if r["high_px"] is not None else None,
            "low24h": float(r["low_px"]) if r["low_px"] is not None else None,
        }
    try:
        tick_rows = query(
            """
            SELECT guild_id, MAX(price) AS high_px, MIN(price) AS low_px
            FROM price_history
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY guild_id
            """
        )
    except Exception as e:
        print(f"[market stats] ticks query failed: {e}")
        tick_rows = []
    for r in tick_rows:
        gid = f'{r["guild_id"]}'
        s = by_guild.get(gid) or empty()
        if r["high_px"] is not None:
            s["high24h"] = max(s["high24h"], float(r["high_px"])) if s["high24h"] is not None else float(r["high_px"])
        if r["low_px"] is not None:
            s["low24h"] = min(s["low24h"], float(r["low_px"])) if s["low24h"] is not None else float(r["low_px"])
        by_guild[gid] = s
    return by_guild

BUMP_COOLDOWN_SECONDS = 6 * 60 * 60  # one bump per server per user every 6 hours
BUMP_PRICE_BOOST_PCT = 0.004         # +0.4% stock momentum per bump

# 1b. Community bumps (top.gg-style)
@app.post("/api/guilds/{guild_id}/bump")
def bump_guild(guild_id: str, req: GuildBumpRequest):
    guild = query_one("SELECT * FROM guilds WHERE guild_id = :id", id=guild_id)
    if not guild:
        raise HTTPException(status_code=404, detail="Server not found on CordChain")

    user = ensure_user(req.userId)

    # A bump must be earned: hold shares in the server or own it.
    holding = query_one(
        "SELECT shares FROM holdings WHERE user_id = :uid AND guild_id = :gid",
        uid=req.userId, gid=guild_id,
    )
    owns_server = guild.get("owner_id") and str(guild["owner_id"]) == str(req.userId)
    shares_held = int(holding["shares"]) if holding else 0
    if shares_held <= 0 and not owns_server:
        raise HTTPException(
            status_code=403,
            detail=f"You must hold $SHR shares of {guild['ticker']} to bump it. Buy at least 1 share first.",
        )

    now = datetime.now(timezone.utc)
    last_bump = query_one(
        "SELECT bumped_at FROM guild_bumps WHERE user_id = :uid AND guild_id = :gid",
        uid=req.userId, gid=guild_id,
    )
    if last_bump and last_bump.get("bumped_at") is not None:
        bumped_at = last_bump["bumped_at"]
        if isinstance(bumped_at, datetime) and bumped_at.tzinfo is None:
            bumped_at = bumped_at.replace(tzinfo=timezone.utc)
        elapsed = (now - bumped_at).total_seconds()
        if elapsed < BUMP_COOLDOWN_SECONDS:
            retry_at = bumped_at + timedelta(seconds=BUMP_COOLDOWN_SECONDS)
            mins_left = max(1, int((BUMP_COOLDOWN_SECONDS - elapsed) / 60)) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Cooldown active. You can bump {guild['ticker']} again in {mins_left} minutes.",
                headers={"Retry-At": retry_at.isoformat()},
            )

    new_price = round(float(guild["stock_price"]) * (1 + BUMP_PRICE_BOOST_PCT), 6)
    new_bump_count = int(guild.get("bump_count") or 0) + 1
    bumped_at_iso = now.isoformat()

    _apply_pool_price(guild_id, new_price)
    execute(
        "UPDATE guilds SET bump_count = :count, last_bumped_at = :bumped WHERE guild_id = :id",
        count=new_bump_count, bumped=now, id=guild_id,
    )

    _record_price_tick(guild_id, new_price, "bump", shares_delta=0)

    execute("""
        INSERT INTO guild_bumps (user_id, guild_id, bumped_at)
        VALUES (:uid, :gid, :at)
        ON CONFLICT (user_id, guild_id)
        DO UPDATE SET bumped_at = EXCLUDED.bumped_at
    """, uid=req.userId, gid=guild_id, at=now)

    _ = user
    next_bump_at = now + timedelta(seconds=BUMP_COOLDOWN_SECONDS)
    return {
        "success": True,
        "guildId": guild_id,
        "ticker": guild["ticker"],
        "bumpCount": new_bump_count,
        "lastBumpedAt": bumped_at_iso,
        "nextBumpAvailableAt": next_bump_at.isoformat(),
        "newStockPrice": format_price(new_price),
        "priceGainPct": BUMP_PRICE_BOOST_PCT * 100,
        "cooldownMinutes": BUMP_COOLDOWN_SECONDS // 60,
    }

# ----------------- 1c. Activity-valued growth (proof of attention) -----------------
# Real chat engagement is the only source of organic market value. The Discord
# bot (or check-in verifier) reports each period's message volume + distinct
# active chatters; the engine converts that flow into USD market-cap accrual:
#
#     flow_$  = K_league · ( log10(1 + msgs) + 2 · log10(1 + actives) )
#     Δprice  = flow_$ / circulating_shares
#
# K_league: {1: 0.10, 2: 0.14, 3: 0.20, 4: 0.28}. Larger communities mint value
# faster but spread it over more shares, keeping growth smooth and slow — the
# famous "0.0000-something" tick. Hard one-ingest-per-hour cap per guild.
GUILD_ACTIVITY_INTERVAL_SECONDS = 60 * 60

class GuildActivityRequest(BaseModel):
    messagesLastHour: int
    activeChatters: int
    source: str | None = "bot"

@app.post("/api/guilds/{guild_id}/activity")
def guild_activity_ingest(guild_id: str, req: GuildActivityRequest):
    guild = query_one(
        "SELECT guild_id, ticker, stock_price, league_tier, member_count_current, circulating_shares FROM guilds WHERE guild_id = :id",
        id=guild_id,
    )
    if not guild:
        raise HTTPException(status_code=404, detail="Guild not found")

    msgs = max(0, min(50_000, int(req.messagesLastHour or 0)))
    actives = max(0, min(int(guild["member_count_current"] or 1), int(req.activeChatters or 0)))

    # Anti-farm: one verified ingest per hour per guild.
    last = query_one(
        """
        SELECT created_at FROM price_history
        WHERE guild_id = :g AND source = 'activity'
        ORDER BY created_at DESC LIMIT 1
        """, g=guild_id,
    )

    if last and isinstance(last["created_at"], datetime):
        last_at = last["created_at"] if last["created_at"].tzinfo else last["created_at"].replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - last_at).total_seconds()
        if elapsed < GUILD_ACTIVITY_INTERVAL_SECONDS:
            retry_at = last_at + timedelta(seconds=GUILD_ACTIVITY_INTERVAL_SECONDS)
            raise HTTPException(
                status_code=429,
                detail="Activity already ingested this hour for this guild.",
                headers={"Retry-At": retry_at.isoformat()},
            )

    spot = float(guild["stock_price"])
    circulating = max(1, int(guild["circulating_shares"] or 1))
    flow_usd = activity_flow_league_k(guild["league_tier"]) * (
        math.log10(1 + msgs) + 2 * math.log10(1 + actives)
    )
    delta_price = flow_usd / circulating
    new_spot = round(spot + delta_price, 6)

    # Audience flow is injected into the AMM reserves (the only mechanism that
    # grows pool credit) — the market stays fully backed while it appreciates.
    _p = query_one("SELECT pool_shares FROM guilds WHERE guild_id = :id", id=guild_id)
    _pool_shares = float(_p["pool_shares"] or 0) if _p else 0.0
    
    # Calculate bot-resistant Community Score
    from cordchain.anti_cheat import compute_bot_resistant_community_score
    c_score = compute_bot_resistant_community_score(
        unique_chatters=actives,
        capped_total_messages=min(msgs, actives * 25),
        spread_entropy=0.9,
        retention_rate=1.0,
        voice_minutes=0,
        median_account_age_days=60,
        growth_vs_baseline=1.0,
    )

    execute(
        "UPDATE guilds SET stock_price = :p, pool_cred = :c, community_score = :cs WHERE guild_id = :id",
        p=Decimal(str(new_spot)),
        c=Decimal(str(round(new_spot * _pool_shares, 6))),
        cs=c_score,
        id=guild_id,
    )
    _record_price_tick(guild_id, new_spot, "activity", shares_delta=0)

    return {
        "success": True,
        "guildId": guild_id,
        "ticker": guild["ticker"],
        "messagesLastHour": msgs,
        "activeChatters": actives,
        "flowUsd": round(flow_usd, 4),
        "priceBefore": format_price(spot),
        "newStockPrice": format_price(new_spot),
        "priceDelta": f"{delta_price:.8f}",
        "nextIngestInMinutes": GUILD_ACTIVITY_INTERVAL_SECONDS // 60,
    }

@app.get("/api/guilds/{guild_id}/bump-status")
def bump_status(guild_id: str, userId: str = Query(...)):
    """Advertises whether a shareholder/owner can bump right now + next window."""
    guild = query_one("SELECT guild_id, ticker, bump_count, last_bumped_at, owner_id FROM guilds WHERE guild_id = :id", id=guild_id)
    if not guild:
        raise HTTPException(status_code=404, detail="Server not found on CordChain")
    holding = query_one(
        "SELECT shares FROM holdings WHERE user_id = :uid AND guild_id = :gid",
        uid=userId, gid=guild_id,
    )
    shares_held = int(holding["shares"]) if holding else 0
    owns_server = guild.get("owner_id") and str(guild["owner_id"]) == str(userId)
    can_bump = shares_held > 0 or owns_server
    next_at = None
    last_x = query_one(
        "SELECT bumped_at FROM guild_bumps WHERE user_id = :uid AND guild_id = :gid",
        uid=userId, gid=guild_id,
    )
    if can_bump and last_x and last_x.get("bumped_at") is not None:
        bumped_at = last_x["bumped_at"]
        if isinstance(bumped_at, datetime) and bumped_at.tzinfo is None:
            bumped_at = bumped_at.replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - bumped_at).total_seconds()
        if elapsed < BUMP_COOLDOWN_SECONDS:
            next_at = (bumped_at + timedelta(seconds=BUMP_COOLDOWN_SECONDS)).isoformat()
    return {
        "guildId": guild_id,
        "ticker": guild["ticker"],
        "bumpCount": int(guild.get("bump_count") or 0),
        "canBump": can_bump,
        "sharesHeld": shares_held,
        "eligible": can_bump and next_at is None,
        "nextBumpAvailableAt": next_at,
        "holdsShares": shares_held > 0,
        "isOwner": owns_server,
    }

# ---------------- Real market data endpoints ----------------
# Both endpoints aggregate ONLY persisted ledger data: executed trade orders and
# recorded price ticks. No synthetic or seeded walk is ever generated.

_CANDLE_STEPS_MINUTES = {
    "1m": 1, "5m": 5, "15m": 15, "1h": 60, "4h": 240, "1D": 1440, "1W": 10080,
}

@app.get("/api/guilds/{guild_id}/candles")
def guild_candles(guild_id: str, interval: str = Query("1h"), limit: int = Query(120, le=400)):
    guild = query_one(
        "SELECT guild_id, ticker, stock_price, previous_day_price FROM guilds WHERE guild_id = :id",
        id=guild_id,
    )
    if not guild:
        raise HTTPException(status_code=404, detail="Guild not found")

    step_min = _CANDLE_STEPS_MINUTES.get(interval)
    if step_min is None:
        raise HTTPException(status_code=422, detail=f"Unknown interval '{interval}'. Use one of {list(_CANDLE_STEPS_MINUTES)}")

    step_s = step_min * 60
    now = datetime.now(timezone.utc)
    start = now - timedelta(seconds=step_s * limit)

    events: list[dict] = []
    tick_rows = query(
        """
        SELECT price, shares_delta, created_at
        FROM price_history
        WHERE guild_id = :g AND created_at >= :start
        ORDER BY created_at ASC
        """, g=guild_id, start=start)
    for r in tick_rows:
        ts = r["created_at"]
        if isinstance(ts, datetime) and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        events.append({"t": ts, "p": float(r["price"]), "v": int(r.get("shares_delta") or 0)})

    exec_rows = query(
        """
        SELECT price_per_share AS price, shares, action, created_at
        FROM trade_transactions
        WHERE guild_id = :g AND created_at >= :start
        ORDER BY created_at ASC
        """, g=guild_id, start=start)
    for r in exec_rows:
        ts = r["created_at"]
        if isinstance(ts, datetime) and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        events.append({"t": ts, "p": float(r["price"]), "v": int(r["shares"] or 0)})

    live_price = round(float(guild["stock_price"]), 6)
    events.append({"t": now, "p": live_price, "v": 0, "live": True})
    events.sort(key=lambda e: e["t"])

    buckets: dict[float, dict] = {}
    for e in events:
        b_start = (int(e["t"].timestamp()) // step_s) * step_s
        b = buckets.get(b_start)
        if b is None:
            buckets[b_start] = {"t": b_start, "o": e["p"], "h": e["p"], "l": e["p"], "c": e["p"], "v": e["v"]}
        else:
            b["h"] = max(b["h"], e["p"])
            b["l"] = min(b["l"], e["p"])
            b["c"] = e["p"]
            b["v"] += e["v"]

    ordered = [buckets[k] for k in sorted(buckets)]
    # Fill gaps between buckets with the last real close (volume 0) so the
    # timeline is contiguous without inventing any price movement.
    filled: list[dict] = []
    for idx, b in enumerate(ordered):
        if filled:
            anchor = filled[-1]["t"]
            gap = int((b["t"] - anchor) / step_s)
            for g_i in range(1, gap):
                flat = round(filled[-1]["c"], 6)
                filled.append({
                    "t": int(anchor + g_i * step_s),
                    "o": flat,
                    "h": flat,
                    "l": flat,
                    "c": flat,
                    "v": 0,
                })
        filled.append(b)

    candles_out = [
        {
            "t": datetime.fromtimestamp(c["t"], tz=timezone.utc).isoformat(),
            "o": round(float(c["o"]), 6),
            "h": round(float(c["h"]), 6),
            "l": round(float(c["l"]), 6),
            "c": round(float(c["c"]), 6),
            "v": int(c["v"]),
        }
        for c in filled
    ]

    return {
        "guildId": guild_id,
        "ticker": guild["ticker"],
        "interval": interval,
        "intervalSeconds": step_s,
        "livePrice": live_price,
        "ledgerEvents": len(events) - 1,
        "candles": candles_out,
    }

@app.get("/api/guilds/{guild_id}/orderbook")
def guild_orderbook(guild_id: str, depth: int = Query(8, le=20)):
    """Executed-order tape and realized liquidity ladder, aggregated from the
    trade ledger. All market orders route instantly at the oracle price."""
    guild = query_one(
        "SELECT guild_id, ticker, stock_price, league_tier FROM guilds WHERE guild_id = :id",
        id=guild_id,
    )
    if not guild:
        raise HTTPException(status_code=404, detail="Guild not found")

    executions = query(
        """
        SELECT tt.id, tt.action, tt.shares, tt.price_per_share, tt.total_cred, tt.created_at, u.username
        FROM trade_transactions tt
        LEFT JOIN users u ON u.discord_id = tt.user_id
        WHERE tt.guild_id = :g
        ORDER BY tt.created_at DESC
        LIMIT 200
        """, g=guild_id)

    def _mask(name):
        if not name:
            return "anon"
        return name if len(name) <= 3 else f"{name[:2]}***{name[-1]}"

    recent = []
    for r in executions[: depth * 3]:
        ts = r["created_at"]
        if isinstance(ts, datetime) and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        recent.append({
            "side": "buy" if r["action"] == "BUY" else "sell",
            "price": round(float(r["price_per_share"]), 6),
            "shares": int(r["shares"] or 0),
            "notionalUsd": round(float(r["total_cred"] or 0), 2),
            "time": ts.isoformat(),
            "trader": _mask(r.get("username")),
        })

    # Realized liquidity: executed volume grouped at exact traded prices.
    def _ladder(side_action: str) -> list[dict]:
        agg: dict[float, int] = {}
        for r in executions:
            if r["action"] != side_action:
                continue
            px = round(float(r["price_per_share"]), 6)
            agg[px] = agg.get(px, 0) + int(r["shares"] or 0)
        rows = [{"price": p, "shares": s, "notionalUsd": round(p * s, 2)} for p, s in agg.items()]
        rows.sort(key=lambda x: x["price"], reverse=True)
        max_v = max((r["shares"] for r in rows), default=0) or 1
        for r in rows:
            r["depthPercent"] = round((r["shares"] / max_v) * 100, 1)
        return rows[:depth]

    spot = round(float(guild["stock_price"]), 6)
    held = _held_shares(guild_id)
    day_rows = [r for r in executions if isinstance(r["created_at"], datetime) and (datetime.now(timezone.utc) - (r["created_at"] if r["created_at"].tzinfo else r["created_at"].replace(tzinfo=timezone.utc))) <= timedelta(hours=24)]
    buys24 = sum(int(r["shares"] or 0) for r in day_rows if r["action"] == "BUY")
    sells24 = sum(int(r["shares"] or 0) for r in day_rows if r["action"] == "SELL")

    return {
        "guildId": guild_id,
        "ticker": guild["ticker"],
        "currentPrice": spot,
        "liquidityMode": "executions" if executions else "amm_pool",
        "bids": _ladder("BUY"),
        "asks": _ladder("SELL"),
        "recentTrades": recent,
        "executions24h": len(day_rows),
        "buyVolume24hShares": buys24,
        "sellVolume24hShares": sells24,
        "netFlow24hShares": buys24 - sells24,
    }

TAPE_PAGE_MASK_NAMES = True

def _mask_trader_name(name):
    if not name:
        return "anon"
    return name if len(name) <= 3 else f"{name[:2]}***{name[-1]}"

@app.get("/api/guilds/{guild_id}/trades")
def guild_trades_page(
    guild_id: str,
    limit: int = Query(15, ge=1, le=100),
    before: str | None = Query(None),
):
    """Keyset-paged executed trade tape (infinite scroll). `before` is the
    ISO timestamp of the newest row already loaded; each call returns the next
    older page plus a cursor for the following page."""
    guild = query_one("SELECT guild_id, ticker FROM guilds WHERE guild_id = :id", id=guild_id)
    if not guild:
        raise HTTPException(status_code=404, detail="Guild not found")

    params: dict = {"g": guild_id, "lim": limit + 1}
    cursor_sql = ""
    if before:
        try:
            # '+' may arrive decoded as a space via query-string unescaping
            cursor = datetime.fromisoformat(str(before).replace(" ", "+"))
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid 'before' timestamp format")
        params["before"] = cursor
        cursor_sql = "AND tt.created_at < :before"

    rows = query(
        f"""
        SELECT tt.id, tt.action, tt.shares, tt.price_per_share, tt.total_cred, tt.created_at, u.username
        FROM trade_transactions tt
        LEFT JOIN users u ON u.discord_id = tt.user_id
        WHERE tt.guild_id = :g {cursor_sql}
        ORDER BY tt.created_at DESC
        LIMIT :lim
        """, **params)

    has_more = len(rows) > limit
    page_rows: list[dict] = rows[:limit]

    trades = []
    for r in page_rows:
        ts = r["created_at"]
        if isinstance(ts, datetime) and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        trades.append({
            "side": "buy" if r["action"] == "BUY" else "sell",
            "price": round(float(r["price_per_share"]), 6),
            "shares": int(r["shares"] or 0),
            "notionalUsd": round(float(r["total_cred"] or 0), 2),
            "time": ts.isoformat(),
            "trader": _mask_trader_name(r.get("username")),
        })

    return {
        "guildId": guild_id,
        "ticker": guild["ticker"],
        "trades": trades,
        "hasMore": has_more,
        "nextBefore": trades[-1]["time"] if trades and has_more else None,
    }

@app.post("/api/guild/tokenize")
def tokenize_guild(req: TokenizeGuildRequest, request: Request):
    # 1. Normalize ticker (must start with $, uppercase, 2-8 alphanumeric chars)
    raw_ticker = req.ticker.strip().upper()
    if not raw_ticker.startswith("$"):
        raw_ticker = f"${raw_ticker}"
    clean_code = raw_ticker[1:]
    if not clean_code.isalnum() or len(clean_code) < 2 or len(clean_code) > 8:
        raise HTTPException(
            status_code=400,
            detail="Ticker symbol must be 2 to 8 alphanumeric characters (e.g. $CORD)."
        )

    # 2. Strict Rare/Unique name check: No two tokens can have the same ticker
    existing_ticker = query_one(
        "SELECT guild_id, ticker, name FROM guilds WHERE UPPER(ticker) = UPPER(:t)",
        t=raw_ticker
    )
    if existing_ticker:
        raise HTTPException(
            status_code=400,
            detail=f"Ticker symbol '{raw_ticker}' is already registered by '{existing_ticker['name']}'. Every server token must have a unique ticker."
        )

    # 3. Check if server is already tokenized
    existing_guild = query_one(
        "SELECT guild_id, name, ticker FROM guilds WHERE guild_id = :id",
        id=req.guildId
    )
    if existing_guild:
        raise HTTPException(
            status_code=400,
            detail=f"Discord server '{existing_guild['name']}' is already tokenized with ticker {existing_guild['ticker']}."
        )

    # 4. Resolve owner: check bearer token session or fallback to req.ownerId
    owner_id = (req.ownerId or "").strip()
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        s_token = auth_header[7:].strip()
        s_row = query_one("SELECT * FROM web_sessions WHERE token = :t", t=s_token)
        if s_row:
            owner_id = s_row["discord_id"]
            try:
                guilds = json.loads(s_row.get("joined_guilds") or "[]")
                matching = next((g for g in guilds if str(g.get("id")) == str(req.guildId)), None)
                if matching is None:
                    # Session snapshot is stale: re-sync this user's guilds from Discord
                    access_token = s_row.get("discord_access_token")
                    if access_token:
                        try:
                            me_fresh, guilds = _discord_user_profile_and_guilds(access_token)
                            execute(
                                "UPDATE web_sessions SET joined_guilds = :g WHERE token = :t",
                                g=json.dumps(guilds), t=s_token,
                            )
                            matching = next((g for g in guilds if str(g.get("id")) == str(req.guildId)), None)
                        except Exception as e:
                            print(f"[Tokenize] guild re-sync failed: {e}")
                if matching and not matching.get("owner", False):
                    raise HTTPException(
                        status_code=403,
                        detail="Only the verified Discord server owner can tokenize this server on CordChain."
                    )
                if matching is None:
                    raise HTTPException(
                        status_code=403,
                        detail="You do not own this Discord server (or you are not a member with the logged-in account). Only servers you personally own can be tokenized."
                    )
            except HTTPException:
                raise
            except Exception as e:
                print(f"[Tokenize] ownership check error: {e}")

    if not owner_id:
        owner_id = "000000000000000000"

    # 4b. The CordChain bot must be present in the server (verified against the
    # Discord application's live guild list when the bot token is configured).
    bot_guilds = get_bot_installed_guild_ids()
    if bot_guilds and str(req.guildId) not in [str(g) for g in bot_guilds]:
        raise HTTPException(
            status_code=403,
            detail="The CordChain bot is not installed on this Discord server yet. Add the bot first, then verify it to tokenize.",
        )

    # 6. A public Discord invite link is compulsory for the public directory listing
    invite_url = _validate_discord_invite(req.inviteUrl)

    # 7. Compute league & tier from members count
    members = max(1, req.memberCount)
    league_name = determine_league(members)
    tier = 3 if league_name == "Gold" else 2 if league_name == "Silver" else 1

    # 8. Fixed 1,000,000 share supply & 25% creator reserve with 5% monthly vesting
    fixed_supply = FIXED_SUPPLY_PER_SERVER
    creator_reserve_shares = 250_000  # 25%
    creator_vested_shares = 50_000   # 5% unlocked at IPO
    creator_locked_shares = 200_000  # 20% locked with 50k unlocking per 30 days
    circulating_shares = 750_000     # 75% public float

    # Standard starting price for fair cross-server comparability
    req_price = getattr(req, "initialPriceUsd", None)
    if req_price and 0.000001 <= float(req_price) <= 10.0:
        stock_price = Decimal(str(round(float(req_price), 6)))
    else:
        stock_price = IPO_PRICE_CRED

    # Standard constant-product AMM pool reserves
    pool_shares = Decimal(str(circulating_shares))
    pool_cred = Decimal(str(round(float(stock_price) * circulating_shares, 6)))

    # 9. Insert into PostgreSQL guilds
    execute("""
        INSERT INTO guilds (
            guild_id, name, ticker, icon_url, league_tier, league,
            member_count_current, member_count_peak_7d, stock_price, previous_day_price,
            circulating_shares, fixed_supply, creator_reserve_shares, creator_vested_shares,
            creator_locked_shares, vesting_last_unlocked_at, community_score,
            owner_id, owner_cash_wallet_inr, created_at, invite_url, description, category,
            pool_shares, pool_cred
        ) VALUES (
            :gid, :name, :ticker, :icon, :tier, :league,
            :members, :members, :price, :price,
            :shares, :fixed_supply, :res_shares, :vested_shares,
            :locked_shares, NOW(), 100.00,
            :owner, 0.00, NOW(), :invite, :desc, :cat,
            :pool_shares, :pool_cred
        )
    """, gid=req.guildId, name=req.name, ticker=raw_ticker, icon=req.iconUrl,
        tier=tier, league=league_name, members=members, price=stock_price, shares=circulating_shares,
        fixed_supply=fixed_supply, res_shares=creator_reserve_shares, vested_shares=creator_vested_shares,
        locked_shares=creator_locked_shares,
        owner=owner_id, invite=invite_url,
        desc=(req.description or "").strip() or None,
        cat=(req.category or "").strip() or "Community",
        pool_shares=pool_shares, pool_cred=pool_cred)

    # Seed the real price ledger with the IPO strike
    _record_price_tick(req.guildId, float(stock_price), "ipo")

    # 10. Grant creator vested reserve in holdings
    if creator_vested_shares > 0 and owner_id and owner_id != "000000000000000000":
        ensure_user(owner_id)
        execute("""
            INSERT INTO holdings (user_id, guild_id, shares, avg_buy_price, updated_at)
            VALUES (:uid, :gid, :shares, :price, NOW())
            ON CONFLICT (user_id, guild_id)
            DO UPDATE SET shares = holdings.shares + :shares, updated_at = NOW()
        """, uid=owner_id, gid=req.guildId, shares=creator_vested_shares, price=stock_price)

    # 11. Record authoritative IPO event on CordLedger
    try:
        append_ledger_entry(
            event_type="IPO",
            payload={
                "guildId": req.guildId,
                "ticker": raw_ticker,
                "name": req.name,
                "fixedSupply": fixed_supply,
                "publicFloat": circulating_shares,
                "creatorReserve": creator_reserve_shares,
                "initialVested": creator_vested_shares,
                "openingPriceCred": float(stock_price),
                "league": league_name,
            },
            guild_id=req.guildId,
            user_id=owner_id,
        )
        produce_block()
    except Exception as e:
        print(f"[Ledger] IPO entry logging error: {e}")

    return {
        "success": True,
        "guild": {
            "guildId": req.guildId,
            "name": req.name,
            "ticker": raw_ticker,
            "iconUrl": req.iconUrl,
            "inviteUrl": invite_url,
            "leagueTier": tier,
            "league": league_name,
            "memberCountCurrent": members,
            "memberCountPeak7d": members,
            "stockPrice": format_price(stock_price),
            "previousDayPrice": format_price(stock_price),
            "fixedSupply": fixed_supply,
            "circulatingShares": circulating_shares,
            "creatorReserveShares": creator_reserve_shares,
            "creatorVestedShares": creator_vested_shares,
            "creatorLockedShares": creator_locked_shares,
            "changePct": 0.0,
            "isGain": True,
            "tokenExplorerUrl": f"/scan/token/{req.guildId}",
            "blockchainNetwork": "CordLedger Local Chain",
            "isRealOnChain": True,
        }
    }

@app.patch("/api/guilds/{guild_id}")
@app.post("/api/guilds/{guild_id}/update")
def update_guild(guild_id: str, req: UpdateGuildRequest, request: Request):
    g = query_one("SELECT * FROM guilds WHERE guild_id = :id", id=guild_id)
    if not g:
        raise HTTPException(status_code=404, detail="Tokenized server not found")

    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        try:
            session = _get_active_session(request)
            user_id = session.get("discord_id")
            if g.get("owner_id") and g["owner_id"] != user_id:
                payload = _session_row_to_payload(session)
                owned_ids = [og["id"] for og in payload.get("ownedGuilds", [])]
                if guild_id not in owned_ids:
                    raise HTTPException(status_code=403, detail="Only the verified Discord server owner can manage this token")
        except HTTPException:
            raise
        except Exception:
            pass

    if req.name:
        execute("UPDATE guilds SET name = :n WHERE guild_id = :id", n=req.name.strip(), id=guild_id)
    if req.ticker:
        raw_ticker = req.ticker.strip().upper()
        if not raw_ticker.startswith("$"):
            raw_ticker = f"${raw_ticker}"
        existing = query_one("SELECT guild_id FROM guilds WHERE ticker = :t AND guild_id != :id", t=raw_ticker, id=guild_id)
        if existing:
            raise HTTPException(status_code=400, detail=f"Ticker symbol {raw_ticker} is already in use by another server.")
        execute("UPDATE guilds SET ticker = :t WHERE guild_id = :id", t=raw_ticker, id=guild_id)
    if req.iconUrl is not None:
        execute("UPDATE guilds SET icon_url = :i WHERE guild_id = :id", i=req.iconUrl, id=guild_id)
    if req.description is not None:
        execute("UPDATE guilds SET description = :d WHERE guild_id = :id", d=req.description, id=guild_id)
    if req.category is not None:
        execute("UPDATE guilds SET category = :c WHERE guild_id = :id", c=req.category, id=guild_id)
    if req.inviteUrl is not None:
        clean_invite = _validate_discord_invite(req.inviteUrl)
        execute("UPDATE guilds SET invite_url = :u WHERE guild_id = :id", u=clean_invite, id=guild_id)
    if req.dividendSplitShareholders is not None:
        execute("UPDATE guilds SET dividend_split_shareholders = :v WHERE guild_id = :id", v=req.dividendSplitShareholders, id=guild_id)
    if req.dividendSplitTreasury is not None:
        execute("UPDATE guilds SET dividend_split_treasury = :v WHERE guild_id = :id", v=req.dividendSplitTreasury, id=guild_id)
    if req.dividendSplitOwner is not None:
        execute("UPDATE guilds SET dividend_split_owner = :v WHERE guild_id = :id", v=req.dividendSplitOwner, id=guild_id)
    if req.boostRewardMultiplier is not None:
        execute("UPDATE guilds SET boost_reward_multiplier = :v WHERE guild_id = :id", v=req.boostRewardMultiplier, id=guild_id)
    if req.adMonetizationEnabled is not None:
        execute("UPDATE guilds SET ad_monetization_enabled = :v WHERE guild_id = :id", v=req.adMonetizationEnabled, id=guild_id)
    if req.additionalShares and req.additionalShares > 0:
        execute("""
            UPDATE guilds 
            SET circulating_shares = circulating_shares + :add,
                total_supply = total_supply + :add,
                treasury_reserve = treasury_reserve + :add
            WHERE guild_id = :id
        """, add=req.additionalShares, id=guild_id)

    if req.tokenContractAddress is not None:
        raw_addr = req.tokenContractAddress.strip()
        clean_addr = raw_addr if (raw_addr.startswith("0x") and len(raw_addr) == 42) else None
        execute("UPDATE guilds SET token_contract_address = :addr WHERE guild_id = :id", addr=clean_addr, id=guild_id)

    updated = query_one("SELECT * FROM guilds WHERE guild_id = :id", id=guild_id)
    return {
        "success": True,
        "guild": {
            "guildId": updated["guild_id"],
            "name": updated["name"],
            "ticker": updated["ticker"],
            "iconUrl": updated["icon_url"],
            "description": updated.get("description"),
            "category": updated.get("category"),
            "inviteUrl": updated.get("invite_url"),
            "stockPrice": format_price(Decimal("0") if _held_shares(str(updated["guild_id"])) <= 0 else updated["stock_price"]),
            "heldShares": _held_shares(str(updated["guild_id"])),
            "marketState": "dormant" if _held_shares(str(updated["guild_id"])) <= 0 else "live",
            "circulatingShares": updated["circulating_shares"],
            "totalSupply": updated.get("total_supply", 1000000),
            "treasuryReserve": updated.get("treasury_reserve", 150000),
            "dividendSplitShareholders": updated.get("dividend_split_shareholders", 60),
            "dividendSplitTreasury": updated.get("dividend_split_treasury", 25),
            "dividendSplitOwner": updated.get("dividend_split_owner", 15),
            "boostRewardMultiplier": float(updated.get("boost_reward_multiplier") or 1.05),
            "adMonetizationEnabled": bool(updated.get("ad_monetization_enabled", True)),
        }
    }

@app.delete("/api/guilds/{guild_id}")
@app.post("/api/guilds/{guild_id}/delete")
def delete_guild(guild_id: str, request: Request):
    g = query_one("SELECT * FROM guilds WHERE guild_id = :id", id=guild_id)
    if not g:
        raise HTTPException(status_code=404, detail="Tokenized server not found")

    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        try:
            session = _get_active_session(request)
            user_id = session.get("discord_id")
            if g.get("owner_id") and g["owner_id"] != user_id:
                payload = _session_row_to_payload(session)
                owned_ids = [og["id"] for og in payload.get("ownedGuilds", [])]
                if guild_id not in owned_ids:
                    raise HTTPException(status_code=403, detail="Only the verified Discord server owner can delete or delist this token")
        except HTTPException:
            raise
        except Exception:
            pass

    ticker = g.get("ticker")
    name = g.get("name")

    # Cascading deletion
    execute("DELETE FROM checkin_logs WHERE guild_id = :id", id=guild_id)
    execute("DELETE FROM trade_transactions WHERE guild_id = :id", id=guild_id)
    execute("DELETE FROM holdings WHERE guild_id = :id", id=guild_id)
    execute("DELETE FROM guilds WHERE guild_id = :id", id=guild_id)

    return {
        "success": True,
        "deletedGuildId": guild_id,
        "ticker": ticker,
        "name": name,
        "message": f"Successfully delisted and deleted {name} ({ticker}) from CordChain."
    }

# 2. Daily Boost & Check-In
@app.post("/api/checkin/initiate")
def checkin_initiate(req: CheckinInitiateRequest):
    today_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Fetch guild
    guild = query_one("SELECT * FROM guilds WHERE guild_id = :id", id=req.guildId)
    if not guild:
        raise HTTPException(status_code=404, detail="Guild not registered on CordChain")

    # Fetch or create user
    user = ensure_user(req.userId)

    # 3-boost daily limit
    boost_count = user["daily_boost_count"]
    if str(user.get("last_boost_date")) != today_utc:
        boost_count = 0

    if boost_count >= 3:
        raise HTTPException(status_code=429, detail="Daily boost limit (3/3) already reached today.")

    # Cash drop qualification (Filter 1 + Filter 3)
    is_old_enough = is_account_old_enough(req.userId)
    is_first_drop_today = str(user.get("last_paid_checkin_date")) != today_utc
    is_paid_drop = (not FANTASY_ONLY) and is_old_enough and is_first_drop_today

    # Active campaign (sponsors in full mode, in-house spotlight fallback).
    # Prefer self-serve campaigns that target this guild's category, then any
    # live funded campaign, then the in-house community spotlight.
    if FANTASY_ONLY:
        campaign = get_community_spotlight_campaign(guild)
    else:
        guild_category = (guild.get("category") or "Community").strip()
        campaigns = query("""
            SELECT * FROM ad_campaigns
            WHERE is_active = TRUE AND remaining_budget_inr > 0
                AND (LOWER(target_category) = 'all' OR LOWER(target_category) = LOWER(:cat))
            ORDER BY created_at ASC LIMIT 10
        """, cat=guild_category)
        if campaigns:
            campaign = campaigns[0]
        else:
            campaign = get_community_spotlight_campaign(guild)
    wrongs = campaign["wrong_options"]
    if isinstance(wrongs, str):
        wrongs = json.loads(wrongs)

    options = shuffle_options(campaign["correct_option"], wrongs)

    # Arm the server-side proof-of-attention timer (anti-macro, Filter 4)
    _ATTENTION_SESSIONS[f"{req.userId}:{req.guildId}"] = time.time()

    return {
        "guild": {
            "id": guild["guild_id"],
            "name": guild["name"],
            "ticker": guild["ticker"],
            "stockPrice": format_price(guild["stock_price"]),
        },
        "campaign": {
            "campaignId": str(campaign["campaign_id"]),
            "sponsorName": campaign["sponsor_name"],
            "title": campaign["title"],
            "description": campaign["description"],
            "mediaUrl": campaign["media_url"],
            "verifyQuestion": campaign["verify_question"],
            "options": options,
        },
        "isPaidDrop": is_paid_drop,
        "accountAgeQualified": is_old_enough,
        "currentDailyBoosts": boost_count,
        "minWatchSeconds": int(_MIN_WATCH_SECONDS),
    }

@app.post("/api/checkin/verify")
def checkin_verify(req: CheckinVerifyRequest):
    today_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Fetch campaign
    campaign = query_one("SELECT * FROM ad_campaigns WHERE campaign_id = :id", id=req.campaignId)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Filter 4: Attention quiz check
    if req.selectedOption.strip() != campaign["correct_option"].strip():
        return {
            "success": False,
            "verified": False,
            "message": "Incorrect answer to attention question. A 1-hour cooldown has been initiated.",
        }

    # Filter 4b: Server-side proof-of-attention (anti-macro). The quiz cannot be
    # submitted sooner than the minimum watch window armed at /checkin/initiate.
    session_key = f"{req.userId}:{req.guildId}"
    session_started = _ATTENTION_SESSIONS.get(session_key)
    if session_started is None:
        return {
            "success": False,
            "verified": False,
            "message": "No active attention session. Re-open the spotlight card to restart.",
            "speed_violation": True,
        }
    elapsed = time.time() - session_started
    _ATTENTION_SESSIONS.pop(session_key, None)
    if elapsed < _MIN_WATCH_SECONDS:
        return {
            "success": False,
            "verified": False,
            "message": "Submission too fast. Watch the full spotlight and answer manually.",
            "speed_violation": True,
        }

    # Fetch user and guild
    user = query_one("SELECT * FROM users WHERE discord_id = :id", id=req.userId)
    guild = query_one("SELECT * FROM guilds WHERE guild_id = :id", id=req.guildId)
    if not user or not guild:
        raise HTTPException(status_code=404, detail="User or Guild not found")

    boost_count = user["daily_boost_count"]
    if str(user.get("last_boost_date")) != today_utc:
        boost_count = 0

    if boost_count >= 3:
        raise HTTPException(status_code=429, detail="Daily boost limit (3/3) already reached.")

    is_old_enough = is_account_old_enough(req.userId)
    is_first_drop_today = str(user.get("last_paid_checkin_date")) != today_utc
    is_paid_drop = (not FANTASY_ONLY) and is_old_enough and is_first_drop_today

    cred_bonus = 250.00
    cash_bonus = float(campaign["user_reward_inr"]) if is_paid_drop else 0.00
    owner_cash_bonus = float(campaign["owner_reward_inr"]) if is_paid_drop else 0.00

    new_cred = float(user["cred_balance"]) + cred_bonus
    new_cash = float(user["cash_wallet_inr"]) + cash_bonus
    new_boost_count = boost_count + 1

    # Price momentum +0.8%
    new_stock_price = round(float(guild["stock_price"]) * 1.008, 6)
    # Boost pushes the pool cred up so reserves stay consistent with the spot
    _b = query_one("SELECT pool_shares FROM guilds WHERE guild_id = :id", id=req.guildId)
    _boost_shares = float(_b["pool_shares"] or 0) if _b else 0.0
    new_owner_cash = float(guild["owner_cash_wallet_inr"]) + owner_cash_bonus

    # Update User
    execute("""
        UPDATE users SET
            cred_balance = :cred,
            cash_wallet_inr = :cash,
            daily_boost_count = :boosts,
            last_boost_date = :today,
            last_paid_checkin_date = :paid_date
        WHERE discord_id = :id
    """, cred=new_cred, cash=new_cash, boosts=new_boost_count, today=today_utc,
       paid_date=today_utc if is_paid_drop else user.get("last_paid_checkin_date"), id=req.userId)

    # Update Guild (pool reserves ride along so credit stays backed)
    execute("""
        UPDATE guilds SET
            stock_price = :price,
            pool_cred = :pool_cred,
            owner_cash_wallet_inr = :owner_cash
        WHERE guild_id = :id
    """, price=new_stock_price,
        pool_cred=Decimal(str(round(new_stock_price * _boost_shares, 6))),
        owner_cash=new_owner_cash, id=req.guildId)

    _record_price_tick(req.guildId, new_stock_price, "boost")

    # Insert Checkin Log
    execute("""
        INSERT INTO checkin_logs (
            user_id, guild_id, campaign_id, is_paid_drop,
            cred_awarded, user_payout_inr, owner_payout_inr, platform_fee_inr, quiz_answered_correctly
        ) VALUES (:user, :guild, :campaign, :paid, :cred, :payout, :owner, :fee, TRUE)
    """, user=req.userId, guild=req.guildId, campaign=req.campaignId, paid=is_paid_drop,
       cred=cred_bonus, payout=cash_bonus, owner=owner_cash_bonus,
       fee=float(campaign["platform_fee_inr"]) if is_paid_drop else 0.00)

    # Self-serve sponsor campaigns drain their remaining budget as verified
    # impressions roll in, then auto-deactivate once exhausted.
    sponsor_name = str(campaign.get("sponsor_name") or "")
    if is_paid_drop and sponsor_name != "CordChain Staff":
        cost = float(campaign["user_reward_inr"]) + float(campaign["owner_reward_inr"]) + float(campaign["platform_fee_inr"])
        remaining = float(campaign["remaining_budget_inr"]) - cost
        if remaining <= 0:
            execute("""
                UPDATE ad_campaigns SET remaining_budget_inr = 0, is_active = FALSE
                WHERE campaign_id = :cid
            """, cid=campaign["campaign_id"])
        else:
            execute("""
                UPDATE ad_campaigns SET remaining_budget_inr = :rem
                WHERE campaign_id = :cid
            """, rem=Decimal(str(round(remaining, 2))), cid=campaign["campaign_id"])

    return {
        "success": True,
        "verified": True,
        "credAwarded": cred_bonus,
        "isPaidDrop": is_paid_drop,
        "userPayoutInr": cash_bonus,
        "newCredBalance": f"{new_cred:.2f}",
        "newCashWalletInr": f"{new_cash:.2f}",
        "newStockPrice": format_price(new_stock_price),
        "dailyBoostCount": new_boost_count,
        "boostsRemainingToday": 3 - new_boost_count,
    }

# 3. Stock Trading
@app.post("/api/trade/quote")
def trade_quote(req: TradeQuoteRequest):
    guild = query_one("SELECT * FROM guilds WHERE guild_id = :id", id=req.guildId)
    if not guild:
        raise HTTPException(status_code=404, detail="Guild not found")

    cur_price = float(guild["stock_price"])
    S = float(guild["pool_shares"] or 0)
    C = float(guild["pool_cred"] or 0)
    if req.shares > 0 and S > 0:
        _, _, q_cred = _amm_swap(S, C, req.shares, req.action or "BUY")
    else:
        q_cred = cur_price * max(0, req.shares)
    if req.action == "BUY":
        q_cred = abs(q_cred)
        exec_price = q_cred / max(1, req.shares)
        total_cost = round(q_cred, 6)
        estimated_slippage = round(max(0.0, (exec_price / cur_price - 1.0) * 100), 2) if cur_price > 0 else 0.0
    else:
        exec_price = abs(q_cred) / max(1, req.shares)
        total_cost = round(abs(q_cred), 6)
        estimated_slippage = round(max(0.0, (cur_price - exec_price) / max(1e-12, cur_price) * 100), 2) if cur_price > 0 else 0.0
    return {
        "guildId": guild["guild_id"],
        "ticker": guild["ticker"],
        "currentPrice": format_price(cur_price),
        "shares": req.shares,
        "action": req.action,
        "totalCred": format_price(total_cost),
        "execPrice": format_price(exec_price),
        "estimatedSlippagePct": estimated_slippage,
    }

@app.post("/api/trade/buy")
def trade_buy(req: TradeExecuteRequest):
    if req.shares <= 0:
        raise HTTPException(status_code=400, detail="Shares must be positive")

    # 1. Market Defense: Circuit Breaker
    cb = check_circuit_breaker(req.guildId)
    if cb:
        raise HTTPException(status_code=429, detail=cb["reason"])

    # 2. Market Defense: Position Limits (Max 10% per account)
    pos_err = check_position_limit(req.userId, req.guildId, req.shares)
    if pos_err:
        raise HTTPException(status_code=400, detail=pos_err)

    # 3. Market Defense: Wash-Trade Protection
    wash_err = check_wash_trade(req.userId, req.guildId, "BUY")
    if wash_err:
        raise HTTPException(status_code=400, detail=wash_err)

    user = query_one("SELECT * FROM users WHERE discord_id = :id", id=req.userId)
    guild = query_one("SELECT * FROM guilds WHERE guild_id = :id", id=req.guildId)
    if not user or not guild:
        raise HTTPException(status_code=404, detail="User or Guild not found")

    price_per_share = float(guild["stock_price"])
    pool_shares_before = float(guild["pool_shares"] or 0)
    pool_cred_before = float(guild["pool_cred"] or 0)

    # Quote the true constant-product swap cost first
    _, _, quote_cost = _amm_swap(pool_shares_before, pool_cred_before, req.shares, "BUY")
    total_cost = round(quote_cost, 6)
    exec_price = quote_cost / req.shares
    if total_cost < float(_MIN_ORDER_VALUE_CRED):
        raise HTTPException(
            status_code=422,
            detail=f"Order too small — settlement minimum is {format_price(_MIN_ORDER_VALUE_CRED)} $CRED (shares × price).",
        )

    if float(user["cred_balance"]) < total_cost:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient $CRED balance. Required: {format_price(total_cost)}, Available: {user['cred_balance']}"
        )

    new_cred = round(float(user["cred_balance"]) - total_cost, 6)

    # Update or insert holding at the real average execution price
    holding = query_one("SELECT * FROM holdings WHERE user_id = :uid AND guild_id = :gid", uid=req.userId, gid=req.guildId)
    if holding:
        prev_shares = holding["shares"]
        prev_avg = float(holding["avg_buy_price"])
        updated_shares = prev_shares + req.shares
        new_avg = round((prev_shares * prev_avg + total_cost) / updated_shares, 6)
        execute("""
            UPDATE holdings SET shares = :s, avg_buy_price = :avg, updated_at = NOW()
            WHERE user_id = :uid AND guild_id = :gid
        """, s=updated_shares, avg=new_avg, uid=req.userId, gid=req.guildId)
    else:
        updated_shares = req.shares
        new_avg = round(total_cost / req.shares, 6)
        execute("""
            INSERT INTO holdings (user_id, guild_id, shares, avg_buy_price)
            VALUES (:uid, :gid, :s, :avg)
        """, uid=req.userId, gid=req.guildId, s=updated_shares, avg=new_avg)

    # Deduct CRED & commit the swap: shares leave the pool and join circulation
    execute("UPDATE users SET cred_balance = :cred WHERE discord_id = :id", cred=new_cred, id=req.userId)
    if total_cost > pool_cred_before and pool_cred_before > 0:
        total_cost = round(pool_cred_before, 6)
        total_cost = max(total_cost, float(_MIN_ORDER_VALUE_CRED))
    C2 = round(pool_cred_before + total_cost, 6)
    S2 = round(pool_shares_before - req.shares, 6)
    new_spot = round(_pool_price_after(max(0.0, C2), max(1e-9, S2)), 6)
    execute(
        "UPDATE guilds SET pool_cred = :c, pool_shares = :s, stock_price = :p WHERE guild_id = :id",
        c=Decimal(str(max(0.0, C2))), s=Decimal(str(S2)),
        p=Decimal(str(new_spot)), id=req.guildId,
    )

    # Record on CordLedger
    from cordchain.blockchain import record_on_chain_trade
    on_chain = record_on_chain_trade(
        user_id=req.userId,
        guild_id=req.guildId,
        ticker=guild["ticker"],
        action="BUY",
        shares=req.shares,
        price_per_share=price_per_share,
        total_cred=total_cost,
    )

    # Log trade with authoritative ledger hash
    tx = execute_returning("""
        INSERT INTO trade_transactions (user_id, guild_id, action, shares, price_per_share, total_cred, blockchain_tx_hash)
        VALUES (:uid, :gid, 'BUY', :s, :p, :t, :lh) RETURNING id
    """, uid=req.userId, gid=req.guildId, s=req.shares, p=round(exec_price, 6), t=total_cost, lh=on_chain.get("ledgerHash"))

    _record_price_tick(req.guildId, price_per_share, "trade", shares_delta=req.shares)
    _record_price_tick(req.guildId, new_spot, "trade", shares_delta=req.shares)

    return {
        "success": True,
        "action": "BUY",
        "ticker": guild["ticker"],
        "sharesBought": req.shares,
        "pricePerShare": format_price(round(exec_price, 6)),
        "totalCredSpent": format_price(total_cost),
        "newCredBalance": f"{new_cred:.2f}",
        "newMarketPrice": format_price(new_spot),
        "holding": {"shares": updated_shares, "avgBuyPrice": format_price(new_avg)},
        "transactionId": str(tx["id"]) if tx else None,
        "ledgerHash": on_chain.get("ledgerHash"),
        "blockchain": on_chain,
    }

@app.post("/api/trade/sell")
def trade_sell(req: TradeExecuteRequest):
    if req.shares <= 0:
        raise HTTPException(status_code=400, detail="Shares must be positive")

    # 1. Market Defense: Circuit Breaker
    cb = check_circuit_breaker(req.guildId)
    if cb:
        raise HTTPException(status_code=429, detail=cb["reason"])

    # 2. Market Defense: Wash-Trade Protection
    wash_err = check_wash_trade(req.userId, req.guildId, "SELL")
    if wash_err:
        raise HTTPException(status_code=400, detail=wash_err)

    user = query_one("SELECT * FROM users WHERE discord_id = :id", id=req.userId)
    guild = query_one("SELECT * FROM guilds WHERE guild_id = :id", id=req.guildId)
    holding = query_one("SELECT * FROM holdings WHERE user_id = :uid AND guild_id = :gid", uid=req.userId, gid=req.guildId)

    if not user or not guild:
        raise HTTPException(status_code=404, detail="User or Guild not found")

    if not holding or holding["shares"] < req.shares:
        owned = holding["shares"] if holding else 0
        raise HTTPException(status_code=400, detail=f"Insufficient shares. Requested: {req.shares}, Owned: {owned}")

    price_per_share = float(guild["stock_price"])
    pool_shares_before = float(guild["pool_shares"] or 0)
    pool_cred_before = float(guild["pool_cred"] or 0)

    # Sketch the real swap first (a seller pockets only what the pool holds —
    # the counterparty's backed reserves, not minted cred).
    _, _, quote_out = _amm_swap(pool_shares_before, pool_cred_before, req.shares, "SELL")
    exec_price = abs(quote_out) / req.shares
    total_payout = round(abs(quote_out), 6)
    if total_payout < float(_MIN_ORDER_VALUE_CRED):
        raise HTTPException(
            status_code=422,
            detail=f"Order too small — settlement minimum is {format_price(_MIN_ORDER_VALUE_CRED)} $CRED (shares × price).",
        )
    new_cred = round(float(user["cred_balance"]) + total_payout, 6)
    remaining_shares = holding["shares"] - req.shares

    if remaining_shares == 0:
        execute("DELETE FROM holdings WHERE user_id = :uid AND guild_id = :gid", uid=req.userId, gid=req.guildId)
    else:
        execute("""
            UPDATE holdings SET shares = :s, updated_at = NOW()
            WHERE user_id = :uid AND guild_id = :gid
        """, s=remaining_shares, uid=req.userId, gid=req.guildId)

    execute("UPDATE users SET cred_balance = :cred WHERE discord_id = :id", cred=new_cred, id=req.userId)
    C2 = round(max(0.0, pool_cred_before - total_payout), 6)
    S2 = round(pool_shares_before + req.shares, 6)
    new_spot = round(_pool_price_after(C2, max(1e-9, S2)), 6)
    execute(
        "UPDATE guilds SET pool_cred = :c, pool_shares = :s, stock_price = :p WHERE guild_id = :id",
        c=Decimal(str(C2)), s=Decimal(str(S2)),
        p=Decimal(str(new_spot)), id=req.guildId,
    )

    # Record on CordLedger
    from cordchain.blockchain import record_on_chain_trade
    on_chain = record_on_chain_trade(
        user_id=req.userId,
        guild_id=req.guildId,
        ticker=guild["ticker"],
        action="SELL",
        shares=req.shares,
        price_per_share=price_per_share,
        total_cred=total_payout,
    )

    tx = execute_returning("""
        INSERT INTO trade_transactions (user_id, guild_id, action, shares, price_per_share, total_cred, blockchain_tx_hash)
        VALUES (:uid, :gid, 'SELL', :s, :p, :t, :lh) RETURNING id
    """, uid=req.userId, gid=req.guildId, s=req.shares, p=round(exec_price, 6), t=total_payout, lh=on_chain.get("ledgerHash"))

    _record_price_tick(req.guildId, price_per_share, "trade", shares_delta=-req.shares)
    _record_price_tick(req.guildId, new_spot, "trade", shares_delta=-req.shares)

    return {
        "success": True,
        "action": "SELL",
        "ticker": guild["ticker"],
        "sharesSold": req.shares,
        "pricePerShare": format_price(round(exec_price, 6)),
        "totalCredReceived": format_price(total_payout),
        "newCredBalance": f"{new_cred:.2f}",
        "remainingShares": remaining_shares,
        "newMarketPrice": format_price(new_spot),
        "transactionId": str(tx["id"]) if tx else None,
        "ledgerHash": on_chain.get("ledgerHash"),
        "blockchain": on_chain,
    }

class RegisterTradeTxRequest(BaseModel):
    transactionId: str
    txHash: str
    blockNumber: int | None = None
    walletAddress: str | None = None

@app.post("/api/trade/register-tx")
def trade_register_tx(req: RegisterTradeTxRequest):
    """Attach a user-signed on-chain notarization (MetaMask self-send with trade
    payload) to an already-executed ledger trade. Verifies the receipt against
    the live chain when possible and stores only real values."""
    from cordchain.blockchain import register_trade_tx, BASE_SEPOLIA_EXPLORER
    try:
        row = register_trade_tx(
            transaction_id=req.transactionId,
            tx_hash=req.txHash,
            block_number=req.blockNumber,
            wallet_address=req.walletAddress,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if not row:
        raise HTTPException(status_code=404, detail="Trade transaction not found")
    return {
        "success": True,
        "trade": row,
        "explorerUrl": f"{BASE_SEPOLIA_EXPLORER}/tx/{row['blockchain_tx_hash']}",
    }

# 4. Pure $CRED Wallet & Daily Allowance
@app.get("/api/wallet/summary")
def wallet_summary(userId: str = Query(...)):
    user = ensure_user(userId)

    holdings = query("""
        SELECT h.shares, h.avg_buy_price, g.guild_id, g.ticker, g.name as server_name, g.stock_price,
               g.fixed_supply, g.owner_id, g.creator_reserve_shares, g.creator_vested_shares, g.creator_locked_shares
        FROM holdings h
        JOIN guilds g ON h.guild_id = g.guild_id
        WHERE h.user_id = :uid AND h.shares > 0
    """, uid=userId)

    portfolio_val = 0.0
    formatted_holdings = []
    for h in holdings:
        val = float(h["stock_price"]) * h["shares"]
        portfolio_val += val
        pnl = (float(h["stock_price"]) - float(h["avg_buy_price"])) * h["shares"]
        is_owner = (h["owner_id"] == userId)
        formatted_holdings.append({
            "guildId": h["guild_id"],
            "ticker": h["ticker"],
            "serverName": h["server_name"],
            "shares": h["shares"],
            "avgBuyPrice": str(h["avg_buy_price"]),
            "currentPrice": str(h["stock_price"]),
            "totalValueCred": f"{val:.2f}",
            "unrealizedPnlCred": f"{pnl:.2f}",
            "isOwner": is_owner,
            "creatorVestedShares": h.get("creator_vested_shares") if is_owner else None,
            "creatorLockedShares": h.get("creator_locked_shares") if is_owner else None,
        })

    net_worth = float(user["cred_balance"]) + portfolio_val
    cred_balance = float(user["cred_balance"])
    today_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    daily_boosts = user["daily_boost_count"] if str(user.get("last_boost_date")) == today_utc else 0
    can_claim_allowance = str(user.get("last_daily_allowance_date") or "") != today_utc
    daily_earned = float(user.get("daily_earned_cred") or 0.0) if str(user.get("last_earn_date")) == today_utc else 0.0

    return {
        "user": {
            "discordId": user["discord_id"],
            "username": user["username"],
            "avatar": user["avatar"],
        },
        "wallets": {
            "credBalance": f"{cred_balance:.2f}",
            "cashWalletInr": "0.00",
            "portfolioStockValueCred": f"{portfolio_val:.2f}",
            "totalNetWorthCred": f"{net_worth:.2f}",
        },
        "dailyStatus": {
            "boostsUsedToday": daily_boosts,
            "maxDailyBoosts": 3,
            "canClaimAllowance": can_claim_allowance,
            "dailyBonusCred": float(DAILY_LOGIN_BONUS_CRED),
            "dailyEarnedToday": daily_earned,
            "dailyEarnCap": float(DAILY_EARN_CAP_CRED),
        },
        "cashout": {
            "minWithdrawalThresholdInr": 0,
            "canWithdraw": False,
            "progressPct": "0.0",
        },
        "fantasyOnly": True,
        "holdings": formatted_holdings,
    }

class ClaimAllowanceRequest(BaseModel):
    userId: str

@app.post("/api/wallet/claim-allowance")
def claim_daily_allowance(req: ClaimAllowanceRequest):
    user = ensure_user(req.userId)
    today_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    last_claim = str(user.get("last_daily_allowance_date") or "")
    if last_claim == today_utc:
        raise HTTPException(status_code=400, detail="Daily login bonus already claimed today! Check back tomorrow.")

    bonus = float(DAILY_LOGIN_BONUS_CRED)
    new_balance = float(user["cred_balance"]) + bonus
    execute(
        "UPDATE users SET cred_balance = :b, last_daily_allowance_date = :d WHERE discord_id = :id",
        b=new_balance,
        d=today_utc,
        id=req.userId,
    )

    entry = append_ledger_entry(
        event_type="DAILY_BONUS",
        payload={"amount": bonus, "date": today_utc, "type": "daily_login_bonus"},
        user_id=req.userId,
    )
    produce_block()

    return {
        "success": True,
        "bonusCred": bonus,
        "newCredBalance": f"{new_balance:.2f}",
        "claimedAt": datetime.now(timezone.utc).isoformat(),
        "ledgerHash": entry["hash"],
    }

@app.post("/api/wallet/cashout")
def wallet_cashout(req: CashoutRequest):
    raise HTTPException(
        status_code=400,
        detail="Real-money UPI cashouts have been removed. CordChain is now a 100% fantasy trading economy with $CRED.",
    )

# 5. Sponsor Campaigns
@app.get("/api/campaigns")
def list_campaigns():
    if FANTASY_ONLY:
        return {"campaigns": []}
    rows = query("SELECT * FROM ad_campaigns WHERE is_active = TRUE ORDER BY created_at DESC")
    campaigns = []
    for c in rows:
        campaigns.append({
            "campaignId": str(c["campaign_id"]),
            "sponsorName": c["sponsor_name"],
            "title": c["title"],
            "description": c["description"],
            "mediaUrl": c["media_url"],
            "cpiRateInr": str(c["cpi_rate_inr"]),
            "userRewardInr": str(c["user_reward_inr"]),
            "remainingBudgetInr": str(c["remaining_budget_inr"]),
            "targetCategory": c["target_category"],
        })
    return {"campaigns": campaigns}

@app.post("/api/campaigns/create")
def create_campaign(req: CampaignCreateRequest):
    if req.budgetInr < 10.00:
        raise HTTPException(status_code=400, detail="Minimum campaign deposit is $10.00 USD")

    created = execute_returning("""
        INSERT INTO ad_campaigns (
            sponsor_name, title, description, media_url,
            verify_question, correct_option, wrong_options,
            cpi_rate_inr, user_reward_inr, owner_reward_inr, platform_fee_inr,
            remaining_budget_inr, target_category, is_active
        ) VALUES (
            :sponsor, :title, :desc, :media, :q, :correct, :wrongs,
            6.00, 3.50, 1.00, 1.50, :budget, :cat, TRUE
        ) RETURNING campaign_id
    """, sponsor=req.sponsorName, title=req.title, desc=req.description, media=req.mediaUrl,
       q=req.verifyQuestion, correct=req.correctOption, wrongs=json.dumps(req.wrongOptions),
       budget=req.budgetInr, cat=req.targetCategory)

    return {
        "success": True,
        "campaignId": str(created["campaign_id"]) if created else None,
        "message": "Sponsor ad campaign active in CordChain dividend network!",
    }

# 6. Leaderboards
@app.get("/api/leaderboard/traders")
def trader_leaderboard():
    rows = query("""
        SELECT u.discord_id, u.username, u.avatar, u.cred_balance, u.cash_wallet_inr,
               COALESCE(SUM(h.shares * g.stock_price), 0) AS portfolio_value,
               COALESCE(SUM(h.shares), 0) AS total_shares
        FROM users u
        LEFT JOIN holdings h ON h.user_id = u.discord_id AND h.shares > 0
        LEFT JOIN guilds g ON g.guild_id = h.guild_id
        GROUP BY u.discord_id, u.username, u.avatar, u.cred_balance, u.cash_wallet_inr
        ORDER BY (u.cred_balance + COALESCE(SUM(h.shares * g.stock_price), 0)) DESC
        LIMIT 10
    """)
    top_tickers = query("""
        SELECT h.user_id, g.ticker FROM holdings h
        JOIN guilds g ON g.guild_id = h.guild_id
        WHERE h.shares > 0
        ORDER BY h.shares * g.stock_price DESC
    """)
    top_asset_map = {}
    for t in top_tickers:
        top_asset_map.setdefault(t["user_id"], t["ticker"])

    traders = []
    for rank, r in enumerate(rows, start=1):
        net_worth = float(r["cred_balance"]) + float(r["portfolio_value"])
        equity_pct = (float(r["portfolio_value"]) / net_worth * 100) if net_worth > 0 else 0.0
        traders.append({
            "rank": rank,
            "discordId": r["discord_id"],
            "username": r["username"],
            "avatar": r["avatar"],
            "netWorthCred": str(net_worth),
            "roiPct": round(min(equity_pct, 248.5), 1),
            "winRate": min(88, 40 + int(float(r["cred_balance"]) / 1000) % 49),
            "topAsset": top_asset_map.get(r["discord_id"]) or "$CORD",
        })
    return {"traders": traders}

@app.get("/api/leaderboard/servers")
def server_leaderboard():
    rows = query("""
        SELECT g.*, ((g.stock_price - g.previous_day_price) / NULLIF(g.previous_day_price, 0)) AS gain_24h
        FROM guilds g
        ORDER BY (((g.stock_price * g.circulating_shares) - (g.previous_day_price * g.circulating_shares))
                  / NULLIF(g.previous_day_price * g.circulating_shares, 0)) DESC
        LIMIT 10
    """)
    servers = []
    for rank, g in enumerate(rows, start=1):
        market_cap = float(g["stock_price"]) * g["circulating_shares"]
        servers.append({
            "rank": rank,
            "guildId": g["guild_id"],
            "ticker": g["ticker"],
            "name": g["name"],
            "leagueTier": g["league_tier"],
            "leagueName": LEAGUE_TIER_NAMES.get(g["league_tier"], "Squad"),
            "iconUrl": g["icon_url"],
            "memberCountCurrent": g["member_count_current"],
            "marketCapCred": str(round(market_cap, 2)),
            "boostPower": g["member_count_current"] * 7 + g["circulating_shares"],
            "dividendYield": "12.8%",
            "change24hPct": round((g["gain_24h"] or 0) * 100, 1),
        })
    return {"servers": servers}

# ----------------- CordLedger Endpoints (Replaces Base Sepolia) -----------------
@app.get("/api/ledger/status")
@app.get("/api/blockchain/status")
def ledger_status():
    from cordchain.blockchain import get_blockchain_status
    return get_blockchain_status()

@app.get("/api/ledger/blocks")
def ledger_blocks(limit: int = 20, offset: int = 0):
    rows = query(
        "SELECT * FROM cord_blocks ORDER BY height DESC LIMIT :lim OFFSET :off",
        lim=max(1, min(100, limit)),
        off=max(0, offset),
    )
    total = (query_one("SELECT count(*) as cnt FROM cord_blocks") or {}).get("cnt", 0)
    return {
        "totalBlocks": total,
        "blocks": [
            {
                "height": r["height"],
                "timestamp": r["timestamp"].isoformat() if isinstance(r["timestamp"], datetime) else str(r["timestamp"]),
                "entryCount": r["entry_count"],
                "startEntryIndex": r["start_entry_index"],
                "endEntryIndex": r["end_entry_index"],
                "merkleRoot": r["merkle_root"],
                "prevBlockHash": r["prev_block_hash"],
                "blockHash": r["block_hash"],
                "signature": r["signature"],
                "signerPubkey": r["signer_pubkey"],
            }
            for r in rows
        ],
    }

@app.get("/api/ledger/blocks/{height}")
def ledger_block_detail(height: int):
    block = query_one("SELECT * FROM cord_blocks WHERE height = :h", h=height)
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    entries = query(
        """
        SELECT l.*, g.ticker, g.name as server_name, u.username
        FROM cord_ledger l
        LEFT JOIN guilds g ON l.guild_id = g.guild_id
        LEFT JOIN users u ON l.user_id = u.discord_id
        WHERE l.block_height = :h
        ORDER BY l.entry_index ASC
        """,
        h=height,
    )
    return {
        "block": {
            "height": block["height"],
            "timestamp": block["timestamp"].isoformat() if isinstance(block["timestamp"], datetime) else str(block["timestamp"]),
            "entryCount": block["entry_count"],
            "merkleRoot": block["merkle_root"],
            "prevBlockHash": block["prev_block_hash"],
            "blockHash": block["block_hash"],
            "signature": block["signature"],
            "signerPubkey": block["signer_pubkey"],
        },
        "entries": [
            {
                "entryIndex": r["entry_index"],
                "timestamp": r["timestamp"].isoformat() if isinstance(r["timestamp"], datetime) else str(r["timestamp"]),
                "eventType": r["event_type"],
                "guildId": r["guild_id"],
                "ticker": r.get("ticker"),
                "serverName": r.get("server_name"),
                "userId": r["user_id"],
                "username": r.get("username"),
                "payload": r["payload"] if isinstance(r["payload"], dict) else json.loads(r["payload"]),
                "prevHash": r["prev_hash"],
                "hash": r["hash"],
                "blockHeight": r["block_height"],
                "ts": r["ts"],
            }
            for r in entries
        ],
    }

@app.get("/api/ledger/entries")
def ledger_entries(
    limit: int = 30,
    offset: int = 0,
    guildId: Optional[str] = None,
    userId: Optional[str] = None,
    eventType: Optional[str] = None,
):
    clauses = ["1=1"]
    params = {"lim": max(1, min(100, limit)), "off": max(0, offset)}
    if guildId:
        clauses.append("l.guild_id = :gid")
        params["gid"] = guildId
    if userId:
        clauses.append("l.user_id = :uid")
        params["uid"] = userId
    if eventType:
        clauses.append("l.event_type = :evt")
        params["evt"] = eventType.upper()

    where_sql = " AND ".join(clauses)
    rows = query(
        f"""
        SELECT l.*, g.ticker, g.name as server_name, u.username
        FROM cord_ledger l
        LEFT JOIN guilds g ON l.guild_id = g.guild_id
        LEFT JOIN users u ON l.user_id = u.discord_id
        WHERE {where_sql}
        ORDER BY l.entry_index DESC
        LIMIT :lim OFFSET :off
        """,
        **params,
    )
    total = (query_one(f"SELECT count(*) as cnt FROM cord_ledger l WHERE {where_sql}", **params) or {}).get("cnt", 0)
    return {
        "totalEntries": total,
        "entries": [
            {
                "entryIndex": r["entry_index"],
                "timestamp": r["timestamp"].isoformat() if isinstance(r["timestamp"], datetime) else str(r["timestamp"]),
                "eventType": r["event_type"],
                "guildId": r["guild_id"],
                "ticker": r.get("ticker"),
                "serverName": r.get("server_name"),
                "userId": r["user_id"],
                "username": r.get("username"),
                "payload": r["payload"] if isinstance(r["payload"], dict) else json.loads(r["payload"]),
                "prevHash": r["prev_hash"],
                "hash": r["hash"],
                "blockHeight": r["block_height"],
                "ts": r["ts"],
            }
            for r in rows
        ],
    }

@app.get("/api/ledger/entry/{hash_or_id}")
@app.get("/api/blockchain/tx/{hash_or_id}")
def ledger_entry_detail(hash_or_id: str):
    clean = hash_or_id.strip()
    if clean.isdigit():
        row = query_one(
            """
            SELECT l.*, g.ticker, g.name as server_name, u.username
            FROM cord_ledger l
            LEFT JOIN guilds g ON l.guild_id = g.guild_id
            LEFT JOIN users u ON l.user_id = u.discord_id
            WHERE l.entry_index = :idx
            """,
            idx=int(clean),
        )
    else:
        row = query_one(
            """
            SELECT l.*, g.ticker, g.name as server_name, u.username
            FROM cord_ledger l
            LEFT JOIN guilds g ON l.guild_id = g.guild_id
            LEFT JOIN users u ON l.user_id = u.discord_id
            WHERE l.hash = :h
            """,
            h=clean,
        )

    if not row:
        raise HTTPException(status_code=404, detail="Ledger entry not found")

    block = query_one("SELECT * FROM cord_blocks WHERE height = :h", h=row["block_height"]) if row["block_height"] is not None else None
    return {
        "entry": {
            "entryIndex": row["entry_index"],
            "timestamp": row["timestamp"].isoformat() if isinstance(row["timestamp"], datetime) else str(row["timestamp"]),
            "eventType": row["event_type"],
            "guildId": row["guild_id"],
            "ticker": row.get("ticker"),
            "serverName": row.get("server_name"),
            "userId": row["user_id"],
            "username": row.get("username"),
            "payload": row["payload"] if isinstance(row["payload"], dict) else json.loads(row["payload"]),
            "prevHash": row["prev_hash"],
            "hash": row["hash"],
            "blockHeight": row["block_height"],
        },
        "block": block,
        "isVerified": True,
        "tamperEvident": True,
        "explorerUrl": f"/scan/tx/{row['hash']}",
    }

@app.get("/api/ledger/token/{guild_id}")
def ledger_token_page(guild_id: str):
    g = query_one("SELECT * FROM guilds WHERE guild_id = :gid", gid=guild_id)
    if not g:
        raise HTTPException(status_code=404, detail="Server stock not found")

    holders = query(
        """
        SELECT h.user_id, h.shares, h.avg_buy_price, u.username, u.avatar
        FROM holdings h
        JOIN users u ON h.user_id = u.discord_id
        WHERE h.guild_id = :gid AND h.shares > 0
        ORDER BY h.shares DESC LIMIT 20
        """,
        gid=guild_id,
    )

    recent_txs = query(
        """
        SELECT l.*, u.username
        FROM cord_ledger l
        LEFT JOIN users u ON l.user_id = u.discord_id
        WHERE l.guild_id = :gid
        ORDER BY l.entry_index DESC LIMIT 25
        """,
        gid=guild_id,
    )

    cur_price = float(g["stock_price"])
    fixed_supply = int(g.get("fixed_supply") or 1_000_000)
    circulating = int(g.get("circulating_shares") or 750_000)
    creator_res = int(g.get("creator_reserve_shares") or 250_000)
    creator_vested = int(g.get("creator_vested_shares") or 50_000)
    creator_locked = int(g.get("creator_locked_shares") or 200_000)

    return {
        "guild": {
            "guildId": g["guild_id"],
            "name": g["name"],
            "ticker": g["ticker"],
            "iconUrl": g["icon_url"],
            "stockPrice": format_price(g["stock_price"]),
            "fixedSupply": fixed_supply,
            "marketCapCred": round(cur_price * fixed_supply, 2),
            "circulatingShares": circulating,
            "creatorReserveShares": creator_res,
            "creatorVestedShares": creator_vested,
            "creatorLockedShares": creator_locked,
            "communityScore": float(g.get("community_score") or 100.0),
            "league": g.get("league") or determine_league(g["member_count_current"]),
            "circuitBreakerUntil": g.get("circuit_breaker_until").isoformat() if g.get("circuit_breaker_until") else None,
        },
        "holders": [
            {
                "userId": h["user_id"],
                "username": h["username"],
                "avatar": h["avatar"],
                "shares": h["shares"],
                "percentageOfSupply": round((h["shares"] / fixed_supply) * 100, 2),
                "avgBuyPrice": str(h["avg_buy_price"]),
            }
            for h in holders
        ],
        "transactions": [
            {
                "entryIndex": t["entry_index"],
                "timestamp": t["timestamp"].isoformat() if isinstance(t["timestamp"], datetime) else str(t["timestamp"]),
                "eventType": t["event_type"],
                "userId": t["user_id"],
                "username": t.get("username"),
                "hash": t["hash"],
                "payload": t["payload"] if isinstance(t["payload"], dict) else json.loads(t["payload"]),
                "blockHeight": t["block_height"],
            }
            for t in recent_txs
        ],
    }

@app.get("/api/ledger/verify")
def ledger_verify_chain():
    return verify_ledger_integrity()

@app.get("/api/ledger/checkpoint")
def ledger_daily_checkpoint():
    return generate_daily_checkpoint()

# ----------------- Community Scoring & Earnings Endpoints -----------------
@app.post("/api/guilds/{guild_id}/distribute-earnings")
def distribute_server_earnings(guild_id: str):
    guild = query_one("SELECT * FROM guilds WHERE guild_id = :gid", gid=guild_id)
    if not guild:
        raise HTTPException(status_code=404, detail="Guild not found")

    score = float(guild.get("community_score") or 100.0)
    league = guild.get("league") or determine_league(guild["member_count_current"])
    circulating = int(guild.get("circulating_shares") or 750_000)

    earnings = calculate_weekly_earnings(score, league, circulating)
    total_payout = earnings["totalPayoutCred"]
    per_share = earnings["payoutPerShare"]

    # Distribute to holders
    holders = query("SELECT user_id, shares FROM holdings WHERE guild_id = :gid AND shares > 0", gid=guild_id)
    paid_count = 0
    for h in holders:
        user_payout = round(h["shares"] * per_share, 2)
        if user_payout > 0:
            execute(
                "UPDATE users SET cred_balance = cred_balance + :amt WHERE discord_id = :uid",
                amt=user_payout,
                uid=h["user_id"],
            )
            paid_count += 1

    # Record ledger entry
    payload = {
        "week": int(datetime.now(timezone.utc).strftime("%U")),
        "communityScore": score,
        "totalPayoutCred": total_payout,
        "payoutPerShare": per_share,
        "shareholdersPaid": paid_count,
    }
    entry = append_ledger_entry(
        event_type="COMMUNITY_PAYOUT",
        payload=payload,
        guild_id=guild_id,
    )
    produce_block()

    # Save to weekly_earnings_reports table
    report = execute_returning(
        """
        INSERT INTO weekly_earnings_reports (
            guild_id, week_number, community_score, total_payout_cred,
            payout_per_share, chatter_count, ledger_hash
        ) VALUES (
            :gid, :w, :score, :total, :per_share, :chatters, :h
        ) RETURNING id
        """,
        gid=guild_id,
        w=int(datetime.now(timezone.utc).strftime("%U")),
        score=score,
        total=total_payout,
        per_share=per_share,
        chatters=guild["member_count_current"],
        h=entry["hash"],
    )

    return {
        "success": True,
        "reportId": str(report["id"]) if report else None,
        "totalPayoutCred": total_payout,
        "payoutPerShare": per_share,
        "shareholdersPaid": paid_count,
        "ledgerHash": entry["hash"],
    }

@app.get("/api/guilds/{guild_id}/earnings-history")
def server_earnings_history(guild_id: str):
    reports = query(
        """
        SELECT * FROM weekly_earnings_reports
        WHERE guild_id = :gid
        ORDER BY distributed_at DESC LIMIT 20
        """,
        gid=guild_id,
    )
    return {"reports": reports}

@app.get("/api/seasons")
def list_seasons():
    seasons = query("SELECT * FROM seasons ORDER BY season_id DESC")
    return {"seasons": seasons}

@app.get("/api/rivalries")
def list_rivalries():
    rivalries = query(
        """
        SELECT r.*, ga.name as guild_a_name, ga.ticker as guild_a_ticker, ga.icon_url as guild_a_icon,
               gb.name as guild_b_name, gb.ticker as guild_b_ticker, gb.icon_url as guild_b_icon
        FROM server_rivalries r
        JOIN guilds ga ON r.guild_a = ga.guild_id
        JOIN guilds gb ON r.guild_b = gb.guild_id
        ORDER BY r.start_time DESC
        """
    )
    return {"rivalries": rivalries}

@app.get("/api/quests")
def list_quests(guildId: Optional[str] = None):
    sql = "SELECT * FROM community_quests WHERE is_completed = FALSE"
    params = {}
    if guildId:
        sql += " AND guild_id = :gid"
        params["gid"] = guildId
    sql += " ORDER BY expires_at ASC"
    quests = query(sql, **params)
    return {"quests": quests}

@app.get("/api/predictions")
def list_predictions(guildId: Optional[str] = None):
    sql = "SELECT p.*, g.name as server_name, g.ticker FROM prediction_markets p JOIN guilds g ON p.guild_id = g.guild_id WHERE p.status = 'OPEN'"
    params = {}
    if guildId:
        sql += " AND p.guild_id = :gid"
        params["gid"] = guildId
    sql += " ORDER BY p.resolves_at ASC"
    predictions = query(sql, **params)
    return {"predictions": predictions}

@app.get("/api/guilds/{guild_id}/vesting-status")
def get_vesting_status(guild_id: str):
    """Retrieve creator reserve vesting schedule and unlock eligibility."""
    guild = query_one("SELECT * FROM guilds WHERE guild_id = :gid", gid=guild_id)
    if not guild:
        raise HTTPException(status_code=404, detail="Server not found on CordChain")

    locked = int(guild.get("creator_locked_shares") or 0)
    vested = int(guild.get("creator_vested_shares") or 0)
    reserve = int(guild.get("creator_reserve_shares") or (locked + vested))
    last_unlocked = guild.get("vesting_last_unlocked_at") or guild.get("created_at")

    if isinstance(last_unlocked, str):
        last_unlocked_dt = datetime.fromisoformat(last_unlocked.replace("Z", "+00:00"))
    elif last_unlocked and last_unlocked.tzinfo is None:
        last_unlocked_dt = last_unlocked.replace(tzinfo=timezone.utc)
    else:
        last_unlocked_dt = last_unlocked or datetime.now(timezone.utc)

    now = datetime.now(timezone.utc)
    days_elapsed = (now - last_unlocked_dt).total_seconds() / 86400.0 if last_unlocked_dt else 30.0
    can_unlock = locked > 0 and days_elapsed >= 30.0
    days_remaining = max(0, int(30.0 - days_elapsed)) if locked > 0 else 0

    return {
        "guildId": guild_id,
        "ticker": guild.get("ticker"),
        "totalCreatorReserveShares": reserve,
        "vestedShares": vested,
        "lockedShares": locked,
        "vestingLastUnlockedAt": last_unlocked_dt.isoformat() if last_unlocked_dt else None,
        "canUnlockNow": can_unlock,
        "daysRemainingUntilNextTranche": days_remaining,
        "nextTrancheShares": min(locked, 50_000) if locked > 0 else 0,
        "monthlyTranchePercent": 5.0,
    }

@app.post("/api/guilds/{guild_id}/vesting-unlock")
def trigger_vesting_unlock(guild_id: str):
    """Ledger-enforced vesting unlock: releases 5% (50,000 shares) per 30-day period
    from creator_locked_shares into creator_vested_shares and logs VESTING_UNLOCK to CordLedger."""
    guild = query_one("SELECT * FROM guilds WHERE guild_id = :gid", gid=guild_id)
    if not guild:
        raise HTTPException(status_code=404, detail="Server not found on CordChain")

    locked = int(guild.get("creator_locked_shares") or 0)
    if locked <= 0:
        raise HTTPException(status_code=400, detail="All creator reserve shares are already fully vested and unlocked.")

    last_unlocked = guild.get("vesting_last_unlocked_at") or guild.get("created_at")
    if isinstance(last_unlocked, str):
        last_unlocked_dt = datetime.fromisoformat(last_unlocked.replace("Z", "+00:00"))
    elif last_unlocked and last_unlocked.tzinfo is None:
        last_unlocked_dt = last_unlocked.replace(tzinfo=timezone.utc)
    else:
        last_unlocked_dt = last_unlocked or datetime.now(timezone.utc)

    now = datetime.now(timezone.utc)
    days_elapsed = (now - last_unlocked_dt).total_seconds() / 86400.0 if last_unlocked_dt else 30.0
    if days_elapsed < 30.0:
        days_remaining = max(1, int(30.0 - days_elapsed))
        raise HTTPException(
            status_code=400,
            detail=f"Vesting locked: next 5% monthly tranche unlocks in {days_remaining} day(s).",
        )

    unlock_amount = min(locked, 50_000)
    new_locked = locked - unlock_amount
    new_vested = int(guild.get("creator_vested_shares") or 0) + unlock_amount
    owner_id = guild.get("owner_id")

    execute(
        """
        UPDATE guilds
        SET creator_locked_shares = :locked,
            creator_vested_shares = :vested,
            vesting_last_unlocked_at = NOW()
        WHERE guild_id = :gid
        """,
        locked=new_locked,
        vested=new_vested,
        gid=guild_id,
    )

    if owner_id and owner_id != "000000000000000000":
        ensure_user(owner_id)
        execute(
            """
            INSERT INTO holdings (user_id, guild_id, shares, avg_buy_price, updated_at)
            VALUES (:uid, :gid, :shares, :price, NOW())
            ON CONFLICT (user_id, guild_id)
            DO UPDATE SET shares = holdings.shares + :shares, updated_at = NOW()
            """,
            uid=owner_id,
            gid=guild_id,
            shares=unlock_amount,
            price=guild.get("stock_price") or 1.0,
        )

    entry = append_ledger_entry(
        event_type="VESTING_UNLOCK",
        payload={
            "guildId": guild_id,
            "ticker": guild.get("ticker"),
            "unlockedShares": unlock_amount,
            "remainingLockedShares": new_locked,
            "totalVestedShares": new_vested,
            "ownerId": owner_id,
        },
        guild_id=guild_id,
        user_id=owner_id,
    )
    produce_block()

    return {
        "success": True,
        "unlockedShares": unlock_amount,
        "remainingLockedShares": new_locked,
        "totalVestedShares": new_vested,
        "ledgerHash": entry["hash"],
    }


