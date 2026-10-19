"""CordChain two-layer pricing engine and market defense system.

Layer 1: Market Price (Trading)
  - Constant-product AMM pool per server stock alongside the order book.
  - Circuit breakers: 20% price swing in a 15-minute window pauses trading for 30 minutes.
  - Position limits: Max 10% of total server supply (100,000 shares) per account.
  - Wash-trade detection: Rapid round-trip trading within 60s is rejected.

Layer 2: Fair Value (Fundamentals)
  - Weekly Earnings Report translates Community Score into $CRED shareholder payouts.
  - Gives traders fundamental reasons to research servers rather than purely chasing hype.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone, timedelta
from typing import Optional
from decimal import Decimal
from cordchain.db import query, query_one, execute

# Total fixed supply per server
FIXED_SUPPLY_PER_SERVER = 1_000_000
MAX_USER_SHARE_LIMIT = 100_000  # 10% of fixed supply
CIRCUIT_BREAKER_SWING_PCT = 0.20  # 20% swing triggers pause
CIRCUIT_BREAKER_WINDOW_MINUTES = 15
CIRCUIT_BREAKER_PAUSE_MINUTES = 30
WASH_TRADE_WINDOW_SECONDS = 60

# League configurations
LEAGUES = {
    "Bronze": {"min_members": 15, "max_members": 200, "base_payout_rate": 25.0, "icon": "🥉"},
    "Silver": {"min_members": 201, "max_members": 2000, "base_payout_rate": 60.0, "icon": "🥈"},
    "Gold": {"min_members": 2001, "max_members": 1_000_000, "base_payout_rate": 150.0, "icon": "🥇"},
}

def determine_league(member_count: int) -> str:
    """Classify server into Bronze, Silver, or Gold league based on member count."""
    if member_count >= 2001:
        return "Gold"
    elif member_count >= 201:
        return "Silver"
    return "Bronze"

# ----------------- Layer 1: AMM Pricing -----------------

def amm_quote(pool_shares: float, pool_cred: float, shares: int, action: str) -> tuple[float, float, float]:
    """Calculate constant-product swap quote with micro-penny precision.
    
    Returns:
        (new_pool_shares, new_pool_cred, delta_cred)
    """
    S = max(1.0, float(pool_shares))
    C = max(1e-9, float(pool_cred))
    k = S * C

    if action.upper() == "BUY":
        if shares >= S:
            shares = max(1, int(S * 0.9))  # Guard against draining pool
        S_new = S - shares
        C_new = k / S_new
        delta_cred = C_new - C
        return S_new, C_new, round(delta_cred, 6)
    else:  # SELL
        S_new = S + shares
        C_new = k / S_new
        delta_cred = C - C_new
        return S_new, C_new, round(delta_cred, 6)

def pool_spot_price(pool_shares: float, pool_cred: float) -> float:
    """Current spot price = Pool CRED / Pool Shares."""
    S = max(1.0, float(pool_shares))
    C = max(1e-9, float(pool_cred))
    return round(C / S, 6)

# ----------------- Market Defenses -----------------

def check_circuit_breaker(guild_id: str) -> Optional[dict]:
    """Check if circuit breaker is active or should be triggered.
    
    Returns error dict if trading is paused, otherwise None.
    """
    guild = query_one(
        "SELECT circuit_breaker_until, stock_price FROM guilds WHERE guild_id = :gid",
        gid=guild_id,
    )
    if not guild:
        return None

    now = datetime.now(timezone.utc)
    cb_until = guild.get("circuit_breaker_until")
    if cb_until:
        if isinstance(cb_until, str):
            cb_until = datetime.fromisoformat(cb_until.replace("Z", "+00:00"))
        if cb_until > now:
            remaining_secs = int((cb_until - now).total_seconds())
            remaining_mins = max(1, remaining_secs // 60)
            return {
                "triggered": True,
                "pauseRemainingMinutes": remaining_mins,
                "pausedUntil": cb_until.isoformat(),
                "reason": f"Circuit breaker active: trading paused for {remaining_mins} more minutes due to extreme volatility (>20% swing).",
            }

    # Check 15-minute price swing from price_history
    fifteen_mins_ago = now - timedelta(minutes=CIRCUIT_BREAKER_WINDOW_MINUTES)
    old_tick = query_one(
        """
        SELECT price FROM price_history
        WHERE guild_id = :gid AND created_at <= :t
        ORDER BY created_at DESC LIMIT 1
        """,
        gid=guild_id,
        t=fifteen_mins_ago,
    )
    if old_tick:
        old_price = float(old_tick["price"])
        current_price = float(guild["stock_price"])
        if old_price > 0:
            swing = abs(current_price - old_price) / old_price
            if swing >= CIRCUIT_BREAKER_SWING_PCT:
                # Trigger circuit breaker
                pause_until = now + timedelta(minutes=CIRCUIT_BREAKER_PAUSE_MINUTES)
                execute(
                    "UPDATE guilds SET circuit_breaker_until = :until WHERE guild_id = :gid",
                    until=pause_until,
                    gid=guild_id,
                )
                return {
                    "triggered": True,
                    "pauseRemainingMinutes": CIRCUIT_BREAKER_PAUSE_MINUTES,
                    "pausedUntil": pause_until.isoformat(),
                    "reason": f"Circuit breaker triggered: price moved {swing*100:.1f}% in under {CIRCUIT_BREAKER_WINDOW_MINUTES} minutes. Trading paused for {CIRCUIT_BREAKER_PAUSE_MINUTES} minutes.",
                }

    return None

def check_position_limit(user_id: str, guild_id: str, buying_shares: int) -> Optional[str]:
    """Check if buying would cause user to exceed 10% total supply."""
    current_holding = query_one(
        "SELECT shares FROM holdings WHERE user_id = :uid AND guild_id = :gid",
        uid=user_id,
        gid=guild_id,
    )
    current_shares = int(current_holding["shares"]) if current_holding else 0
    new_total = current_shares + buying_shares
    if new_total > MAX_USER_SHARE_LIMIT:
        return (
            f"Position limit exceeded: you currently hold {current_shares:,} shares. "
            f"Adding {buying_shares:,} would exceed the 10% maximum cap of {MAX_USER_SHARE_LIMIT:,} shares."
        )
    return None

def check_wash_trade(user_id: str, guild_id: str, current_action: str) -> Optional[str]:
    """Reject rapid round-trip buy/sell alternation within 60 seconds."""
    recent_trade = query_one(
        """
        SELECT action, created_at FROM trade_transactions
        WHERE user_id = :uid AND guild_id = :gid
        ORDER BY created_at DESC LIMIT 1
        """,
        uid=user_id,
        gid=guild_id,
    )
    if recent_trade:
        trade_time = recent_trade["created_at"]
        if isinstance(trade_time, str):
            trade_time = datetime.fromisoformat(trade_time.replace("Z", "+00:00"))
        elif trade_time.tzinfo is None:
            trade_time = trade_time.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        elapsed = (now - trade_time).total_seconds()
        last_action = str(recent_trade["action"]).upper()
        if elapsed < WASH_TRADE_WINDOW_SECONDS and last_action != current_action.upper():
            return (
                f"Wash-trade protection: opposite action executed {int(elapsed)}s ago. "
                f"Please wait {int(WASH_TRADE_WINDOW_SECONDS - elapsed)}s before flipping position."
            )
    return None

# ----------------- Layer 2: Fair Value Fundamentals -----------------

def get_community_collab_tier(guild_id: str) -> dict:
    """Computes the 24-hour Community Collaboration Tier for a guild.
    
    Collective collaboration across server members unlocks score multipliers
    and dividend yield boosts:
      - Alliance Rally (10+ unique contributors): 1.60x multiplier (+50% dividend boost)
      - Guild Synergy (5-9 unique contributors): 1.35x multiplier (+25% dividend boost)
      - Squad Co-op (2-4 unique contributors): 1.15x multiplier (+10% dividend boost)
      - Solo Effort (1 contributor): 1.00x baseline (0% bonus)
    """
    try:
        contributors = query(
            """
            SELECT DISTINCT user_id FROM (
                SELECT user_id FROM checkin_logs WHERE guild_id = :gid AND created_at >= NOW() - INTERVAL '24 hours'
                UNION
                SELECT user_id FROM guild_bumps WHERE guild_id = :gid AND bumped_at >= NOW() - INTERVAL '24 hours'
                UNION
                SELECT user_id FROM trade_transactions WHERE guild_id = :gid AND created_at >= NOW() - INTERVAL '24 hours'
                UNION
                SELECT user_id FROM holdings WHERE guild_id = :gid AND shares > 0
            ) c
            """,
            gid=guild_id,
        )
        count = len(contributors)
    except Exception:
        count = 1

    if count >= 10:
        return {
            "tierName": "Alliance Rally",
            "tier": 4,
            "icon": "⚡",
            "contributors24h": count,
            "multiplier": 1.60,
            "bonusPct": 50,
            "description": "10+ members collaborating! +50% earnings dividend yield & top liquidity backing.",
        }
    elif count >= 5:
        return {
            "tierName": "Guild Synergy",
            "tier": 3,
            "icon": "🔥",
            "contributors24h": count,
            "multiplier": 1.35,
            "bonusPct": 25,
            "description": "5-9 active collaborators! +25% earnings dividend yield & enhanced score.",
        }
    elif count >= 2:
        return {
            "tierName": "Squad Co-op",
            "tier": 2,
            "icon": "🤝",
            "contributors24h": count,
            "multiplier": 1.15,
            "bonusPct": 10,
            "description": "2-4 members cooperating! +10% earnings dividend yield.",
        }
    else:
        return {
            "tierName": "Solo Effort",
            "tier": 1,
            "icon": "🌱",
            "contributors24h": max(1, count),
            "multiplier": 1.00,
            "bonusPct": 0,
            "description": "Solo contributor. Rally your server members to collaborate and unlock bonus multipliers!",
        }

def calculate_weekly_earnings(
    community_score: float,
    league: str,
    circulating_shares: int,
    collab_multiplier: float = 1.0,
) -> dict:
    """Translate weekly Community Score into fantasy $CRED shareholder earnings."""
    conf = LEAGUES.get(league, LEAGUES["Bronze"])
    base_rate = conf["base_payout_rate"]
    # Payout pool scales with score, league, and collaborative synergy multiplier
    effective_score = max(0.0, float(community_score)) * max(1.0, float(collab_multiplier))
    total_payout_cred = round(effective_score * base_rate, 2)
    float_shares = max(1, circulating_shares)
    payout_per_share = round(total_payout_cred / float_shares, 6)

    # Implied fundamental annual yield & fair value (assuming 10% capitalization rate)
    annual_payout_per_share = payout_per_share * 52
    fair_value = round(annual_payout_per_share / 0.10, 6)

    return {
        "league": league,
        "communityScore": float(community_score),
        "effectiveScore": round(effective_score, 2),
        "collabMultiplier": collab_multiplier,
        "totalPayoutCred": total_payout_cred,
        "payoutPerShare": payout_per_share,
        "annualPayoutPerShare": round(annual_payout_per_share, 6),
        "fairValue": fair_value,
    }
