import os
import sys
import asyncio
import logging
from pathlib import Path
import discord
from discord.ext import commands
from discord import app_commands
from cordchain.database import db_pool
from cordchain.utils.embeds import hydrate_emojis
from cordchain.utils.emoji_setup import ensure_emojis
from cordchain.utils import access

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("CordChain")

TOKEN = os.environ.get("TOKEN") or os.environ.get("DISCORD_TOKEN")

class CordChain(commands.AutoShardedBot):
    """
    Pokétwo-Style AutoSharded Bot Architecture.
    Capable of scaling to hundreds of thousands of Discord servers seamlessly
    with automatic gateway sharding, non-blocking asyncpg connection pooling,
    and modular cogs isolation.
    """
    def __init__(self):
        intents = discord.Intents.all()
        #intents.guilds = True
        #intents.members = True
        # Prefix commands ("!") need message content; graceful when unprivileged —
        # mention-invocation still works and slash commands are unaffected.
        intents.message_content = True

        super().__init__(
            command_prefix=commands.when_mentioned_or(
                os.environ.get("CORDCHAIN_BOT_PREFIX", "!") or "!"
            ),
            intents=intents,
            help_command=None,
            chunk_guilds_at_startup=False,  # Pokétwo optimization: avoids massive memory spikes on startup
        )
        self.logger = logger

    async def on_message(self, message: discord.Message):
        # Prefix-commands canary: proves the bot is receiving message payloads.
        content = message.content or ""
        if os.environ.get("BOT_MSG_TRACE") == "1":
            chan = getattr(getattr(message, "channel", None), "name", "?")
            self.logger.info(
                f"[MsgTrace] ch={chan} type={message.type} content={content[:60]!r}"
            )
        if not content and not message.webhook_id:
            self.logger.warning(
                "⚠️ [Prefix guard] Received a message with EMPTY content — Discord is stripping it, "
                "which means the MESSAGE CONTENT INTENT is not actually enabled for this application."
            )
        await self.process_commands(message)

    async def on_command(self, ctx: commands.Context):
        pass

    async def setup_hook(self):
        # 1. Connect to high-performance asyncpg pool
        await db_pool.connect()

        # 1b. Authorization gate schema (consent ledger)
        try:
            await access.ensure_schema(self.logger)
        except Exception as e:
            self.logger.error(f"❌ [Gate] consent schema failed: {e}")

        # 2. Dynamically load all cogs from cordchain/cogs/
        cogs_dir = Path(__file__).parent / "cogs"
        loaded_count = 0

        for file in cogs_dir.glob("*.py"):
            if file.name.startswith("__"):
                continue
            cog_name = f"cordchain.cogs.{file.stem}"
            try:
                await self.load_extension(cog_name)
                loaded_count += 1
                self.logger.info(f"🧩 [Cog Loaded] {cog_name}")
            except Exception as e:
                self.logger.error(f"❌ Failed to load cog {cog_name}: {e}", exc_info=True)

        self.logger.info(f"✅ Loaded {loaded_count} cogs successfully.")

    # Shard Monitoring Listeners (Pokétwo High-Scale Pattern)
    async def on_shard_ready(self, shard_id: int):
        guilds_on_shard = len([g for g in self.guilds if g.shard_id == shard_id])
        self.logger.info(f"🌐 [Shard #{shard_id} READY] Serving {guilds_on_shard} guilds. Total Shards: {self.shard_count}")

    async def on_shard_resumed(self, shard_id: int):
        self.logger.info(f"🔄 [Shard #{shard_id} RESUMED] Gateway session resumed.")

    async def on_shard_disconnect(self, shard_id: int):
        self.logger.warning(f"⚠️ [Shard #{shard_id} DISCONNECTED] Reconnecting to gateway...")

    async def on_ready(self):
        self.logger.info(f"🚀 [CordChain Bot] Online as {self.user} (ID: {self.user.id})")
        self.logger.info(f"📊 Serving {len(self.guilds):,} total guilds across {self.shard_count} shards.")

        # Minimalist icon set: install any missing cc_* emojis, then hydrate
        # the embed registry (custom markup, unicode fallback until then).
        try:
            created = await ensure_emojis(self, self.logger)
            n_icons = await hydrate_emojis(self)
            self.logger.info(f"🎨 [Emoji Registry] hydrated {n_icons} cc_* icons ({created} freshly created).")
        except Exception as e:
            self.logger.warning(f"⚠️ [Emoji Setup] skipped: {e}")

        # Synchronize slash commands globally on ready
        try:
            self.logger.info("⚡ Synchronizing slash commands with Discord...")
            synced = await self.tree.sync()
            self.logger.info(f"🌍 Globally synced {len(synced)} application commands!")
        except Exception as e:
            self.logger.error(f"❌ Error syncing command tree: {e}")

        # Set Pokétwo-style rich presence activity
        activity = discord.Activity(
            type=discord.ActivityType.watching,
            name=f"the Stock Market | /boost"
        )
        await self.change_presence(status=discord.Status.online, activity=activity)

        prefix = os.environ.get("CORDCHAIN_BOT_PREFIX", "!")
        self.logger.info(
            "🛠 Build marker: ink-#252429 / all-embeds-public / hybrid on — "
            f"slash AND {prefix}prefix both live ({len(self.commands)} commands)"
        )

    def _humanize_error(self, error: Exception) -> str:
        if isinstance(error, app_commands.CommandOnCooldown):
            return f"⏳ This command is on cooldown. Try again in `{error.retry_after:.1f}` seconds."
        if isinstance(error, app_commands.MissingPermissions):
            perms = ", ".join(error.missing_permissions)
            return f"🚫 You need `{perms}` permission to use this command."
        if isinstance(error, app_commands.BotMissingPermissions):
            perms = ", ".join(error.missing_permissions)
            return f"🚫 I need `{perms}` permission to execute this."
        if isinstance(error, app_commands.CheckFailure):
            return "🚫 You don't meet the requirements for this command here."
        self.logger.error("Unhandled app command error", exc_info=error)
        return "❌ An unexpected error occurred while executing this command."

    async def on_app_command_error(self, interaction: discord.Interaction, error: app_commands.AppCommandError):
        """Centralized application command error handling (slash side)."""
        msg = self._humanize_error(error)
        if interaction.response.is_done():
            await interaction.followup.send(msg)
        else:
            await interaction.response.send_message(msg)

    async def on_command_error(self, ctx: commands.Context, error: commands.CommandError):
        """Centralized prefix command error handling ("!" side)."""
        try:
            raise error
        except commands.CommandNotFound:
            await ctx.send("❓ Unknown command — try `!help`.")
        except (commands.CommandOnCooldown,) as err:
            await ctx.send(self._humanize_error_cooldown(err.retry_after))
        except commands.MissingRequiredArgument as err:
            await ctx.send(f" Missing argument: `{err.param.name}` — check `!help {ctx.command.qualified_name}`.")
        except (commands.MissingPermissions, commands.CheckFailure) as err:
            await ctx.send("🚫 You don't meet the requirements for this command here.")
        except commands.CommandInvokeError as err:
            cause = err.original
            from cordchain.utils.embeds import error_embed

            detail = getattr(cause, "detail", str(cause))
            await ctx.send(embed=error_embed("Command failed", f"• Reason: **{detail}**"))
        except commands.CommandError:
            await ctx.send("❌ Command error — try `!help`.")
        finally:
            self.logger.error("Unhandled prefix command error", exc_info=error)

    def _humanize_error_cooldown(self, retry_after: float) -> str:
        return f"⏳ This command is on cooldown. Try again in `{retry_after:.1f}` seconds."

bot = CordChain()

def main():
    if not TOKEN:
        logger.error("❌ [CordChain Bot] No TOKEN found in environment / secrets.")
        logger.error("   👉 Add the TOKEN secret (Discord bot token) in Replit Secrets, then restart this workflow.")
        logger.info("ℹ️ Keeping the workflow idle-exit: nothing further can be done without a token.")
        sys.exit(0)

    try:
        bot.run(TOKEN, log_handler=None)
    except discord.errors.PrivilegedIntentsRequired as e:
        logger.error("❌ [CordChain Bot] Privileged gateway intents are NOT enabled for this application.")
        logger.error("   👉 Open https://discord.com/developers/applications → your app → Bot →")
        logger.error("      enable BOTH 'SERVER MEMBERS INTENT' and 'MESSAGE CONTENT INTENT', then restart.")
        logger.error(f"   (gateway said: {getattr(e, 'auth_kwargs', None) or e})")
        sys.exit(1)
    except discord.errors.LoginFailure:
        logger.error("❌ [CordChain Bot] Discord rejected the TOKEN — it is expired or invalid.")
        logger.error("   👉 Reset the token in the Developer Portal (Bot → Reset Token) and update the TOKEN secret.")
        sys.exit(1)

if __name__ == "__main__":
    main()
