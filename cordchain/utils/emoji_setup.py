"""Self-installing guild-emoji set.

At boot the bot ensures the minimalist `cc_*` emoji set (rendered from the
web UI's lucide icon language, see cordchain/assets/emojis/) exists in the
official guild. Missing emojis are created from the bundled PNGs; existing
ones are left untouched. Missing MANAGE_GUILD_EXPRESSIONS permission or a
not-found guild degrades to a single clear log line — embeds simply fall
back to unicode glyphs (see utils/embeds.py).
"""

from __future__ import annotations

import asyncio
import os

import discord

from cordchain.utils.embeds import EMOJI_FALLBACK, OFFICIAL_GUILD_ID

ASSETS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "cordchain",
    "assets",
    "emojis",
)

# Registry key -> bundled png basename (cc_<key>.png)
BUNDLED = sorted(EMOJI_FALLBACK.keys())


def _png_bytes(key: str) -> bytes | None:
    path = os.path.join(ASSETS_DIR, f"cc_{key}.png")
    try:
        with open(path, "rb") as f:
            data = f.read()
    except OSError:
        return None
    return data or None


async def ensure_emojis(bot: discord.Client, logger, guild_id: int = OFFICIAL_GUILD_ID) -> int:
    """Create any missing cc_* emojis in the official guild. Returns created count."""
    guild = bot.get_guild(guild_id)
    if guild is None:
        logger.info(f"📴 [Emoji Setup] Official guild {guild_id} not reachable — embeds use unicode fallbacks.")
        return 0

    existing = {e.name: e for e in guild.emojis if e.name.startswith("cc_")}
    missing = [key for key in BUNDLED if f"cc_{key}" not in existing]
    if not missing:
        logger.info(f"🎨 [Emoji Setup] Icon set already complete in {guild.name} ({len(existing)} cc_*).")
        return 0

    me = guild.me
    if me is None or not me.guild_permissions.manage_emojis_and_stickers:
        logger.warning(
            "⚠️ [Emoji Setup] Bot lacks **Manage Guild Expressions** in the official guild — "
            "grant it in Server Settings → Roles to install the minimalist icon set."
        )
        return 0

    created = 0
    for key in missing:
        name = f"cc_{key}"
        if name in existing:
            continue
        data = await asyncio.to_thread(_png_bytes, key)
        if data is None:
            continue
        try:
            await guild.create_custom_emoji(name=name, image=data, reason="CordChain minimalist icon set")
            created += 1
        except discord.HTTPException as exc:
            logger.warning(f"⚠️ [Emoji Setup] {name} upload failed: {exc}")
        await asyncio.sleep(1.2)  # stay well under the rate limit

    logger.info(
        f"🎨 [Emoji Setup] Icon set ready in {guild.name}: {created} created, "
        f"{len(existing)} already present."
    )
    return created
