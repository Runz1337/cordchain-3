#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="$DIR:$PYTHONPATH"
PORT="${PORT:-5000}"

if [ -n "$Client_secret" ] && [ -z "$DISCORD_CLIENT_SECRET" ]; then
    export DISCORD_CLIENT_SECRET="$Client_secret"
fi

exec "$DIR/.venv/bin/uvicorn" cordchain.api:app --host 0.0.0.0 --port "$PORT" --reload
