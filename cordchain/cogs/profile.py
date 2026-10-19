"""Portfolio cog — wallet card, holdings ledger, and leaderboards (hybrid)."""

from __future__ import annotations

from datetime import datetime, timezone

import discord
from discord.ext import commands

from cordchain.utils import api_client
from cordchain.utils import access
from cordchain.utils.api_client import ApiError
from cordchain.utils.invocation import respond, reply_after, defer as inv_defer, inv_id
from cordchain.utils.embeds import (
    emoji,
    cc_embed,
    codeblock,
    error_embed,
    fmt_number,
    fmt_pct,
    fmt_price,
    LEAGUE_EMOJI,
    LEAGUE_NAMES,
)


def _table_ascending(rows: list[dict]) -> str:
    header = f"{'TICKER':<10}{'SHARES':>10}{' MARK':>12}{' VALUE':>12}{' ROI':>12}"
    lines = [header, "─" * 56]
    for h in rows[:12]:
        ticker = str(h.get("ticker") or "")[:9]
        shares = int(h.get("shares") or 0)
        mark = fmt_price(h.get("currentPrice"))
        value = fmt_number(h.get("totalValueCred"))
        entry = float(h.get("avgBuyPrice") or 0)
        mark_f = float(h.get("currentPrice") or 0)
        roi = ((mark_f - entry) / entry * 100) if entry > 0 else 0.0
        lines.append(
            f"{ticker:<10}{shares:>10,}{mark:>12}{value:>12}{fmt_pct(roi):>14}"
        )
    if len(rows) > 12:
        lines.append(f"… +{len(rows) - 12} more")
    return "\n".join(lines)


def wallet_card(data: dict) -> discord.Embed:
    wallets = data.get("wallets") or {}
    daily = data.get("dailyStatus") or {}
    cashout = data.get("cashout") or {}
    holdings = data.get("holdings") or []

    user = data.get("user") or {}
    boosts_used = int(daily.get("boostsUsedToday") or 0)
    max_boosts = int(daily.get("maxDailyBoosts") or 3)

    embed = cc_embed(f"{emoji('wallet')} Wallet Paper Trail — {user.get('username', 'trader')}")
    embed.add_field(name="Fantasy net worth", value=f"**{fmt_number(wallets.get('totalNetWorthCred'))} $CRED**", inline=True)
    embed.add_field(name="Liquid $CRED", value=f"**{fmt_number(wallets.get('credBalance'))}**", inline=True)
    embed.add_field(name="Stock value (held shares)", value=f"**{fmt_number(wallets.get('portfolioStockValueCred'))}**", inline=True)

    can_claim = daily.get("canClaimAllowance", False)
    allowance_status = "Available now (+50 $CRED)" if can_claim else "Claimed today (resets at midnight UTC)"
    embed.add_field(name="Daily allowance", value=f"**{allowance_status}**", inline=False)

    if holdings:
        embed.add_field(name="Holdings ledger", value=codeblock(_table_ascending(holdings)), inline=False)
    else:
        embed.add_field(
            name="Holdings ledger",
            value="Empty — `/buy $TICKER 25` to open your first position.",
            inline=False,
        )

    bar = "▰" * boosts_used + "▱" * max(0, max_boosts - boosts_used)
    embed.add_field(
        name="Community boost engine",
        value=f"`{bar}` {boosts_used} / {max_boosts} verified boosts used today",
        inline=False,
    )
    embed.set_footer(text="CordLedger • Tamper-evident fantasy economy with $CRED")
    return embed


def _leader_table(entries: list[dict], kind: str) -> str:
    medals = ["1.", "2.", "3."]
    lines = []
    if kind == "traders":
        header = f"{'#':<3}{'TRADER':<20}{'NET WORTH $CRED':>18}{'EQUITY':>9}"
        lines = [header, "─" * 50]
        for t in entries:
            medal = medals[t["rank"] - 1] if t.get("rank", 0) <= 3 else f"#{t['rank']:<2}{'':>2}"
            name = str(t.get("username") or "anon")[:19]
            nw = fmt_number(t.get("netWorthCred"))
            roi = str(t.get("roiPct") or 0) + "%"
            lines.append(f"{medal:<3}{name:<20}{nw:>18}{roi:>9}")
    else:
        header = f"{'#':<3}{'TICKER':<10}{'MKT CAP $CRED':>16}{'GAIN 24H':>11}"
        lines = [header, "─" * 42]
        for s in entries:
            medal = medals[s["rank"] - 1] if s.get("rank", 0) <= 3 else f"#{s['rank']:<2}{'':>2}"
            ticker = str(s.get("ticker") or "")
            cap = fmt_number(s.get("marketCapCred"))
            gain = fmt_pct(s.get("change24hPct") or 0)
            lines.append(f"{medal:<3}{ticker:<10}{cap:>16}{gain:>11}")
    return "\n".join(lines)


class LeaderboardView(discord.ui.View):
    def __init__(self, current: str, timeout: float = 90):
        super().__init__(timeout=timeout)
        self.current = current
        self._buttons = {"traders": None, "servers": None}
        idx = 0
        for child in self.children:
            if isinstance(child, discord.ui.Button):
                child.custom_id = f"lb:{(list(self._buttons))[idx]}"
                idx += 1

    @discord.ui.button(label="Trader rally", style=discord.ButtonStyle.secondary)
    async def traders(self, interaction: discord.Interaction, _):
        if self.current == "traders":
            return await interaction.response.defer()
        await _send_leaderboard(interaction, "traders")

    @discord.ui.button(label="Server spotlight", style=discord.ButtonStyle.secondary)
    async def servers(self, interaction: discord.Interaction, _):
        if self.current == "servers":
            return await interaction.response.defer()
        await _send_leaderboard(interaction, "servers")


async def _send_leaderboard(inv, kind: str):
    await inv_defer(inv)
    try:
        if kind == "traders":
            data = await api_client.leaderboard_traders()
            entries = data.get("traders") or []
            title = f"{emoji('trophy')} Trader Rally — top paper portfolios"
            sub = "Ranked by realised + unrealised net worth in $CRED."
        else:
            data = await api_client.leaderboard_servers()
            entries = data.get("servers") or []
            title = "🏟️ Server Spotlight — top democracy stock"
            sub = "Ranked by 24h market-cap gain (trust flows both ways)."
    except ApiError as exc:
        return await reply_after(
            inv,
            embed=error_embed("Leaderboard unavailable", f"• Reason: **{exc.detail}**"),
        )
    if not entries:
        return await reply_after(
            inv,
            embed=cc_embed(title, "No entries yet — `/buy` to open the tape."),
        )
    embed = cc_embed(title, sub)
    embed.add_field(name="Standings", value=codeblock(_leader_table(entries, kind)), inline=False)
    await reply_after(
        inv,
        embed=embed,
        view=LeaderboardView(kind),
    )


class PortfolioCog(commands.Cog, name="Portfolio"):
    """Wallets, holdings ledger, and seasonal leaderboards."""

    def __init__(self, bot: commands.AutoShardedBot):
        self.bot = bot

    @commands.hybrid_command(
        name="portfolio",
        aliases=["wallet", "bal"],
        description="Your portfolio snapshot: liquid $CRED, stock holdings, and daily allowance",
    )
    async def portfolio(self, inv):
        if not await access.require(inv):
            return
        await inv_defer(inv)
        try:
            data = await api_client.wallet_summary(inv_id(inv))
        except ApiError as exc:
            return await reply_after(
                inv,
                embed=error_embed("Wallet unavailable", f"• Reason: **{exc.detail}**"),
            )
        embed = wallet_card(data)
        await reply_after(inv, embed=embed)

    @commands.hybrid_group(
        name="leaderboard",
        aliases=["lb"],
        description="Seasonal standings on the exchange",
    )
    async def leaderboard(self, inv):
        await _send_leaderboard(inv, "traders")

    @leaderboard.command(name="traders", description="Trader rally — ranked paper net worths")
    async def leaderboard_traders(self, inv):
        if not await access.require(inv):
            return
        await _send_leaderboard(inv, "traders")

    @leaderboard.command(name="servers", description="Server spotlight — ranked 24h market-cap gainers")
    async def leaderboard_servers(self, inv):
        if not await access.require(inv):
            return
        await _send_leaderboard(inv, "servers")


async def setup(bot: commands.AutoShardedBot):
    await bot.add_cog(PortfolioCog(bot))
