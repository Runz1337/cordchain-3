"""Activity engine cog — the attention → market-cap flywheel.

Message counters fill up silently; once per hour the cog posts the count to
the FastAPI activity endpoint, where the league-tuned flow formula converts
real chat into pool-backed price. Anti-farm is preserved server-side
(≤ member count chatters, one ingest per guild per hour).
"""

from __future__ import annotations

import logging
import time
import datetime as _dt
from collections import defaultdict

import discord
from discord.ext import commands, tasks

from cordchain.utils import api_client
from cordchain.utils.api_client import ApiError
from cordchain.utils.embeds import cc_embed, emoji
from cordchain.utils.invocation import respond

logger = logging.getLogger("CordChain.Activity")

PER_GUILD_MSG_CAP = 50_000
_idle_until: dict[str, float] = {}


class ActivityCog(commands.Cog, name="Activity"):
    """Counts real chatters + messages per guild and reports them hourly."""

    def __init__(self, bot: commands.AutoShardedBot):
        self.bot = bot
        self._messages: defaultdict[str, int] = defaultdict(int)
        self._chatters: defaultdict[str, set] = defaultdict(set)
        self._registered: set[str] | None = None
        self._activity_loop.start()

    async def cog_unload(self):
        self._activity_loop.cancel()

    # ---- gateway listener ----
    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild:
            return
        if message.author.id == self.bot.user.id:
            return
        gid = str(message.guild.id)
        if gid in _idle_until:
            return
        if self._messages[gid] < PER_GUILD_MSG_CAP:
            self._messages[gid] += 1
        self._chatters[gid].add(str(message.author.id))

    # ---- hourly flush ----
    @tasks.loop(hours=1)
    async def _activity_loop(self):
        deadlines = dict(_idle_until)
        for gid, until in deadlines.items():
            if time.time() >= until:
                _idle_until.pop(gid, None)

        if self._registered is None or not self._registered:
            try:
                rows = await api_client.guilds()
                self._registered = {str(r.get("guildId")) for r in rows}
            except (ApiError, Exception):
                return

        for gid in list(self._messages):
            if gid not in self._registered:
                continue
            msgs = self._messages[gid]
            chatters = len(self._chatters.get(gid) or ())
            self._messages.pop(gid, None)
            self._chatters.pop(gid, None)
            if msgs <= 0 and chatters <= 0:
                continue
            try:
                data = await api_client.activity_ingest(gid, msgs, chatters)
                logger.info(
                    "📈 [Activity] %s msgs=%s chatters=%s → %s %s",
                    gid, msgs, chatters,
                    data.get("priceBefore"), data.get("newStockPrice"),
                )
            except ApiError as exc:
                if exc.status == 429:
                    logger.info(f"⏳ [Activity] {gid} already ingested this hour; cooldown respected.")
                    self._messages[gid] += msgs
                    self._chatters[gid].update(set())
                    _idle_until[gid] = time.time() + 1800
                elif exc.status == 404:
                    logger.info(f"💤 [Activity] {gid} not registered on CordChain; parked for 24h.")
                    self._registered.discard(gid)
                    _idle_until[gid] = time.time() + 86400
                else:
                    logger.warning(f"⚠️ [Activity] ingest {gid} failed: {exc}")
            except Exception as exc:
                logger.warning(f"⚠️ [Activity] ingest {gid} network error: {exc}")

    @_activity_loop.before_loop
    async def _wait_for_ready(self):
        await self.bot.wait_until_ready()

    @commands.hybrid_command(
        name="activity",
        aliases=["chatflow"],
        description="Owner/admin status of the chat-flow ingestor for this server",
    )
    @commands.has_permissions(manage_guild=True)
    async def activity(self, inv):
        gid = str(inv.guild.id) if inv.guild else "0"
        msgs = self._messages.get(gid, 0)
        chatters = len(self._chatters.get(gid) or set())
        wait = self.flush_wait_minutes()
        status = "Cooling down (busy hour)" if gid in _idle_until else "Counting live"
        embed = cc_embed(
            f"{emoji('activity')} Chat-flow engine status",
            f"• Registered chatters: **{chatters}** / live message counter: **{msgs:,}**\n"
            f"• Window opens: **{wait} minutes** before hourly flush\n"
            f"• Ingest rule: **one activity ingest per guild per hour** (server-enforced anti-farm)\n"
            f"• Counter state: **{status}**",
        )
        await respond(inv, embed=embed)

    def flush_wait_minutes(self):
        now = _dt.datetime.now(_dt.timezone.utc)
        return 60 - now.minute


async def setup(bot: commands.AutoShardedBot):
    await bot.add_cog(ActivityCog(bot))
