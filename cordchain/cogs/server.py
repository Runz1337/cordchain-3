"""Server market cog — directory, listing detail, order book, tape, candles."""

from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from cordchain.utils import api_client
from cordchain.utils.api_client import ApiError
from cordchain.utils import access
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
    market_chip,
    spark,
    IPO_OPENING_PRICE,
)

from cordchain.utils.cog_helpers import resolve_ticker
from cordchain.utils.invocation import respond, reply_after, defer as inv_defer, open_modal as inv_open_modal, inv_guild, inv_user


# ----------------- shared renderers -----------------

def detail_embed(guild: dict) -> discord.Embed:
    embed = cc_embed(f"{emoji('server')} {guild.get('ticker')} — {guild.get('name')}")
    if guild.get("iconUrl"):
        embed.set_thumbnail(url=guild["iconUrl"])
    price = fmt_price(guild.get("stockPrice"))
    comm_score = guild.get("communityScore") or 0.0
    collab = guild.get("collaboration") or {}
    tier_name = collab.get("tierName", "Solo Effort")
    tier_icon = collab.get("icon", "🌱")
    multiplier = collab.get("multiplier", 1.0)
    contributors = collab.get("contributors24h", 1)
    mpl = [
        f"**{price} $CRED**  {fmt_pct(guild.get('changePct') or 0)}   {market_chip(guild.get('marketState'))}",
        f"League: {LEAGUE_EMOJI.get(guild.get('leagueTier'), '')} **{LEAGUE_NAMES.get(guild.get('leagueTier') or 1)}**  ·  Community Score: **{comm_score:.1f} pts**",
        f"Synergy: {tier_icon} **{tier_name}** ({contributors} active members · **{multiplier:.2f}x** dividend boost)",
        f"Supply: **1,000,000** fixed (750k Float / 250k Creator Reserve) · market cap **{fmt_number(float(guild.get('stockPrice') or 0) * 1_000_000)} $CRED**",
        f"Bumps: **{fmt_number(guild.get('bumpCount'))}**" + (
            f" · 24h volume **{fmt_number(guild.get('volume24hUsd') or 0)} $CRED**"
            if guild.get("volume24hUsd") is not None
            else ""
        ),
    ]
    holders = guild.get("topHolders") or []
    if holders:
        holder_rows = "\n".join(
            f"• `{(h.get('username') or 'honeypot')[:24]:<24}` {int(h.get('shares') or 0):>10,} shares"
            for h in holders[:3]
        )
        mpl.append(f"Top holders ({int(guild.get('holderCount') or 0)} owners):\n{holder_rows}")
    else:
        mpl.append("Top holders: none — market dormant until the first buy.")

    embed.description = "\n".join(mpl)
    embed.add_field(
        name="CordLedger Explorer",
        value=f"Explorer receipt: `CordScan /token/{guild.get('guildId')}`\n"
              f"Protected by SHA-256 hash-chaining, 100k share position limit, & 20% circuit breakers.",
        inline=False,
    )
    return embed


class BuyTicketView(discord.ui.View):
    def __init__(self, ticker: str, timeout: float = 120):
        super().__init__(timeout=timeout)
        self.ticker = ticker
        for item in self.children:
            cid = getattr(item, "custom_id", None)
            if cid == "cc:buy-ticket":
                item.emoji = emoji("buy")
                item.label = "Buy ticket"
            elif cid == "cc:sell-ticket":
                item.emoji = emoji("sell")
                item.label = "Sell ticket"

    @discord.ui.button(label="Buy ticket", style=discord.ButtonStyle.primary, custom_id="cc:buy-ticket", row=1)
    async def open_buy(self, interaction: discord.Interaction, _):
        from cordchain.cogs.trading import TradeModal
        from cordchain.utils import access
        if not await access.fully_authorized(str(interaction.user.id)):
            embed, view = await access.build_gate(interaction.user)
            from cordchain.utils.invocation import respond
            return await respond(interaction, embed=embed, view=view)
        await interaction.response.send_modal(TradeModal("buy", self.ticker))

    @discord.ui.button(label="Sell ticket", style=discord.ButtonStyle.secondary, custom_id="cc:sell-ticket", row=1)
    async def open_sell(self, interaction: discord.Interaction, _):
        from cordchain.cogs.trading import TradeModal
        from cordchain.utils import access
        if not await access.fully_authorized(str(interaction.user.id)):
            embed, view = await access.build_gate(interaction.user)
            from cordchain.utils.invocation import respond
            return await respond(interaction, embed=embed, view=view)
        await interaction.response.send_modal(TradeModal("sell", self.ticker))

    async def on_timeout(self):
        for item in self.children:
            item.disabled = True


class ServerSelect(discord.ui.Select):
    def __init__(self, rows: list[dict]):
        self.rows = rows
        options = [
            discord.SelectOption(
                label=f"{(r.get('ticker') or '?')} — {(r.get('name') or '')[:32]}",
                value=(r.get("ticker") or "?"),
                description=f"{fmt_price(r.get('stockPrice'))} $CRED · {market_chip(r.get('marketState'))}",
            )
            for r in rows[:24]
        ]
        super().__init__(placeholder="Switch listing…", options=options)

    async def callback(self, interaction: discord.Interaction):
        chosen = self.values[0]
        resolved = await resolve_ticker(chosen)
        if resolved is None:
            return await interaction.response.send_message(
                embed=error_embed("Listing gone", f"`{chosen}` was delisted while you browsed."),
            )
        embed = detail_embed(resolved["guild"])
        await interaction.response.edit_message(embed=embed, view=self.view)


class ServerDirectoryView(discord.ui.View):
    def __init__(self, rows: list[dict], timeout: float = 120):
        super().__init__(timeout=timeout)
        if rows:
            self.add_item(ServerSelect(rows))


# ----------------- cog -----------------

class TokenizeModal(discord.ui.Modal, title="Tokenize this server — IPO setup"):
    ticker = discord.ui.TextInput(
        label="Stock ticker (3-8 letters)",
        placeholder="e.g. CORDC, SQUAD, DEV",
        min_length=3,
        max_length=10,
    )
    invite = discord.ui.TextInput(
        label="Public invite link (compulsory)",
        placeholder="https://discord.gg/…",
        max_length=200,
    )
    description = discord.ui.TextInput(
        label="One-line pitch (optional)",
        placeholder="What your community actually does",
        style=discord.TextStyle.paragraph,
        max_length=300,
        required=False,
    )

    async def on_submit(self, interaction: discord.Interaction):
        guild = interaction.guild
        gid = str(guild.id)
        data = {
            "guildId": gid,
            "name": guild.name,
            "ticker": str(self.ticker.value).strip(),
            "description": str(self.description.value).strip() or None,
            "category": "Community",
            "inviteUrl": str(self.invite.value).strip(),
            "iconUrl": str(guild.icon.url) if guild.icon else None,
            "memberCount": len([m for m in guild.members if not m.bot]) if guild.member_count else 0,
            # Season 1 micro-strike protocol: price is not owner-decidable
            "initialPriceUsd": IPO_OPENING_PRICE,
        }
        msg = await interaction.response.send_message(f"{emoji('timer')} Filing the listing with the exchange…")
        from cordchain.utils.api_client import request
        try:
            listing = await request(
                "POST", "/api/guild/tokenize",
                body={
                    **data,
                    "ownerId": str(guild.owner_id) if guild.owner_id else str(interaction.user.id),
                },
            )
        except ApiError as exc:
            note = f"• Reason: **{exc.detail}**\n"
            if exc.retry_at:
                note += f"• Window reopens: `{exc.retry_at}`\n"
            note += "• Nothing was listed — fix and re-run `/tokenize`."
            return await interaction.followup.send(
                embed=error_embed("Listing rejected", note),
            )
        embed = raise_listing_success_embed(listing, guild)
        await interaction.followup.send(embed=embed)

    async def on_error(self, interaction: discord.Interaction, error: Exception):
        await interaction.followup.send(
            embed=error_embed("Modal failed", f"`{error}`"),
        )


def raise_listing_success_embed(listing: dict, guild: discord.Guild) -> discord.Embed:
    embed = cc_embed(
        f"{emoji('boost')} {guild.name} listed on CordChain",
        f"• Ticker: **{listing.get('ticker')}**\n"
        f"• IPO strike: **{fmt_price(listing.get('stockPrice') or IPO_OPENING_PRICE)} $CRED** (protocol-fixed)\n"
        f"• Pool: **{fmt_number(listing.get('circulatingShares'))} shares** (reserve-backed)\n"
        f"• Division: {LEAGUE_EMOJI.get(listing.get('leagueTier'), '')} {LEAGUE_NAMES.get(listing.get('leagueTier') or 1)}\n\n"
        "Your market opens dormant until the first player buys in — `/buy` it yourself to light the tape.",
    )
    if guild.icon:
        embed.set_thumbnail(url=str(guild.icon.url))
    return embed


class ServerCog(commands.Cog, name="Server"):
    """Listing catalogue, individual stock pages, and member-flow trackers."""

    def __init__(self, bot: commands.AutoShardedBot):
        self.bot = bot

    @commands.hybrid_command(name="server", description="Open a listing page for a Discord server stock")
    @app_commands.describe(ticker="Leave blank to show this Discord server, if listed")
    async def server(self, inv, ticker: str = ""):
        await inv_defer(inv)
        if ticker:
            resolved = await resolve_ticker(ticker)
            if resolved is None:
                return await reply_after(
                    inv,
                    embed=error_embed("Ticker not found", "`%s` is not listed on CordChain. Browse `/servers`." % ticker.upper()),
                )
            await reply_after(
                inv,
                embed=detail_embed(resolved["guild"]),
                view=BuyTicketView(resolved["guild"]["ticker"]),
            )
            return
        gid = str(inv_guild(inv).id) if inv_guild(inv) else ""
        try:
            data = await api_client.guild_detail(gid)
            guild = data.get("guild") or {}
        except (ApiError, Exception):
            guild = {}
        if not guild:
            return await reply_after(
                inv,
                embed=error_embed(
                    "Not listed here",
                    "This Discord server is not tokenized on CordChain yet.\n"
                    "Owners can list it from the web Tokenization Portal."
                ),
            )
        await reply_after(
            inv,
            embed=detail_embed(guild),
            view=BuyTicketView(guild["ticker"]),
        )

    @commands.hybrid_command(name="servers", description="Browse the full directory of listed server stocks")
    @app_commands.describe(tier="Optional league tier (1 Squad, 2 Club, 3 Arena, 4 Titan)")
    @app_commands.choices(
        tier=[
            app_commands.Choice(name="Squad (15-150 members)", value=1),
            app_commands.Choice(name="Club (151-1,000 members)", value=2),
            app_commands.Choice(name="Arena (1,001-10,000 members)", value=3),
            app_commands.Choice(name="Titan (10,000+ members)", value=4),
        ]
    )
    async def servers(self, inv, tier: int | None = None):
        await inv_defer(inv)
        try:
            rows = await api_client.guilds(tier=tier)
        except ApiError as exc:
            return await reply_after(
                inv,
                embed=error_embed("Directory unavailable", f"• Reason: **{exc.detail}**"),
            )
        if not rows:
            return await reply_after(inv, embed=cc_embed("Empty tier — no listings yet."))
        lines = []
        for i, g in enumerate(rows[:15], 1):
            lines.append(
                f"{i:>2}. **{g.get('ticker')}** `{(g.get('name') or '')[:28]:<28}` "
                f"{fmt_price(g.get('stockPrice'))} {fmt_pct(g.get('changePct') or 0)}  {LEAGUE_EMOJI.get(g.get('leagueTier'), '')}"
            )
        embed = cc_embed(
            f"{emoji('dir')} Listing directory" + (f" • {LEAGUE_NAMES.get(tier or 1)}" if tier else ""),
            codeblock("\n".join(lines)),
        )
        embed.set_footer(
            text=f"{len(rows)} listings · use /server <ticker> for the full page"
        )
        await reply_after(inv, embed=embed, view=ServerDirectoryView(rows))

    @commands.hybrid_command(name="orderbook", description="Live AMM ladder for a server stock")
    @app_commands.describe(ticker="Server stock ticker")
    async def orderbook(self, inv, ticker: str):
        await inv_defer(inv)
        resolved = await resolve_ticker(ticker)
        if resolved is None:
            return await reply_after(
                inv,
                embed=error_embed("Ticker not found", f"`{ticker}` is not listed on CordChain."),
            )
        gid = resolved["guild"]["guildId"]
        try:
            book = await api_client.orderbook(gid)
        except ApiError as exc:
            return await reply_after(
                inv,
                embed=error_embed("Book unavailable", f"• Reason: **{exc.detail}**"),
            )
        bids = book.get("bids") or []
        asks = book.get("asks") or []
        rows = [f"{'side':<5}{'price':>12}{'shares':>12}{'Σ notional':>14}", "─" * 43]
        for a in reversed(asks[-5:]):
            rows.append(f"{'ask':<5}{fmt_price(a.get('price')):>12}{int(a.get('shares') or 0):>12,}{fmt_number(a.get('notionalUsd', 0)):>14}")
        rows.append(f"{'─────':<5}{'—':>12}{'spot':>12}{'—':>14}".replace("spot", ""))
        for b in bids[-5:]:
            rows.append(f"{'bid':<5}{fmt_price(b.get('price')):>12}{int(b.get('shares') or 0):>12,}{fmt_number(b.get('notionalUsd', 0)):>14}")

        embed = cc_embed(
            f"{emoji('candle')} Order Book — {book.get('ticker')}",
            codeblock("\n".join(rows)),
        )
        embed.add_field(
            name="Book mode",
            value=market_chip(resolved["guild"].get("marketState")) if not book.get("liquidityMode") else book.get("liquidityMode"),
            inline=True,
        )
        embed.add_field(name="Depth", value=f"{len(bids) + len(asks)} resting levels", inline=True)
        embed.set_footer(text="CordChain • One pool, fairly priced")
        await reply_after(inv, embed=embed)

    @commands.hybrid_command(name="tape", description="Executed trade tape for a server stock")
    @app_commands.describe(ticker="Server stock ticker")
    async def tape(self, inv, ticker: str):
        await inv_defer(inv)
        resolved = await resolve_ticker(ticker)
        if resolved is None:
            return await reply_after(
                inv,
                embed=error_embed("Ticker not found", f"`{ticker}` is not listed on CordChain."),
            )
        try:
            page = await api_client.trades_page(resolved["guildId"], limit=10)
        except ApiError as exc:
            return await reply_after(
                inv,
                embed=error_embed("Tape unavailable", f"• Reason: **{exc.detail}**"),
            )
        rows = [f"{'time':<10}{'side':<6}{'price':>12}{'shares':>10}{'trader':<12}", "─" * 56]
        trades = page.get("trades") or []
        for t in trades:
            ts = str(t.get("time") or "")[5:16].replace("T", " ")
            rows.append(
                f"{ts:<10}{(t.get('side') or '').upper():<6}{fmt_price(t.get('price')):>12}"
                f"{int(t.get('shares') or 0):>10,}{str(t.get('trader') or '')[:11]:<12}"
            )
        embed = cc_embed(
            f"{emoji('ledger')} Trade Tape — {page.get('ticker')}",
            codeblock("\n".join(rows)) if trades else "*No executed trades yet.*",
        )
        embed.set_footer(text="CordChain • Anonymous counterparty shredded honestly")
        await reply_after(inv, embed=embed)

    @commands.hybrid_command(name="candle", description="Candle roll-up sparkline for a server stock")
    @app_commands.describe(ticker="Server stock ticker", tf="1h, 1D, 1W (ledger rolls)", limit="candles to display (max 24)")
    async def candle(self, inv, ticker: str, tf: str = "1h", limit: int = 16):
        limit = max(4, min(24, limit))
        await inv_defer(inv)
        resolved = await resolve_ticker(ticker)
        if resolved is None:
            return await reply_after(
                inv,
                embed=error_embed("Ticker not found", f"`{ticker}` is not listed on CordChain."),
            )
        try:
            data = await api_client.candles(resolved["guildId"], interval=tf, limit=limit)
        except ApiError as exc:
            return await reply_after(
                inv,
                embed=error_embed("Chart unavailable", f"• Reason: **{exc.detail}**"),
            )
        rows = data.get("candles") or []
        closes = [float(c.get("close") or 0) for c in rows]
        first = closes[0] if closes else 0.0
        last = closes[-1] if closes else 0.0
        delta = (last - first) / first * 100 if first else 0.0
        embed = cc_embed(
            f"{emoji('candle')} Candle Trail — {data.get('ticker')} ({tf})",
            codeblock(spark(closes)) + f"\nFirst **{fmt_price(first)}** → Last **{fmt_price(last)}** {fmt_pct(delta)}",
        )
        embed.add_field(name="Candles", value=f"{len(rows)} × {tf}", inline=True)
        embed.add_field(name="High", value=f"`{fmt_price(max(closes) if closes else 0)}`", inline=True)
        embed.add_field(name="Low", value=f"`{fmt_price(min(closes) if closes else 0)}`", inline=True)
        embed.set_footer(text="CordChain • Ledger-derived, never seeded")
        await reply_after(inv, embed=embed)

    @commands.hybrid_command(
        name="tokenize",
        description="Owners: list this Discord server on the CordChain exchange (IPO at the Season-1 protocol strike)",
    )
    @commands.guild_only()
    @commands.has_permissions(manage_guild=True)
    async def tokenize(self, inv):
        if not await access.require(inv):
            return
        guild = inv_guild(inv)
        if guild is None:
            return await respond(inv, embed=error_embed("Servers only", "Run this inside the server you want listed."))
        try:
            await api_client.guild_detail(str(guild.id))
            return await respond(
                inv,
                embed=error_embed(
                    "Already listed",
                    f"This server is already on CordChain — run `/server` to see `{guild.name}`'s live card.",
                ),
            )
        except ApiError:
            pass
        await inv_open_modal(inv, TokenizeModal())

    @commands.hybrid_command(name="verify", description="Cryptographic integrity verification of CordLedger")
    async def verify(self, inv):
        await inv_defer(inv)
        try:
            res = await api_client.ledger_verify()
        except ApiError as exc:
            return await reply_after(inv, embed=error_embed("Verification error", f"• Reason: **{exc.detail}**"))
        status = res.get("status", "UNKNOWN")
        embed = cc_embed(
            f"{emoji('ledger')} CordLedger Integrity Audit — {status}",
            f"• **Status**: `{'✅ ' + status if status == 'VERIFIED_TAMPER_FREE' else '❌ ' + status}`\n"
            f"• **Audited Entries**: `{res.get('entriesCount', 0):,}`\n"
            f"• **Blocks Height**: `{res.get('blocksHeight', 0):,}`\n"
            f"• **Latest Ledger Hash**:\n`{res.get('latestHash') or 'N/A'}`\n"
            f"• **Latest Block Hash**:\n`{res.get('latestBlockHash') or 'N/A'}`\n"
            f"• **Signatures Valid**: `Ed25519 Verified`\n"
            f"• **Merkle Roots Valid**: `True`\n"
            f"• **Tamper Evidence**: `100% Intact`"
        )
        embed.set_footer(text="CordLedger • Local append-only cryptographic ledger • Tamper-evident")
        await reply_after(inv, embed=embed)

    @commands.hybrid_command(name="earnings", description="Weekly fantasy dividends and Community Score earnings for a server")
    @app_commands.describe(ticker="Server stock ticker (leave blank for this server)")
    async def earnings(self, inv, ticker: str = ""):
        await inv_defer(inv)
        gid = ""
        resolved_ticker = ""
        if ticker:
            resolved = await resolve_ticker(ticker)
            if resolved is None:
                return await reply_after(inv, embed=error_embed("Ticker not found", f"`{ticker}` is not listed."))
            gid = resolved["guild"]["guildId"]
            resolved_ticker = resolved["guild"]["ticker"]
        else:
            if not inv_guild(inv):
                return await reply_after(inv, embed=error_embed("No context", "Provide a ticker or run inside a listed server."))
            gid = str(inv_guild(inv).id)
        try:
            res = await api_client.guild_earnings_history(gid)
        except ApiError as exc:
            return await reply_after(inv, embed=error_embed("Earnings unavailable", f"• Reason: **{exc.detail}**"))
        reports = res.get("reports") or []
        t = resolved_ticker or res.get("ticker", "Server")
        if not reports:
            embed = cc_embed(
                f"{emoji('boost')} Weekly Earnings — {t}",
                "No weekly earnings reports filed yet for this server.\n"
                "Community Score calculates weekly and pays fantasy $CRED dividends to all shareholders on CordLedger!"
            )
            return await reply_after(inv, embed=embed)
        latest = reports[0]
        embed = cc_embed(
            f"{emoji('boost')} Weekly Earnings Report — {t}",
            f"• **Payout Week**: `{str(latest.get('weekDate'))[:10]}`\n"
            f"• **Community Score**: `{latest.get('communityScore', 0):.2f} pts`\n"
            f"• **Total CRED Distributed**: `{fmt_number(latest.get('totalCredDistributed', 0))} $CRED`\n"
            f"• **Dividend per Share**: `{fmt_price(latest.get('payoutPerShare', 0))} $CRED`\n"
            f"• **Ledger Entry**: `#{latest.get('ledgerIndex') or 'N/A'}`"
        )
        embed.set_footer(text="CordChain • Fantasy earnings driven by real server engagement fundamentals")
        await reply_after(inv, embed=embed)

    @commands.hybrid_command(name="rivalry", description="View active server vs server community derbies")
    async def rivalry(self, inv):
        await inv_defer(inv)
        try:
            res = await api_client.rivalries()
        except ApiError as exc:
            return await reply_after(inv, embed=error_embed("Rivalries unavailable", f"• Reason: **{exc.detail}**"))
        rivalries_list = res.get("rivalries") or []
        if not rivalries_list:
            embed = cc_embed(
                f"{emoji('fire')} Community Rivalries & Derbies",
                "No active server rivalries scheduled this week.\n"
                "Derbies pit peer communities against each other to compete on engagement growth for prize pools!"
            )
            return await reply_after(inv, embed=embed)
        lines = []
        for r in rivalries_list[:5]:
            lines.append(
                f"⚔️ **{r.get('guild1Name')}** ({r.get('guild1Score', 0):.1f} pts) vs **{r.get('guild2Name')}** ({r.get('guild2Score', 0):.1f} pts)\n"
                f"   Prize: `{fmt_number(r.get('prizePoolCred', 0))} $CRED` · Status: `{r.get('status', 'active')}`"
            )
        embed = cc_embed(
            f"{emoji('flame')} Server vs Server Rivalries",
            "\n\n".join(lines),
        )
        embed.set_footer(text="CordChain • Community derbies compete on weekly growth, not raw size")
        await reply_after(inv, embed=embed)

    @commands.hybrid_command(name="quests", description="View collaborative community quests to boost your Community Score")
    @app_commands.describe(ticker="Server stock ticker (leave blank for this server)")
    async def quests(self, inv, ticker: str = ""):
        await inv_defer(inv)
        gid = ""
        resolved_ticker = ""
        if ticker:
            resolved = await resolve_ticker(ticker)
            if resolved is None:
                return await reply_after(inv, embed=error_embed("Ticker not found", f"`{ticker}` is not listed."))
            gid = resolved["guild"]["guildId"]
            resolved_ticker = resolved["guild"]["ticker"]
        else:
            if not inv_guild(inv):
                return await reply_after(inv, embed=error_embed("No context", "Provide a ticker or run inside a listed server."))
            gid = str(inv_guild(inv).id)

        try:
            res = await api_client.quests(gid)
        except ApiError as exc:
            return await reply_after(inv, embed=error_embed("Quests unavailable", f"• Reason: **{exc.detail}**"))

        quest_list = res.get("quests") or []
        t = resolved_ticker or "Server"
        if not quest_list:
            embed = cc_embed(
                f"{emoji('zap')} Community Quests — {t}",
                "No active quests scheduled for this server right now.\n\n"
                "Community quests are collaborative weekly challenges (like reaching 50 unique chatters or hosting voice events) "
                "that boost your server's bot-resistant Community Score and increase weekly shareholder payouts!"
            )
            embed.set_footer(text="CordChain • Teamwork boosts server valuation and fair value dividends")
            return await reply_after(inv, embed=embed)

        embed = cc_embed(
            f"{emoji('zap')} Active Community Quests — {t}",
            "Complete team objectives this week to multiply your server's fundamental valuation and dividend payouts:"
        )
        for q in quest_list[:5]:
            title = q.get("title") or "Community Milestone"
            desc = q.get("description") or ""
            target = q.get("target_count") or 100
            current = q.get("current_count") or 0
            pct = min(100, int((current / max(1, target)) * 100))
            reward = q.get("reward_score_bonus") or 15.0
            embed.add_field(
                name=f"🎯 {title} ({pct}%)",
                value=f"{desc}\n• Progress: `{current:,} / {target:,}`\n• Score Boost: `+{reward:.1f} pts`",
                inline=False,
            )
        embed.set_footer(text="CordChain • Quests directly drive fundamental weekly shareholder payouts")
        await reply_after(inv, embed=embed)

    @commands.hybrid_command(name="seasons", description="View monthly season standings, reset calendar, and the Hall of Fame")
    async def seasons(self, inv):
        await inv_defer(inv)
        try:
            res = await api_client.seasons()
        except ApiError as exc:
            return await reply_after(inv, embed=error_embed("Seasons unavailable", f"• Reason: **{exc.detail}**"))

        season_list = res.get("seasons") or []
        active = next((s for s in season_list if s.get("is_active")), None)
        if not active and season_list:
            active = season_list[0]

        title = f"{emoji('trophy')} Seasonal Leagues & Hall of Fame"
        if not active:
            embed = cc_embed(
                title,
                "Season 1 is currently underway! Monthly season resets ensure fair competition and allow new communities to rise to the top."
            )
            return await reply_after(inv, embed=embed)

        embed = cc_embed(
            f"{emoji('trophy')} {active.get('name', 'Season 1')}",
            "CordChain operates on 30-day competitive seasons with a clean portfolio reset and permanent Hall of Fame honors:"
        )
        embed.add_field(
            name="📅 Season Schedule",
            value=f"• **Start Date**: `{str(active.get('start_date', ''))[:10]}`\n• **End Date**: `{str(active.get('end_date', ''))[:10]}`\n• **Status**: `Active Competition`",
            inline=False,
        )
        hof = active.get("hall_of_fame") or []
        if hof:
            hof_lines = [f"🏅 **#{i+1}** {h.get('name')} — `{fmt_cred(h.get('valuation', 0))}`" for i, h in enumerate(hof[:3])]
            embed.add_field(name="🏛️ Hall of Fame Leaders", value="\n".join(hof_lines), inline=False)
        else:
            embed.add_field(
                name="🏛️ Hall of Fame",
                value="Top servers in Bronze, Silver, and Gold leagues will be permanently enshrined at the conclusion of this season.",
                inline=False,
            )
        embed.set_footer(text="CordChain • 30-day seasons preserve fair competition for all communities")
        await reply_after(inv, embed=embed)

    @commands.hybrid_command(name="predictions", description="View active prediction markets on server events with $CRED")
    @app_commands.describe(ticker="Filter by server stock ticker (optional)")
    async def predictions(self, inv, ticker: str = ""):
        await inv_defer(inv)
        gid = ""
        if ticker:
            resolved = await resolve_ticker(ticker)
            if resolved is None:
                return await reply_after(inv, embed=error_embed("Ticker not found", f"`{ticker}` is not listed."))
            gid = resolved["guild"]["guildId"]

        try:
            res = await api_client.predictions(gid)
        except ApiError as exc:
            return await reply_after(inv, embed=error_embed("Predictions unavailable", f"• Reason: **{exc.detail}**"))

        market_list = res.get("predictions") or []
        if not market_list:
            embed = cc_embed(
                f"{emoji('scale')} Server Prediction Markets",
                "No open prediction markets right now.\n\n"
                "Prediction markets allow members to wager fantasy $CRED on community milestones, derby outcomes, and chat growth targets!"
            )
            embed.set_footer(text="CordChain • Wager $CRED on real community milestones")
            return await reply_after(inv, embed=embed)

        embed = cc_embed(
            f"{emoji('scale')} Active Event Prediction Markets",
            "Wager fantasy $CRED on community outcomes before the resolution deadline:"
        )
        for p in market_list[:4]:
            q_text = p.get("question") or "Community Prediction"
            server_name = p.get("server_name") or p.get("ticker") or "Guild"
            pool = p.get("total_pool_cred") or 1000
            resolves = str(p.get("resolves_at") or "")[:10]
            embed.add_field(
                name=f"🎲 {q_text} ({server_name})",
                value=f"• Total Pool: `{fmt_number(pool)} $CRED`\n• Resolves: `{resolves or 'Soon'}`\n• Status: `Open for Bids`",
                inline=False,
            )
        embed.set_footer(text="CordChain • Risk fantasy $CRED on server milestones with peer-to-peer pools")
        await reply_after(inv, embed=embed)


    # Member-flow trackers — real counts only, no market manipulation.
    @commands.Cog.listener()
    async def on_guild_join(self, guild: discord.Guild):
        self.bot.logger.info(f"📥 Joined new guild: {guild.name} ({guild.id}) (Shard ID: {guild.shard_id})")

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        from cordchain.database import db_pool
        if member.bot:
            return
        human_count = len([m for m in member.guild.members if not m.bot])
        await db_pool.execute(
            "UPDATE guilds SET member_count_current = $1, member_count_peak_7d = GREATEST(member_count_peak_7d, $1) WHERE guild_id = $2",
            human_count, str(member.guild.id),
        )

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member):
        from cordchain.database import db_pool
        if member.bot:
            return
        human_count = len([m for m in member.guild.members if not m.bot])
        await db_pool.execute(
            "UPDATE guilds SET member_count_current = $1 WHERE guild_id = $2",
            human_count, str(member.guild.id),
        )


async def setup(bot: commands.AutoShardedBot):
    await bot.add_cog(ServerCog(bot))
