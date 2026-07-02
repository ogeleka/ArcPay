#!/usr/bin/env bash
# ============================================================
# Deploy the ArcPay frontend — run this ON THE VPS.
# Pulls latest, installs deps if needed, and builds straight into
# the directory nginx serves (frontend/dist). No rsync, no restart:
# nginx serves the fresh static files the moment the build finishes.
#
# Usage (on the VPS):
#   cd /var/www/arcpay && ./scripts/deploy-frontend.sh
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."          # repo root
echo "→ Pulling latest…"
git pull --ff-only

cd frontend
echo "→ Installing deps (fast if unchanged)…"
npm install --no-audit --no-fund

echo "→ Building…"
# Give Node extra heap so the build won't OOM on a busy server.
NODE_OPTIONS=--max-old-space-size=2048 npm run build

echo "✅ Built to $(pwd)/dist — nginx serves it directly. Hard-refresh the site."
