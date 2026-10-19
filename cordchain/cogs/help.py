"""Help cog — the detailed help system.

Renders a serious transparent help deck: category select menu, per-topic
buttons that open live modals ("try it now"), command specification embeds for
`!help <command>`, and accurate prefix examples. Registered as a hybrid
command so both `/help` and `!help` hit the same builders.
"""

from __future__ import annotations

import os

import discord
from discord import app_commands
from discord.ext import commands

from cordchain.utils.embeds import cc_embed, codeblock, emoji
from cordchain.utils.invocation import respond
from cordchain.utils.links import web_url

TOPIC_OVERVIEW = "overview"

PREFERRED_PREFIX = os.environ.get("CORDCHAIN_BOT_PREFIX", "!")

TOPICS: dict[str, dict] = {
    "trading": {
        "label": "Trading",
        "glyph": "buy",
        "intro": "Buy and sell shares of real Discord servers on a constant-product AMM that only moves from real fills.",
        "commands": ["buy", "sell", "quote"],
        "examples": ["!buy $CORDC 500", "!sell $CORDC 250", "!quote $CORDC BUY 1000"],
        "try_modal": "buy",
        "notes": [
            "Every fill lives on the trade tape the second it happens — minted price ticks are not a thing.",
            "Sub-cent markets are real: prices print to 6 decimals below $0.01.",
            "Minimum settlement is $0.05 notional (shares × price) on both sides.",
        ],
    },
    "market-data": {
        "label": "Market data",
        "glyph": "trend",
        "intro": "Ledger-derived market data only: executed trades + recorded price ticks. Never seeded, never faked.",
        "commands": ["server", "servers", "orderbook", "tape", "candle"],
        "examples": ["!server $CORDC", "!orderbook $CORDC", "!tape $CORDC", "!candle $CORDC 1D 16"],
        "notes": [
            "Dormant markets quote $0.000000 honestly — the pool's mark is intact but no shares float.",
            "The candle trail is rolled up from real trades and activity/bump/boost events.",
        ],
    },
    "wallet": {
        "label": "Wallet & portfolio",
        "glyph": "wallet",
        "intro": "Pure fantasy $CRED economy — zero gas, no wallet friction, 100% transparent ledger.",
        "commands": ["portfolio", "leaderboard traders", "leaderboard servers"],
        "examples": ["!portfolio", "!leaderboard", "!leaderboard servers"],
        "notes": [
            "New traders start with 1,000 $CRED allowance upon signup.",
            "Claim +50 $CRED daily login bonus in your web vault or bot.",
            "Daily earn cap: 250 $CRED. Market cap = 1,000,000 fixed shares × pool price.",
        ],
    },
    "growth": {
        "label": "Growth & Community Score",
        "glyph": "boost",
        "intro": "Bot-resistant Community Score drives weekly earnings: unique chatters (sqrt-scaled), retention, conversation spread, and voice minutes.",
        "commands": ["bump", "boost", "bumpstatus", "activity", "earnings"],
        "examples": ["!bump", "!boost", "!activity", "!earnings"],
        "notes": [
            "You must hold ≥1 share of a server to bump it.",
            "Bump: +0.4% price acceleration, 6h cooldown per user per server.",
            "Community Score generates weekly fantasy dividends in $CRED paid to all shareholders.",
            "Privacy first: strictly aggregate metrics and hashes, never message contents.",
        ],
    },
    "chain": {
        "label": "CordLedger & CordScan",
        "glyph": "ledger",
        "intro": "Local append-only, SHA-256 hash-chained ledger with Merkle root blocks and Ed25519 signatures.",
        "commands": ["verify"],
        "examples": ["!verify"],
        "notes": [
            "Every event (IPO, trade, daily allowance, earnings) links to prev_hash.",
            "CordScan explorer replaces BaseScan: transparent blocks, token pages, and receipts.",
            "In-browser and CLI hash verification: anyone can re-run the SHA-256 check.",
        ],
    },
    "rules": {
        "label": "Fair-play rules",
        "glyph": "scale",
        "intro": "What keeps every league measurable and cheat-proof.",
        "commands": [],
        "examples": [],
        "notes": [
            "Fixed supply: 1,000,000 shares per server (25% creator reserve, 5% monthly vesting, 75% AMM float).",
            "Circuit breakers: 20% price swing in 15 mins triggers a 30-minute trading pause.",
            "Position limits: maximum 100,000 shares (10% of supply) per trader.",
            "Wash-trade guard: 60-second round-trip restriction blocks self-dealing.",
        ],
    },
    "social": {
        "label": "Seasons, Rivalries & Quests",
        "glyph": "trophy",
        "intro": "Discord-native community mechanics: monthly resets, server derbies, collaborative quests, and prediction pools.",
        "commands": ["seasons", "rivalry", "quests", "predictions"],
        "examples": ["!seasons", "!rivalry", "!quests $CORDC", "!predictions"],
        "notes": [
            "Seasons: 30-day competitive seasons with clean resets and Hall of Fame enshrinement.",
            "Rivalries: weekly server vs server derbies competing on organic growth.",
            "Quests: collaborative milestones that boost Community Score & weekly dividend pools.",
            "Predictions: peer-to-peer fantasy $CRED prediction pools on community events.",
        ],
    },
}

TOPIC_PATHS = list(TOPICS)


def _topic_embed(topic_key: str) -> discord.Embed:
    if topic_key in TOPICS:
        t = TOPICS[topic_key]
        embed = cc_embed(f"{emoji(t['glyph'])} {t['label']}", t["intro"])
        if t["commands"]:
            embed.add_field(
                name="Commands",
                value="\n".join(f"`{c}`" for c in t["commands"]),
                inline=True,
            )
        if t["examples"]:
            embed.add_field(name="Prefix examples", value=codeblock("\n".join(t["examples"])), inline=True)
        embed.add_field(
            name="What to expect",
            value="\n".join(f"• {n}" for n in t["notes"]),
            inline=False,
        )
        return embed
    return cc_embed("Help topic not recognized", f"Use the select menu — topics: {', '.join(t['label'] for t in TOPICS.values())}")


class TopicSelect(discord.ui.Select):
    def __init__(self):
        options = [
            discord.SelectOption(label=t["label"], value=key, emoji=emoji(t["glyph"]), description=t["intro"][:76])
            for key, t in TOPICS.items()
        ]
        super().__init__(placeholder="Help topic…", options=options)

    async def callback(self, interaction: discord.Interaction):
        embed = _topic_embed(self.values[0])
        embed = _subject_footer(embed, self.values[0])
        await interaction.response.edit_message(embed=embed, view=self.view)


def _subject_footer(embed: discord.Embed, topic: str) -> discord.Embed:
    if topic in TOPICS and TOPICS[topic].get("try_modal"):
        embed.add_field(
            name="Try it now",
            value=f"Press **{emoji('buy')} Try the ticket** to open a real trade modal.",
            inline=False,
        )
    if topic in TOPICS and TOPICS[topic].get("notes"):
        embed.set_footer(text="CordChain • /help [topic] works too. Serious markets need serious help decks.")
    return embed


class TopicHelpView(discord.ui.View):
    def __init__(self, timeout: float = 180):
        super().__init__(timeout=timeout)
        self.add_item(TopicSelect())
        for item in self.children:
            if getattr(item, "custom_id", None) == "cc:help-try-ticket":
                item.emoji = emoji("buy")
                item.label = "Try the ticket"
        self.add_item(
            discord.ui.Button(
                label="Website",
                style=discord.ButtonStyle.link,
                url=web_url(),
                row=2,
            )
        )

    @discord.ui.button(label="Try the ticket", style=discord.ButtonStyle.primary, custom_id="cc:help-try-ticket", row=1)
    async def try_main_trade(self, interaction: discord.Interaction, _):
        from cordchain.utils import access
        await access.gate_click(interaction)

    async def on_timeout(self):
        for item in self.children:
            if hasattr(item, "disabled"):
                item.disabled = True


def hub_embed(prefix: str) -> discord.Embed:
    lines = []
    for key, t in TOPICS.items():
        cmds = ", ".join(f"`{c}`" for c in t["commands"][:4]) or "—"
        lines.append(f"{emoji(t['glyph'])} **{t['label']}** — {cmds}")
    embed = cc_embed(
        f"{emoji('dir')} CordChain — Fantasy Stock Exchange",
        "Serious markets need serious help decks. Everything is done in chat with no-colour receipts: "
        "every command holds the web terminal accountable.\n\n"
        + "\n".join(lines),
    )
    embed.add_field(
        name="Prefix + slash",
        value=f"`{prefix}help <topic>` or `/help topic:<topic>` — same deck, same commands.\nPrefix: `{prefix}` & mention both fire.",
        inline=False,
    )
    embed.add_field(
        name="Quick start",
        value=f"`{prefix}servers` → pick a listing → `/server $TICKER` → `/buy $TICKER 25`.\n"
        f"Or press **{emoji('buy')} Try the ticket** below.",
        inline=False,
    )
    return embed


def command_spec_embed(prefix: str, command) -> discord.Embed:
    params = []
    if getattr(command, "params", None):
        for p in command.params:
            name = getattr(p, "key", None) or p.name
            params.append(str(name))
    usage = f"{prefix}{command.qualified_name} " + " ".join(f"<{p}>" for p in params)
    embed = cc_embed(
        f"⚙️ {prefix}{command.qualified_name}",
        (command.help or command.description or "").strip() or "No long-form help written for this command yet.",
    )
    embed.add_field(name="Usage", value=codeblock(usage), inline=False)
    parent = getattr(command, "parent", None)
    if command.aliases:
        embed.add_field(name="Aliases", value=", ".join(f"`{prefix}{a}`" for a in command.aliases), inline=True)
    if parent is not None:
        embed.add_field(name="Group", value=f"`{prefix}{parent.qualified_name}`", inline=True)
    embed.add_field(
        name="Fair-play reminder",
        value="All commands run against the same FastAPI ledger as the web terminal — no shortcuts, no drift.",
        inline=False,
    )
    return embed


class HelpCog(commands.Cog, name="Help"):
    """The help deck — UI-served, prefix-compatible."""

    def __init__(self, bot: commands.AutoShardedBot):
        self.bot = bot
        self.prefix = PREFERRED_PREFIX

    @commands.hybrid_command(
        name="help",
        aliases=["h", "commands", "start"],
        description="Open the CordChain help deck (topic decks, command specs, live try-it modals)",
    )
    @app_commands.describe(topic="Optional topic or command to drill into")
    @app_commands.choices(topic=[app_commands.Choice(name=t["label"], value=key) for key, t in TOPICS.items()])
    async def help_deck(self, inv, topic: str = ""):
        prefix = PREFERRED_PREFIX
        if topic:
            cleaned = topic.strip().lstrip(prefix)
            cmd = self.bot.get_command(cleaned)
            if cmd is not None:
                return await respond(inv, embed=command_spec_embed(prefix, cmd))
            if cleaned in TOPICS:
                return await respond(inv, embed=_topic_embed(cleaned))
            return await respond(
                inv,
                embed=cc_embed(
                    "Help path not found",
                    f"`{topic}` is neither a topic nor a command. Topics: "
                    + ", ".join(f"`{k}`" for k in TOPIC_PATHS),
                ),
            )
        await respond(inv, embed=hub_embed(prefix), view=TopicHelpView())


async def setup(bot: commands.AutoShardedBot):
    await bot.add_cog(HelpCog(bot))
