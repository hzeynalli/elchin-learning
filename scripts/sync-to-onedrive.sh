#!/usr/bin/env bash
# Mirror the repo (without node_modules/.git/.wrangler) plus .env into the personal OneDrive so the office laptop can
# take over. GitHub (hzeynalli/elchin-learning) is the source of truth for code history; OneDrive is the handoff copy.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DST="$HOME/Library/CloudStorage/OneDrive-Personal/90 Claude Workspace/Projects/elchin-learning"
mkdir -p "$DST"
rsync -a --delete --exclude node_modules --exclude .git --exclude .wrangler --exclude .DS_Store "$SRC/" "$DST/"
cp "$SRC/.env" "$DST/.env" 2>/dev/null || true
echo "synced → $DST ($(find "$DST" -type f | wc -l | tr -d ' ') files, $(date '+%H:%M:%S'))"
