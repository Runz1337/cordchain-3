"""Boost & attention cog — daily check-in verification (buttons) and /bump.

Reward math, cooldowns, anti-macros, and the pool-consistent +0.8% price tick
all live in the FastAPI (`/api/checkin/*`, `/api/guilds/{id}/bump`). The bot is
a presentational shell on top: it arms the quiz through buttons, submits the
chosen option, and renders serious transparent receipts.
"""

from __future__ import annotations

import discord
from discord.ext import commands

from cordchain.utils import api_client
from cordchain.utils.api_client import ApiError
from cordchain.utils import access
from cordchain.utils.embeds import (
    emoji,
    cc_embed,
    error_embed,
    fmt_number,
    fmt_price,
    fmt_pct,
)

from cordchain.utils.cog_helpers import resolve_ticker
from cordchain.utils.invocation import respond, reply_after, defer as inv_defer


# ----------------- attention-quiz view -----------------

class AttentionOptionButton(discord.ui.Button):
    def __init__(self, label: str, idx: int):
        super().__init__(label=str(label)[:80], style=discord.ButtonStyle.secondary)
        self.idx = idx

    async def callback(self, interaction: discord.Interaction):
        view: AttentionQuizView = self.view
        chosen = self.label
        for child in view.children:
            child.disabled = True
        await interaction.response.edit_message(view=view)
        try:
            data = await api_client.checkin_verify(
                view.guild_id, view.user_id, view.campaign_id, chosen,
            )
        except ApiError as exc:
            return await interaction.followup.send(
                embed=error_embed("Verification failed", f"• Reason: **{exc.detail}**"),
            )
        await interaction.followup.send(
            embed=verify_result_embed(data),
        )


class AttentionQuizView(discord.ui.View):
    def __init__(self, campaign_id: str, guild_id: str, user_id: str, options: list[str], timeout: float = 180):
        super().__init__(timeout=timeout)
        self.campaign_id = campaign_id
        self.guild_id = guild_id
        self.user_id = user_id
        for idx, opt in enumerate((options or [])[:4]):
            self.add_item(AttentionOptionButton(opt, idx))

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if str(interaction.user.id) != self.user_id:
            embed = error_embed("Not your card", "Run `/boost` in this server to claim your own reward.")
            await interaction.response.send_message(embed=embed)
            return False
        return True

    async def on_timeout(self):
        for item in self.children:
            item.disabled = True


def verify_result_embed(data: dict) -> discord.Embed:
    if not data.get("verified"):
        return error_embed("Attention check failed", f"• {data.get('message')}")
    lines = [
        f"• **+{int(data.get('credAwarded') or 250):,} $CRED** added to liquid balance (**{fmt_number(data.get('newCredBalance'))} $CRED** total)",
        "• Server price momentum: **+0.8%** verified boost applied to AMM liquidity pool",
        f"• Daily boosts used: **{data.get('dailyBoostCount', 1)} / 3** ({int(data.get('boostsRemainingToday') or 0)} remaining today)",
    ]
    ledger_hash = data.get("ledgerHash")
    if ledger_hash:
        lines.append(f"• CordLedger Hash: `{ledger_hash[:16]}...`")
    embed = cc_embed(f"{emoji('check')} Daily Check-In Verified", "\n".join(lines))
    embed.set_footer(text="CordLedger • Verified community boost recorded to append-only ledger")
    return embed


# ----------------- cog -----------------

class BoostCog(commands.Cog, name="Boost"):
    """Daily attention checks and /bump stock momentum."""

    def __init__(self, bot: commands.AutoShardedBot):
        self.bot = bot

    @commands.hybrid_command(
        name="boost",
        aliases=["checkin"],
        description="Start the daily attention check to boost this server's stock (+250 $CRED)",
    )
    @commands.guild_only()
    async def boost(self, inv):
        if not await access.require(inv):
            return
        gid = str(inv.guild.id)
        uid = str(inv.user.id)
        await inv_defer(inv)
        try:
            data = await api_client.checkin_initiate(gid, uid)
        except ApiError as exc:
            retry = f"\n• Window reopens: `{exc.retry_at}`" if exc.retry_at else ""
            return await reply_after(
                inv,
                embed=error_embed("Daily check-in unavailable", f"• Reason: **{exc.detail}**{retry}"),
            )

        campaign = data.get("campaign") or {}
        view = AttentionQuizView(
            campaign_id=str(campaign.get("campaignId") or ""),
            guild_id=gid,
            user_id=uid,
            options=[str(o) for o in (campaign.get("options") or [])][:4],
        )

        embed = cc_embed(
            f"{emoji('zap')} Attention Check — {campaign.get('sponsorName')}",
            f"**{campaign.get('title')}**\n{campaign.get('description')}",
        )
        g = getattr(inv, "guild", None)
        icon = getattr(g, "icon", None) if g else None
        if icon:
            embed.set_thumbnail(url=str(icon.url))
        embed.add_field(name="Reward", value="**+250 $CRED** (+0.8% server price momentum)", inline=True)
        embed.add_field(name="Anti-macro timer", value=f"Minimum {data.get('minWatchSeconds', 10)}s dwell enforced server-side", inline=True)
        embed.set_footer(text=f"CordChain • {data.get('currentDailyBoosts', 0)} / 3 daily boosts claimed today")
        await reply_after(inv, embed=embed, view=view)

    @commands.hybrid_command(
        name="bump",
        description="Bump this server's stock price (+0.4% momentum) — hold shares first",
    )
    @commands.guild_only()
    async def bump(self, inv):
        if not await access.require(inv):
            return
        gid = str(inv.guild.id)
        uid = str(inv.user.id)
        await inv_defer(inv)
        try:
            status = await api_client.bump_status(gid, uid)
            if not status.get("canBump"):
                return await reply_after(
                    inv,
                    embed=error_embed(
                        "Not eligible",
                        f"• Reason: hold **{status.get('ticker')}** shares (shareholders and owners only)\n"
                        f"• Try: `/buy {status.get('ticker')} 5` then bump.",
                    ),
                )
            if not status.get("eligible") and status.get("nextBumpAvailableAt"):
                return await reply_after(
                    inv,
                    embed=error_embed(
                        "Bump cooling down",
                        f"• Your bump window reopens: `{status.get('nextBumpAvailableAt')}`\n"
                        f"• Cooldown is 6h per user per server.",
                    ),
                )
            data = await api_client.bump(gid, uid)
        except ApiError as exc:
            retry = f"\n• Window reopens: `{exc.retry_at}`" if exc.retry_at else ""
            return await reply_after(
                inv,
                embed=error_embed("Bump rejected", f"• Reason: **{exc.detail}**{retry}"),
            )
        embed = cc_embed(
            f"{emoji('boost')} {data.get('ticker')} bumped",
            f"• Stock mark: **{fmt_price(data.get('newStockPrice'))} {fmt_pct(data.get('priceGainPct') or 0)}**\n"
            f"• Total bumps on record: **{int(data.get('bumpCount') or 0):,}**\n"
            f"• Cooldown from here: **{int(data.get('cooldownMinutes') or 360)} minutes** (yours alone)\n"
            f"• Next bump window: `{data.get('nextBumpAvailableAt')}`",
        )
        embed.set_footer(text="CordChain • One bump per shareholder per 6h")
        await reply_after(inv, embed=embed)

    @commands.hybrid_command(
        name="bumpstatus",
        description="Check your bump eligibility on this server",
    )
    @commands.guild_only()
    async def bump_status(self, inv):
        if not await access.require(inv):
            return
        gid = str(inv.guild.id)
        uid = str(inv.user.id)
        await inv_defer(inv)
        try:
            status = await api_client.bump_status(gid, uid)
        except ApiError as exc:
            return await reply_after(
                inv,
                embed=error_embed("Bump status unavailable", f"• Reason: **{exc.detail}**"),
            )
        embed = cc_embed(
            f"🧭 Bump status — {status.get('ticker')}",
            f"• Eligible now: **{'yes' if status.get('eligible') else 'no'}**\n"
            f"• Holds shares: **{status.get('holdsShares')}** ({int(status.get('sharesHeld') or 0):,} shares)\n"
            f"• Server owner: **{status.get('isOwner') or 'no'}**\n"
            f"• Next window: `{status.get('nextBumpAvailableAt')}`",
        )
        await reply_after(inv, embed=embed)


async def setup(bot: commands.AutoShardedBot):
    await bot.add_cog(BoostCog(bot))
