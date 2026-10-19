"""CordChain embed utilities — the house style is "serious deep-ink embed".

Discord embeds have no true transparency; the house ink is instead a single
deep neutral: #252429 on every embed (INK_COLOR). State is signalled by emoji
and plain-text headers only. All money formatting honours sub-cent prices
exactly like the FastAPI (6 decimal places below $0.01).
"""

from __future__ import annotations

import discord

INK_COLOR = 0x252429  # #252429 — deep neutral ink, every embed, no exceptions

FOOTER_TEXT = "CordChain • Cross-Server Fantasy Stock Exchange"
ERROR_FOOTER = "CordChain • Exchange Desk"

IPO_OPENING_PRICE = 0.0001  # Season 1 micro-strike ($0.0001), mirrored from api.IPO_PRICE_USD

LEAGUE_NAMES = {
    1: "Squad League (15-150 members)",
    2: "Club League (151-1,000 members)",
    3: "Arena League (1,001-10,000 members)",
    4: "Titan League (10,001+ members)",
}

# ----------------- minimalist guild-emoji registry -----------------
#
# The icon set mirrors the web UI's own minimalist language (lucide 24px
# stroke line art) and is uploaded into the official guild as `cc_*` emoji
# by the bot at boot (cordchain/assets/emojis/*.png). Until hydration lands
# — or when the bot cannot reach the official guild — every slot falls back
# to a plain unicode glyph so embeds never render blank.

OFFICIAL_GUILD_ID = 1559968534795255868

EMOJI_FALLBACK = {
    "buy": "🛒",
    "sell": "💸",
    "quote": "🏷️",
    "wallet": "💼",
    "trophy": "🏆",
    "zap": "⚡",
    "boost": "🚀",
    "trend": "📈",
    "server": "🏦",
    "dir": "📖",
    "book": "📚",
    "candle": "🕯️",
    "ledger": "🧾",
    "chain": "⛓️",
    "scale": "⚖️",
    "eye": "👁️",
    "activity": "🫧",
    "megaphone": "📣",
    "check": "✅",
    "cross": "❌",
    "shield": "🛡️",
    "users": "👥",
    "flame": "🔥",
    "mark": "👑",
    "timer": "⏳",
    "warn": "⚠️",
}

_custom_emoji: dict[str, str] = {}


def set_emoji(key: str, markup: str) -> None:
    """Register a hydrated custom emoji markup under its registry key."""
    if key and markup:
        _custom_emoji[key] = markup


def emoji(key: str) -> str:
    """Custom `cc_*` emoji markup for a slot, or its unicode fallback."""
    return _custom_emoji.get(key) or EMOJI_FALLBACK.get(key, "")


async def hydrate_emojis(bot) -> int:
    """Fetch the cc_* emojis from the official guild into the registry."""
    guild = bot.get_guild(OFFICIAL_GUILD_ID)
    if guild is None:
        return 0
    try:
        emojis = await guild.fetch_emojis()
    except Exception:
        emojis = list(guild.emojis)
    n = 0
    for e in emojis:
        if e.name.startswith("cc_"):
            set_emoji(e.name[3:], str(e))
            n += 1
    return n


class _LeagueEmojiMap(dict):
    """{tier: registry-key} map resolving through `emoji()` at access time."""

    _KEYS = {1: "shield", 2: "users", 3: "flame", 4: "mark"}

    def get(self, tier, default=""):
        key = self._KEYS.get(tier)
        if key is None:
            return default
        resolved = emoji(key)
        return resolved if resolved else default


LEAGUE_EMOJI = _LeagueEmojiMap()


# ----------------- formatting -----------------

def fmt_price(p) -> str:
    """5dp below $10.00 (matching the API's format_price), 2dp otherwise."""
    try:
        val = float(p)
    except (TypeError, ValueError):
        return "0.00010"
    if val <= 0:
        return "0.00"
    return f"{val:.5f}" if val < 10.0 else f"{val:.2f}"


def fmt_cred(v) -> str:
    try:
        val = float(v)
    except (TypeError, ValueError):
        val = 0.0
    if 0 < abs(val) < 10.0:
        return f"{val:.5f} $CRED"
    return f"{val:,.2f} $CRED"


def fmt_number(n) -> str:
    try:
        val = float(n)
    except (TypeError, ValueError):
        return "0"
    if val >= 1000 or val == int(val):
        return f"{int(val):,}"
    return f"{val:,.2f}"


def fmt_pct(p) -> str:
    try:
        val = float(p)
    except (TypeError, ValueError):
        val = 0.0
    glyph = "▲" if val > 0 else ("▼" if val < 0 else "－")
    sign = "+" if val > 0 else ""
    abs_val = abs(val)
    precision = 2 if abs_val >= 0.01 else 4
    return f"{glyph} {sign}{val:.{precision}f}%"


def market_chip(market_state: str | None) -> str:
    state = (market_state or "").strip().lower()
    if state == "dormant":
        return "⟳ dormant (no holders)"
    if state == "live":
        return "● live"
    if state == "ipo-prep":
        return "◷ ipo open"
    return "○ uplisted"


def codeblock(content: str, lang: str = "") -> str:
    """Arity-safe discord codeblock for serious monospace tables."""
    content = (content or "").replace("`", "\u200b`").strip("\n")
    if content == "":
        content = " "
    return f"```{lang}\n{content}\n```"


_CANDLE_GLYPHS = "▁▂▃▄▅▆▇█"


def spark(closes: list[float], width: int = 12) -> str:
    """Colourless unicode candle sparkline (▁▂▃▄▅▆▇█)."""
    vals = [float(c) for c in (closes or []) if isinstance(c, (int, float))]
    if not vals:
        return "—"
    if len(vals) > width:
        step = len(vals) / width
        vals = [vals[int(i * step)] for i in range(width)]
    lo, hi = min(vals), max(vals)
    if hi <= lo:
        return _CANDLE_GLYPHS[3] * len(vals)
    scaled = [int(round((v - lo) / (hi - lo) * (len(_CANDLE_GLYPHS) - 1))) for v in vals]
    return "".join(_CANDLE_GLYPHS[i] for i in scaled)


# ----------------- embed factory -----------------

def cc_embed(title: str = "", description: str = "") -> discord.Embed:
    """House-style embed — always inked #252429."""
    embed = discord.Embed(title=title, description=description, color=INK_COLOR)
    embed.set_footer(text=FOOTER_TEXT)
    return embed


def success_embed(title: str, description: str) -> discord.Embed:
    return cc_embed(f"{emoji('check')} {title}", description)


def error_embed(title: str, description: str) -> discord.Embed:
    embed = cc_embed(f"{emoji('cross')} {title}", description)
    embed.set_footer(text=ERROR_FOOTER)
    return embed


def info_embed(title: str = "", description: str = "") -> discord.Embed:
    return cc_embed(title, description)
