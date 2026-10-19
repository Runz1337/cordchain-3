"""Cross-cog helpers: shared ticker lookup + common receipt affordances."""

from __future__ import annotations

from cordchain.utils import api_client
from cordchain.utils.api_client import ApiError

ticker_cache: dict[str, str] = {}


async def resolve_ticker(raw: str) -> dict | None:
    """Resolve a user-supplied ticker to the API guild row (exact match)."""
    cleaned = (raw or "").strip().upper().lstrip("$")
    if not cleaned:
        return None
    try:
        rows = await api_client.guilds(search="$" + cleaned)
    except (ApiError, Exception):
        return None
    for row in rows:
        if str(row.get("ticker", "")).upper().lstrip("$") == cleaned:
            return {"guild": row, "guildId": row.get("guildId")}
    return None


def description_chip(market_state: str | None, held_shares: str | int | None) -> str:
    state = (market_state or "").lower()
    held = held_shares
    try:
        held_i = int(float(held))
    except (TypeError, ValueError):
        held_i = 0
    if held_i <= 0 and state == "dormant":
        return "⟳ Sleeping AMM — zero shares held, treasury intact"
    if held_i > 0:
        return f"● Live market — {held_i:,} shares in player hands"
    return "● Waiting for the first shareholder to open"


async def safe(guild_provider):
    try:
        return await guild_provider()
    except ApiError:
        return None
