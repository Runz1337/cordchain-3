"""New-trader authorization gate.

The CordChain protocol requires every new trader to do two things before the
market commands answer:

1. **Agree to the Terms of Service in Discord chat** — recorded per user in
   the committed `user_consents` table (tamper-evident paper trail, one row
   per trader, versioned).
2. **Authorize their identity on the bot dashboard** — the web terminal owns
   the Discord OAuth flow; completion is proven by an active row in
   `web_sessions` for their discord id.

Read-only for identity: the gate reads authorization state from the
committed ledger and never invents it. Money commands, positions, boosts and
server listing stay gated; help, admin diagnostics and public market data
stay open so discovery works.
"""

from __future__ import annotations

import discord
from discord.ext import commands

from cordchain.utils.embeds import cc_embed, emoji, success_embed, error_embed
from cordchain.utils.links import dashboard_url

TOS_VERSION = "v1"

TOS_AT_A_GLANCE = (
    "• **Fantasy only** — $CRED are play-money points. Real cash-out is a separate, "
    "identity-verified ledger and is never processed from Discord chat.\n"
    "• **One trader, one account** — one identity per person. Server-enforced "
    "anti-farm: boosting your own portfolio via mutual gaming gets clipped.\n"
    "• **Honest tape** — every order is executed by the same AMM the web terminal "
    "uses. Prices move by real flow, nothing here is seeded or staged.\n"
    "• **Your receipts** — every fill is posted in the channel it belongs to, "
    "public for that server, auditable later.\n"
    "• **Owner rights** — server owners set the listing, traders set the price. "
    "The exchange never touches positions without your order."
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS user_consents (
    discord_id   TEXT PRIMARY KEY,
    tos_version  TEXT NOT NULL DEFAULT '{version}',
    consented_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
""".format(version=TOS_VERSION)


async def ensure_schema(logger) -> None:
    from cordchain.database import db_pool

    await db_pool.execute(_SCHEMA)
    logger.info(f"✅ [Gate] user_consents ready (tos {TOS_VERSION}).")


async def is_consented(user_id: str) -> bool:
    from cordchain.database import db_pool

    row = await db_pool.fetchval(
        "SELECT 1 FROM user_consents WHERE discord_id = $1 AND tos_version = $2",
        user_id, TOS_VERSION,
    )
    return bool(row)


async def record_consent(user_id: str) -> None:
    from cordchain.database import db_pool

    await db_pool.execute(
        "INSERT INTO user_consents (discord_id, tos_version) VALUES ($1, $2) "
        "ON CONFLICT (discord_id) DO UPDATE SET tos_version = EXCLUDED.tos_version, "
        "consented_at = now()",
        user_id, TOS_VERSION,
    )


async def has_web_session(user_id: str) -> bool:
    from cordchain.database import db_pool

    row = await db_pool.fetchval(
        "SELECT 1 FROM web_sessions WHERE discord_id = $1 AND expires_at > now() LIMIT 1",
        user_id,
    )
    return bool(row)


async def fully_authorized(user_id: str) -> bool:
    return await is_consented(user_id) and await has_web_session(user_id)


def _gate_embed(user_name: str, consented: bool, session: bool) -> discord.Embed:
    mark = lambda ok: emoji("check") if ok else emoji("cross")
    embed = cc_embed(
        f"{emoji('dir')} Authorize to use CordChain",
        f"Hey **{user_name}** — the exchange runs on consent, not on defaults. "
        "Two quick things and every market command answers:",
    )
    embed.add_field(
        name=f"{mark(consented)} Step 1 • Terms of Service",
        value="Read below and press **I agree to the terms** in chat.",
        inline=False,
    )
    embed.add_field(
        name=f"{mark(session)} Step 2 • Dashboard authorization",
        value="Press **Authorize on the dashboard** — sign in with your Discord "
        "identity, your wallet and receipts live there.",
        inline=False,
    )
    embed.add_field(name="Terms of service (summary)", value=TOS_AT_A_GLANCE, inline=False)
    embed.set_footer(text=f"CordChain • Terms {TOS_VERSION} • both steps are one-time")
    return embed


class AuthorizationGateView(discord.ui.View):
    def __init__(self, user_id: str, user_name: str, timeout: float = 240):
        super().__init__(timeout=timeout)
        self.user_id = user_id
        self.user_name = user_name
        self.add_item(
            discord.ui.Button(
                label="Authorize on the dashboard",
                style=discord.ButtonStyle.link,
                url=dashboard_url(),
                row=0,
            )
        )

    async def _refresh(self, interaction: discord.Interaction):
        consented = await is_consented(self.user_id)
        session = await has_web_session(self.user_id)
        embed = _gate_embed(self.user_name, consented, session)
        await interaction.response.edit_message(embed=embed, view=self)
        if consented and session:
            done = discord.Embed(
                title=f"{emoji('check')} Authorization complete — welcome to the floor",
                description=(
                    f"**{self.user_name}** is cleared: terms **{TOS_VERSION}** agreed here in chat, "
                    f"dashboard identity live. Every market command now answers."
                ),
                color=0x252429,
            )
            done.set_footer(text="CordChain • Cross-Server Fantasy Stock Exchange")
            await interaction.followup.send(embed=done)

    @discord.ui.button(label="I agree to the terms", style=discord.ButtonStyle.primary)
    async def agree(self, interaction: discord.Interaction, _):
        if str(interaction.user.id) != self.user_id:
            return await interaction.response.send_message(
                embed=error_embed("Not your gate", f"Only <@{self.user_id}> can clear this gate. Run any market command to get your own."),
            )
        await record_consent(self.user_id)
        await self._refresh(interaction)

    @discord.ui.button(label="Re-check my status", style=discord.ButtonStyle.secondary)
    async def recheck(self, interaction: discord.Interaction, _):
        if str(interaction.user.id) != self.user_id:
            return await interaction.response.send_message(
                embed=error_embed("Not your gate", f"Only <@{self.user_id}> can clear this gate. Run any market command to get your own."),
            )
        if await is_consented(self.user_id) is False:
            await interaction.response.send_message(
                embed=error_embed("Terms still pending", "Press **I agree to the terms** first — that's step 1."),
            )
            return
        if await has_web_session(self.user_id) is False:
            await interaction.response.send_message(
                embed=error_embed(
                    "Dashboard authorization missing",
                    f"Open the dashboard and sign in: {dashboard_url()} "
                    "then press this button again.",
                ),
            )
            return
        done = success_embed(
            "Authorization complete",
            f"{self.user_name} is cleared — markets unlocked.",
        )
        done.set_footer(text=f"CordChain • Terms {TOS_VERSION} recorded in chat")
        await interaction.response.send_message(embed=done)


async def build_gate(user) -> tuple[discord.Embed, "AuthorizationGateView"]:
    """Current gate state for a user as (embed, view). Shared by /commands and button clicks."""
    uid = str(user.id)
    consented = await is_consented(uid)
    session = await has_web_session(uid)
    name = getattr(user, "display_name", None) or getattr(user, "name", "trader")
    return _gate_embed(name, consented, session), AuthorizationGateView(uid, name)


async def gate_click(interaction: discord.Interaction) -> bool:
    """Shared handler for "open trade ticket" buttons: gate first, modal if cleared."""
    if await fully_authorized(str(interaction.user.id)):
        from cordchain.cogs.trading import TradeModal

        await interaction.response.send_modal(TradeModal("buy"))
        return True
    embed, view = await build_gate(interaction.user)
    from cordchain.utils.invocation import respond

    await respond(interaction, embed=embed, view=view)
    return False


async def require(inv) -> bool:
    """Gate a command invocation. Sends the gate embed when not authorized."""
    user = getattr(inv, "author", None) or getattr(inv, "user", None)
    if user is None:
        return False
    if await fully_authorized(str(user.id)):
        return True
    embed, view = await build_gate(user)
    from cordchain.utils.invocation import respond

    await respond(inv, embed=embed, view=view)
    return False
