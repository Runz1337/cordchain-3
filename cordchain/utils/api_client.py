"""Async client for the CordChain FastAPI.

Every bot feature that touches trading, wallets, bumps, check-ins, or market
data goes through this client instead of writing rows directly to PostgreSQL.
The FastAPI is the one and only price-machinic brain (constant-product AMM,
subscriptions ledger, anti-farm guards, chain receipts) — the bot stays a
thin presentational shell so web and Discord can never drift apart.
"""

from __future__ import annotations

import os
from typing import Any

import aiohttp

BASE_URL = os.environ.get("CORDCHAIN_API_URL", "http://127.0.0.1:5000").rstrip("/")
_api: aiohttp.ClientSession | None = None


class ApiError(Exception):
    def __init__(self, status: int, detail: Any, retry_at: str | None = None):
        self.status = status
        self.detail = detail if isinstance(detail, str) else str(detail or "API error")
        self.retry_at = retry_at
        super().__init__(f"[{status}] {self.detail}")


async def _session() -> aiohttp.ClientSession:
    global _api
    if _api is None or _api.closed:
        _api = aiohttp.ClientSession(
            base_url=BASE_URL,
            timeout=aiohttp.ClientTimeout(total=25),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
    return _api


async def request(method: str, path: str, *, params: dict | None = None, body: dict | None = None) -> Any:
    session = await _session()
    retry_at = None
    async with session.request(method, path, params=params, json=body) as resp:
        raw = await resp.text() or ""
        retry_at = resp.headers.get("Retry-At") or resp.headers.get("Retry-After")
        if 200 <= resp.status < 300:
            import json
            try:
                return json.loads(raw) if raw else {}
            except ValueError:
                return {}
        detail = raw
        try:
            import json
            parsed = json.loads(raw)
            detail = parsed.get("detail", parsed) if isinstance(parsed, dict) else parsed
        except ValueError:
            pass
        raise ApiError(resp.status, detail, retry_at)


def _gid(guild_id: str) -> str:
    return str(guild_id)


# ----------------- market data -----------------

async def guilds(search: str | None = None, tier: int | None = None, sort: str = "gain") -> list[dict]:
    params: dict[str, Any] = {"sort": sort}
    if search:
        params["search"] = search
    if tier is not None:
        params["tier"] = tier
    data = await request("GET", "/api/guilds", params=params)
    return (data or {}).get("guilds", data if isinstance(data, list) else [])


async def guild_detail(guild_id: str) -> dict:
    return await request("GET", f"/api/guilds/{_gid(guild_id)}")


async def orderbook(guild_id: str, depth: int = 8) -> dict:
    return await request("GET", f"/api/guilds/{_gid(guild_id)}/orderbook", params={"depth": depth})


async def candles(guild_id: str, interval: str = "1h", limit: int = 24) -> dict:
    return await request(
        "GET", f"/api/guilds/{_gid(guild_id)}/candles",
        params={"interval": interval, "limit": limit},
    )


async def trades_page(guild_id: str, limit: int = 10, before: str | None = None) -> dict:
    params: dict[str, Any] = {"limit": limit}
    if before:
        params["before"] = before
    return await request(
        "GET", f"/api/guilds/{_gid(guild_id)}/trades", params=params,
    )


# ----------------- trading -----------------

async def trade_quote(guild_id: str, action: str, shares: int) -> dict:
    return await request(
        "POST", "/api/trade/quote",
        body={"guildId": _gid(guild_id), "action": action, "shares": int(shares)},
    )


async def trade_buy(guild_id: str, user_id: str, shares: int) -> dict:
    return await request(
        "POST", "/api/trade/buy",
        body={"guildId": _gid(guild_id), "userId": str(user_id), "shares": int(shares)},
    )


async def trade_sell(guild_id: str, user_id: str, shares: int) -> dict:
    return await request(
        "POST", "/api/trade/sell",
        body={"guildId": _gid(guild_id), "userId": str(user_id), "shares": int(shares)},
    )


# ----------------- wallet -----------------

async def wallet_summary(user_id: str) -> dict:
    return await request("GET", "/api/wallet/summary", params={"userId": str(user_id)})


async def link_wallet(user_id: str, address: str) -> dict:
    return await request(
        "POST", "/api/blockchain/link-wallet",
        body={"userId": str(user_id), "walletAddress": address.strip()},
    )


# ----------------- growth: bump + attention -----------------

async def bump(guild_id: str, user_id: str) -> dict:
    return await request(
        "POST", f"/api/guilds/{_gid(guild_id)}/bump",
        body={"userId": str(user_id)},
    )


async def bump_status(guild_id: str, user_id: str) -> dict:
    return await request(
        "GET", f"/api/guilds/{_gid(guild_id)}/bump-status",
        params={"userId": str(user_id)},
    )


async def activity_ingest(guild_id: str, messages_last_hour: int, active_chatters: int) -> dict:
    return await request(
        "POST", f"/api/guilds/{_gid(guild_id)}/activity",
        body={
            "messagesLastHour": int(messages_last_hour),
            "activeChatters": int(active_chatters),
            "source": "bot",
        },
    )


async def checkin_initiate(guild_id: str, user_id: str) -> dict:
    return await request(
        "POST", "/api/checkin/initiate",
        body={"guildId": _gid(guild_id), "userId": str(user_id)},
    )


async def checkin_verify(
    guild_id: str, user_id: str, campaign_id: str, selected_option: str,
) -> dict:
    return await request(
        "POST", "/api/checkin/verify",
        body={
            "guildId": _gid(guild_id),
            "userId": str(user_id),
            "campaignId": campaign_id,
            "selectedOption": selected_option,
        },
    )


# ----------------- leaderboards / CordLedger / community -----------------

async def leaderboard_traders() -> dict:
    return await request("GET", "/api/leaderboard/traders")


async def leaderboard_servers() -> dict:
    return await request("GET", "/api/leaderboard/servers")


async def blockchain_status() -> dict:
    return await request("GET", "/api/blockchain/status")


async def claim_allowance(user_id: str) -> dict:
    return await request("POST", "/api/wallet/claim-allowance", body={"userId": str(user_id)})


async def ledger_status() -> dict:
    return await request("GET", "/api/ledger/status")


async def ledger_verify() -> dict:
    return await request("GET", "/api/ledger/verify")


async def ledger_blocks(limit: int = 20) -> dict:
    return await request("GET", "/api/ledger/blocks", params={"limit": limit})


async def guild_earnings_history(guild_id: str) -> dict:
    return await request("GET", f"/api/guilds/{_gid(guild_id)}/earnings-history")


async def rivalries() -> dict:
    return await request("GET", "/api/rivalries")


async def seasons() -> dict:
    return await request("GET", "/api/seasons")


async def quests(guild_id: str | None = None) -> dict:
    params = {"guildId": _gid(guild_id)} if guild_id else None
    return await request("GET", "/api/quests", params=params)


async def predictions(guild_id: str | None = None) -> dict:
    params = {"guildId": _gid(guild_id)} if guild_id else None
    return await request("GET", "/api/predictions", params=params)


async def vesting_status(guild_id: str) -> dict:
    return await request("GET", f"/api/guilds/{_gid(guild_id)}/vesting-status")

