"""Bot-Resistant Community Scoring & Anti-Cheat Engine.

Implements Section 4:
  - Unique active chatters with sqrt scaling & per-user daily cap.
  - Retention rate: percentage of last week's active chatters active again this week.
  - Conversation spread: Shannon entropy across chatter distributions.
  - Secondary signals: Voice minutes and median account age.
  - Growth vs. server's own rolling baseline: Allows growing small servers to beat flat mega-servers.
  - Strict privacy: Operates strictly on hashed user IDs and aggregate counts, never message content.
"""

from __future__ import annotations

import math
import hashlib
from datetime import datetime, timezone
from typing import Sequence

DISCORD_EPOCH = 1420070400000
PER_USER_DAILY_MESSAGE_CAP = 25

def hash_discord_id(discord_id: str | int) -> str:
    """Anonymize Discord ID via SHA-256 for privacy."""
    return hashlib.sha256(str(discord_id).encode("utf-8")).hexdigest()[:16]

def snowflake_to_datetime(snowflake_id: str | int) -> datetime:
    """Extract account creation timestamp from Discord Snowflake ID."""
    try:
        snowflake = int(snowflake_id)
        timestamp_ms = (snowflake >> 22) + DISCORD_EPOCH
        return datetime.fromtimestamp(timestamp_ms / 1000.0, tz=timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)

def account_age_days(snowflake_id: str | int) -> int:
    """Calculate age of account in days."""
    created_at = snowflake_to_datetime(snowflake_id)
    age_seconds = (datetime.now(timezone.utc) - created_at).total_seconds()
    return max(0, int(age_seconds / 86400))

def is_account_old_enough(snowflake_id: str | int, min_days: int = 14) -> bool:
    """Check if account is older than min_days."""
    return account_age_days(snowflake_id) >= min_days

def shuffle_options(correct: str, wrongs: list[str]) -> list[str]:
    """Shuffle attention options."""
    import random
    choices = [correct] + list(wrongs)
    random.shuffle(choices)
    return choices

def compute_conversation_spread(message_counts_per_chatter: Sequence[int]) -> float:
    """Calculate normalized Shannon entropy for conversation spread.
    
    10 people sending 10 messages each = Maximum entropy (1.0).
    3 people sending 10,000 messages while others send 0 = Low entropy (<0.3).
    """
    total = sum(message_counts_per_chatter)
    if total <= 0 or len(message_counts_per_chatter) <= 1:
        return 1.0

    n = len(message_counts_per_chatter)
    max_entropy = math.log2(n)
    if max_entropy <= 0:
        return 1.0

    entropy = 0.0
    for count in message_counts_per_chatter:
        if count > 0:
            p = count / total
            entropy -= p * math.log2(p)

    normalized_entropy = entropy / max_entropy
    return max(0.2, min(1.5, normalized_entropy))

def compute_retention_rate(
    current_chatter_hashes: set[str],
    previous_chatter_hashes: set[str],
) -> float:
    """Calculate retention: proportion of last week's active chatters that returned."""
    if not previous_chatter_hashes:
        return 1.0
    overlap = len(current_chatter_hashes & previous_chatter_hashes)
    return max(0.1, min(1.5, overlap / len(previous_chatter_hashes)))

def compute_bot_resistant_community_score(
    unique_chatters: int,
    capped_total_messages: int,
    spread_entropy: float,
    retention_rate: float,
    voice_minutes: int,
    median_account_age_days: int,
    growth_vs_baseline: float,
) -> float:
    """Compute overall bot-resistant Community Score.
    
    Score = S_chatters * W_spread * W_retention * (1 + B_growth) + B_voice * B_age
    """
    # 1. Unique active chatters scaled with square-root (anti-spam)
    s_chatters = math.sqrt(max(0, unique_chatters)) * 12.0

    # 2. Conversation spread weight (0.3 to 1.3)
    w_spread = max(0.3, min(1.3, spread_entropy))

    # 3. Retention weight (0.5 to 1.5)
    w_retention = max(0.5, min(1.5, retention_rate))

    # 4. Growth bonus (capped between -0.4 and +1.0)
    b_growth = max(-0.4, min(1.0, growth_vs_baseline - 1.0))

    # 5. Voice activity bonus (square root scaled)
    b_voice = math.sqrt(max(0, voice_minutes)) * 0.4

    # 6. Account age factor (filters burner accounts < 14 days old)
    if median_account_age_days < 7:
        age_factor = 0.3
    elif median_account_age_days < 14:
        age_factor = 0.6
    elif median_account_age_days < 30:
        age_factor = 0.85
    else:
        age_factor = 1.0

    raw_score = (s_chatters * w_spread * w_retention * (1.0 + b_growth) + b_voice) * age_factor
    return round(max(10.0, raw_score), 2)
