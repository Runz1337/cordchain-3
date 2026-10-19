#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="$DIR:$PYTHONPATH"

# Prefer the project venv; fall back to system python with dependencies
# installed on demand so a missing venv can never silently kill the workflow.
PY="$DIR/.venv/bin/python3"
if [ ! -x "$PY" ]; then
    echo "⚠️ [run_bot.sh] No .venv found — falling back to system python3 and installing requirements..."
    python3 -m pip install --quiet -r "$DIR/requirements.txt" || true
    PY="$(command -v python3)"
fi

if "$PY" -c "import discord, asyncpg" 2>/dev/null; then
    echo "✅ [run_bot.sh] discord.py + asyncpg present."
else
    echo "⚠️ [run_bot.sh] Dependencies missing — restoring from requirements.txt..."
    "$PY" -m pip install --quiet -r "$DIR/requirements.txt"
fi

if [ -z "$TOKEN" ] && [ -z "$DISCORD_TOKEN" ]; then
    echo ""
    echo "❌ [run_bot.sh] No TOKEN secret found."
    echo "   Add it in the Replit Secrets tab (key: TOKEN, value: your Discord bot token),"
    echo "   then start the Discord Bot workflow again."
    echo ""
fi

exec "$PY" -m cordchain.bot
