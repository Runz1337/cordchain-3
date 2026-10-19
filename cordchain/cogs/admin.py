"""Admin diagnostics — hybrid commands, transparent embeds."""

import discord
from discord import app_commands
from discord.ext import commands

from cordchain.utils.embeds import cc_embed, codeblock, emoji
from cordchain.utils.invocation import respond


class AdminCog(commands.Cog, name="Admin"):
    """Sharding diagnostics, latency metrics, and maintenance."""

    def __init__(self, bot: commands.AutoShardedBot):
        self.bot = bot

    @commands.hybrid_command(name="ping", description="Check bot latency and gateway heartbeat")
    async def ping(self, inv):
        latency_ms = round(self.bot.latency * 1000)
        embed = cc_embed(
            "Pong!",
            f"• **Gateway Latency:** `{latency_ms} ms`\n• **Shards Active:** `{self.bot.shard_count}`"
        )
        await respond(inv, embed=embed)

    @commands.hybrid_command(name="shards", description="View live Discord gateway shard cluster status")
    @app_commands.default_permissions(administrator=True)
    @commands.has_permissions(administrator=True)
    async def shards(self, inv):
        embed = cc_embed(
            "Gateway Shard Cluster Status",
            f"Total Shards: **{self.bot.shard_count}** | Total Guilds: **{len(self.bot.guilds)}**"
        )
        lines = []
        for shard_id, shard in self.bot.shards.items():
            latency = round(shard.latency * 1000) if shard.latency else 0
            guild_count = len([g for g in self.bot.guilds if g.shard_id == shard_id])
            lines.append(f"shard {shard_id:<3} guilds {guild_count:>6} latency {latency:>6} ms ●")

        embed.add_field(name="Shards", value=codeblock("\n".join(lines)), inline=False)
        embed.set_footer(text="CordChain • Fanned-out Gateway Architecture")
        await respond(inv, embed=embed)


async def setup(bot: commands.AutoShardedBot):
    await bot.add_cog(AdminCog(bot))
