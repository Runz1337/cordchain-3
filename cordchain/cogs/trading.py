"""Trading cog — buy / sell / quote with hybrid (slash + prefix) commands.

Every order is executed by the FastAPI constant-product AMM. The bot renders
serious transparent receipts (no colour embeds)
and follow-up buttons that mirror the web terminal (25/50/75/100% sizing).
"""

from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from cordchain.utils import api_client
from cordchain.utils.api_client import ApiError
from cordchain.utils.embeds import (
    emoji,
    cc_embed,
    error_embed,
    fmt_cred,
    fmt_price,
    fmt_pct,
    market_chip,
    success_embed,
)

from cordchain.utils.cog_helpers import resolve_ticker
from cordchain.utils.invocation import respond, reply_after, defer as inv_defer, open_modal as inv_open_modal, inv_id
from cordchain.utils import access


# ----------------- helpers -----------------

def receipt_embed(data: dict) -> discord.Embed:
    """Trade receipt — colourless, one source of truth: the API response."""
    action = str(data.get("action") or "").upper()
    ticker = data.get("ticker") or "?"
    glyph = emoji("buy") if action == "BUY" else emoji("sell") if action == "SELL" else emoji("ledger")
    title = f"{glyph} Filled • {action} {data.get('sharesBought') or data.get('sharesSold') or 0} × {ticker}"

    tx_id = data.get("transactionId")

    price_line = data.get("pricePerShare") or "0"
    if action == "BUY":
        qty_line = f"Total cost **{fmt_cred(data.get('totalCredSpent'))}** at **{fmt_price(price_line)}** / share"
        position = data.get("holding") or {}
        pos_line = (
            f"Position now **{int(position.get('shares') or 0):,} shares** "
            f"(avg entry **{fmt_price(position.get('avgBuyPrice'))}**)"
        )
        cred_line = f"New liquid balance **{fmt_cred(data.get('newCredBalance'))}**"
    else:
        qty_line = f"Net payout **{fmt_cred(data.get('totalCredReceived'))}** at **{fmt_price(price_line)}** / share"
        pos_line = f"Position now **{int(data.get('remainingShares') or 0):,} shares**"
        cred_line = f"New liquid balance **{fmt_cred(data.get('newCredBalance'))}**"

    embed = cc_embed(title)
    embed.add_field(name="Execution", value=qty_line, inline=False)
    embed.add_field(name="Position", value=pos_line, inline=False)
    ledger_hash = data.get("ledgerHash") or (data.get("blockchain") or {}).get("ledgerHash")
    embed.add_field(name="CordLedger Receipt", value=codeblock_receipt(ledger_hash, tx_id), inline=False)
    if ledger_hash:
        embed.set_footer(text=f"CordLedger Tamper-Evident Floor • {ledger_hash[:16]}...")
    elif tx_id:
        embed.set_footer(text=f"CordChain Executed Floor • TX #{tx_id}")
    return embed


def codeblock_receipt(ledger_hash: str | None, tx_id: str | None) -> str:
    lines = []
    if ledger_hash:
        lines.append(f"hash     : {ledger_hash[:20]}...{ledger_hash[-12:]}")
        lines.append(f"explorer : /scan/tx/{ledger_hash}")
        lines.append("status   : Cryptographically Chained (SHA-256)")
    elif tx_id:
        lines.append(f"ledger id : {tx_id}")
    else:
        lines.append("ledger id : (pending)")
    return "```\n" + "\n".join(lines) + "\n```"


def _parse_shares(raw: str) -> int | None:
    cleaned = (raw or "").strip().replace(",", "").lstrip("$")
    try:
        return int(float(cleaned)) if cleaned else None
    except ValueError:
        return None


class TradeModal(discord.ui.Modal, title="CordChain • Trade Ticket"):
    ticker = discord.ui.TextInput(
        label="Server ticker", placeholder="$CORDC", max_length=10,
    )
    shares = discord.ui.TextInput(
        label="Shares (full numbers only)", placeholder="500", max_length=12,
    )

    def __init__(self, action: str, preset_ticker: str | None = None):
        super().__init__()
        self.action = action
        if preset_ticker:
            self.ticker.default = preset_ticker

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer()
        if not await access.require(interaction):
            return
        shares = _parse_shares(self.shares.value)
        await execute_trade(interaction, self.action, str(self.ticker.value), shares)

    async def on_error(self, interaction: discord.Interaction, error: Exception):
        await interaction.followup.send(
            embed=error_embed("Modal failed", f"`{error}`"),
        )


class PercentTradeView(discord.ui.View):
    """Re-trade in 25/50/75/100% sizing — mirrors the web ticket."""

    def __init__(self, action: str, ticker: str, user_id: str, timeout: float = 180):
        super().__init__(timeout=timeout)
        self.action = action
        self.ticker = ticker
        self.user_id = user_id

    async def _percent_shares(self, pct: int) -> int:
        resolved = await resolve_ticker(self.ticker)
        if resolved is None:
            return 0
        guild = resolved["guild"]
        gid = guild["guildId"]
        price = float(guild.get("stockPrice") or 0)
        if price <= 0:
            return 0
        if self.action == "buy":
            wallet = await api_client.wallet_summary(self.user_id)
            bank = float(wallet["wallets"]["credBalance"])
            budget = bank * (pct / 100)
            return int(budget // price)
        wallet = await api_client.wallet_summary(self.user_id)
        held = next(
            (int(h["shares"]) for h in wallet.get("holdings", [])
             if h.get("ticker", "").upper() == self.ticker.upper()),
            0,
        )
        return int(held * pct // 100)

    @discord.ui.button(label="25%", style=discord.ButtonStyle.secondary)
    async def quarter(self, interaction: discord.Interaction, _):
        await self._fire(interaction, 25)

    @discord.ui.button(label="50%", style=discord.ButtonStyle.secondary)
    async def half(self, interaction: discord.Interaction, _):
        await self._fire(interaction, 50)

    @discord.ui.button(label="75%", style=discord.ButtonStyle.secondary)
    async def three_quarter(self, interaction: discord.Interaction, _):
        await self._fire(interaction, 75)

    @discord.ui.button(label="100%", style=discord.ButtonStyle.secondary)
    async def max(self, interaction: discord.Interaction, _):
        await self._fire(interaction, 100)

    async def _fire(self, interaction: discord.Interaction, pct: int):
        if not await access.require(interaction):
            return
        shares = await self._percent_shares(pct)
        if shares <= 0:
            return await interaction.response.send_message(
                embed=error_embed(
                    "Nothing to size against",
                    f"Your {pct}% budget in **{'$CRED' if self.action == 'buy' else self.ticker}** covers at least one round-trip share."
                ),
            )
        verb = "buying" if self.action == "buy" else "selling"
        await interaction.response.send_message(
            f"{emoji('timer')} Sizing {verb} **{shares:,} shares** ({pct}% of available)…",
        )
        await interaction.followup.send(
            embed=await run_trade_receipt(self.user_id, self.action, self.ticker, shares),
        )

    async def on_timeout(self):
        for item in self.children:
            item.disabled = True


async def execute_trade(
    inv: discord.Interaction,
    action: str,
    ticker: str,
    shares: int | None,
):
    """Shared path for /buy, /sell, modal submits, and % buttons."""
    if shares is None or shares <= 0:
        return await reply_after(
            inv,
            embed=error_embed("Bad size", "Shares must be a whole number greater than 0 (e.g. `500`)."),
        )
    resolved = await resolve_ticker(ticker)
    if resolved is None:
        return await reply_after(
            inv,
            embed=error_embed("Ticker not found", f"`{ticker.upper()}` is not listed on CordChain. Try `/servers`."),
        )
    gid = resolved["guild"]["guildId"]
    clean = resolved["guild"]["ticker"]
    uid = inv_id(inv)
    try:
        if action == "buy":
            data = await api_client.trade_buy(gid, uid, shares)
        else:
            data = await api_client.trade_sell(gid, uid, shares)
    except ApiError as exc:
        note = f"• Reason: **{exc.detail}**\n"
        if exc.retry_at:
            note += f"• Window reopens: `{exc.retry_at}`\n"
        note += "• Nothing was executed — your wallet is untouched."
        return await reply_after(
            inv,
            embed=error_embed("Order rejected", note),
        )
    embed = receipt_embed(data)
    await reply_after(
        inv,
        embed=embed,
        view=PercentTradeView(action, clean, uid),
    )


async def run_trade_receipt(user_id: str, action: str, ticker: str, shares: int) -> discord.Embed:
    """Terminal-friendly runner used by the % buttons (returns embed only)."""
    resolved = await resolve_ticker(ticker)
    if resolved is None:
        return error_embed("Ticker not found", f"`{ticker}` is no longer listed.")
    gid = resolved["guild"]["guildId"]
    try:
        if action == "buy":
            data = await api_client.trade_buy(gid, user_id, shares)
        else:
            data = await api_client.trade_sell(gid, user_id, shares)
    except ApiError as exc:
        note = f"• Reason: **{exc.detail}**\n"
        if exc.retry_at:
            note += f"• Window reopens: `{exc.retry_at}`\n"
        note += "• Nothing was executed — your wallet is untouched."
        return error_embed("Order rejected", note)
    return receipt_embed(data)


# ----------------- cog -----------------

class TradingCog(commands.Cog, name="Trading"):
    """Stock trading floor, instant quotes, and receipt cards."""

    def __init__(self, bot: commands.AutoShardedBot):
        self.bot = bot

    async def cog_load(self):
        pass

    @commands.hybrid_command(name="buy", description="Buy shares of a listed Discord server with fantasy $CRED")
    @app_commands.describe(ticker="Server stock ticker (opens the ticket modal if left blank)", shares="Whole number of shares to buy")
    async def buy(self, inv, ticker: str = "", shares: str = ""):
        if not await access.require(inv):
            return
        clean_ticker = (ticker or "").strip()
        parsed = _parse_shares(shares)
        if not clean_ticker or parsed is None:
            return await inv_open_modal(inv, TradeModal("buy", clean_ticker or None))
        await inv_defer(inv)
        await execute_trade(inv, "buy", clean_ticker, parsed)

    @commands.hybrid_command(name="sell", description="Sell shares of a listed Discord server back into the AMM")
    @app_commands.describe(ticker="Server stock ticker (opens the ticket modal if left blank)", shares="Whole number of shares to sell")
    async def sell(self, inv, ticker: str = "", shares: str = ""):
        if not await access.require(inv):
            return
        clean_ticker = (ticker or "").strip()
        parsed = _parse_shares(shares)
        if not clean_ticker or parsed is None:
            return await inv_open_modal(inv, TradeModal("sell", clean_ticker or None))
        await inv_defer(inv)
        await execute_trade(inv, "sell", clean_ticker, parsed)

    @commands.hybrid_command(name="quote", description="Instant AMM execution quote before you commit")
    @app_commands.describe(ticker="Server stock ticker", action="Trade side", shares="Whole number of shares")
    @app_commands.choices(action=[
        app_commands.Choice(name="BUY", value="BUY"),
        app_commands.Choice(name="SELL", value="SELL"),
    ])
    async def quote(self, inv, ticker: str, action: str = "BUY", shares: str = "100"):
        if not await access.require(inv):
            return
        resolved = await resolve_ticker(ticker)
        if resolved is None:
            return await respond(
                inv,
                embed=error_embed("Ticker not found", f"`{ticker}` is not listed on CordChain."),
            )
        guild = resolved["guild"]
        parsed = _parse_shares(shares) or 0
        if parsed <= 0:
            return await respond(
                inv,
                embed=error_embed("Bad size", "Shares must be a whole number greater than 0."),
            )
        try:
            q = await api_client.trade_quote(guild["guildId"], action.upper(), parsed)
        except ApiError as exc:
            return await respond(
                inv,
                embed=error_embed("Quote failed", f"• Reason: **{exc.detail}**"),
            )
        embed = cc_embed(f"{emoji('quote')} AMM Quote — estimated live cost")
        embed.add_field(name="Ticker", value=f"**{q['ticker']}** {market_chip(guild.get('marketState'))}", inline=True)
        embed.add_field(name="Action", value=action.upper(), inline=True)
        embed.add_field(name="Mark price", value=f"`{fmt_price(q.get('currentPrice'))}`", inline=True)
        embed.add_field(
            name=f"Execution treasury ({int(parsed):,} shares)",
            value=(
                f"Estimated spend / payout: **{fmt_cred(q.get('totalCred'))}**\n"
                f"Slippage vs mark: **{fmt_pct(q.get('estimatedSlippagePct') or 0)}**"
            ),
            inline=False,
        )
        embed.add_field(
            name="Next step",
            value=f"Run `{('!buy' if action.upper() == 'BUY' else '!sell')} {q['ticker']} {int(parsed)}` — "
                  "execution prices settle off your own ticket flow, not this quote.",
            inline=False,
        )
        await respond(inv, embed=embed)


async def setup(bot: commands.AutoShardedBot):
    cog = TradingCog(bot)
    await bot.add_cog(cog)

    async def ticker_ac(interaction: discord.Interaction, current: str):
        cleaned = (current or "").lstrip("$").upper()
        try:
            rows = await api_client.guilds(search=cleaned or None)
        except Exception:
            return []
        out = []
        for row in rows[:10]:
            ticker = str(row.get("ticker") or "")
            if cleaned and cleaned not in ticker.upper():
                continue
            out.append(app_commands.Choice(name=f"{ticker} — {row.get('name')}", value=ticker))
        return out

    for name in ("buy", "sell", "quote"):
        cmd = bot.get_command(name)
        if cmd is not None and hasattr(cmd, "autocomplete"):
            try:
                cmd.autocomplete("ticker")(ticker_ac)
            except Exception:
                pass
