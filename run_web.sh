#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pnpm --dir "$DIR" --filter @cordchain/web-ui dev
