"""Polymorphic invocation helpers for hybrid commands.

discord.py hybrid commands receive a ``discord.Interaction`` on the slash path
and a ``commands.Context`` on the prefix path. Every command body therefore
talks to the invocation through these helpers so both paths behave identically.
"""

from __future__ import annotations

import discord
from discord.ext import commands

Invocation = discord.Interaction | commands.Context


def is_interaction(inv: Invocation) -> bool:
    return isinstance(inv, discord.Interaction)


def inv_user(inv: Invocation):
    return getattr(inv, "author", None) or getattr(inv, "user", None)


def inv_guild(inv: Invocation):
    return getattr(inv, "guild", None)


def inv_id(inv: Invocation) -> str:
    """Stable user id for receipt routing (author on Context, user on Interaction)."""
    user = inv_user(inv)
    return str(user.id) if user is not None else "0"


async def defer(inv: Invocation, ephemeral: bool = False):
    """Say 'working…' on both paths (Context: ctx.defer; Interaction: response.defer)."""
    try:
        if isinstance(inv, discord.Interaction):
            if not inv.response.is_done():
                await inv.response.defer(ephemeral=ephemeral)
        else:
            await inv.defer()
    except AttributeError:
        pass


async def respond(inv: Invocation, *, content: str | None = None, embed: discord.Embed | None = None,
                  view: discord.ui.View | None = None, file: discord.File | None = None,
                  ephemeral: bool | None = None):
    """First message of the turn — send_message on slash, ctx.send on prefix."""
    if isinstance(inv, discord.Interaction):
        if inv.response.is_done():
            return await inv.followup.send(content=content, embed=embed, view=view, file=file)
        return await inv.response.send_message(
            content=content, embed=embed, view=view, file=file, ephemeral=bool(ephemeral)
        )
    return await inv.send(content=content, embed=embed, view=view, file=file)


async def reply_after(inv: Invocation, *, content: str | None = None, embed: discord.Embed | None = None,
                      view: discord.ui.View | None = None, ephemeral: bool | None = None):
    """Follow-up message — followup.send on slash, plain send on prefix."""
    if isinstance(inv, discord.Interaction):
        try:
            return await inv.followup.send(content=content, embed=embed, view=view)
        except discord.HTTPException:
            return await inv.channel.send(content=content, embed=embed, view=view)  # type: ignore[union-attr]
    return await inv.send(content=content, embed=embed, view=view)


async def open_modal(inv: Invocation, modal: discord.ui.Modal):
    """Modals exist only on the interaction path —_prefix gets a usage hint."""
    if isinstance(inv, discord.Interaction):
        await inv.response.send_modal(modal)
    else:
        prefix = getattr(inv, "prefix", "?") or "/"
        command = getattr(inv, "command", None)
        usage = prefix + str(getattr(command, "qualified_name", "trade")) + " $TICKER <stocks>"
        await inv.send(f"🎫 Try-it modals only exist for the `/slash` desktop experience — "
                       f"call it as `{usage}` instead.")


def guild_id_of(inv: Invocation) -> str:
    g = inv_guild(inv)
    return str(g.id) if g else "0"
