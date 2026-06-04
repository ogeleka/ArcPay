#!/usr/bin/env bash
# deploy.sh — pull latest code, build, and restart services.
# Run from: /var/www/arcpay  OR  bash /var/www/arcpay/scripts/deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "=== Deploying ArcPay from $APP_DIR ==="

cd "$APP_DIR"

# ── 1. Pull latest ─────────────────────────────────────────────────────────────
echo "[1/5] git pull..."
git pull --rebase origin main

# ── 2. Backend deps ────────────────────────────────────────────────────────────
echo "[2/5] Backend npm ci..."
cd "$APP_DIR/backend"
npm ci --omit=dev

# ── 3. NGN service deps ────────────────────────────────────────────────────────
echo "[3/5] NGN service npm ci..."
cd "$APP_DIR/ngn"
npm ci --omit=dev

# ── 4. Frontend build ──────────────────────────────────────────────────────────
echo "[4/5] Frontend build..."
cd "$APP_DIR/frontend"
npm ci
npm run build          # outputs to frontend/dist/

# ── 5. Restart services ────────────────────────────────────────────────────────
echo "[5/5] Restarting services..."
cd "$APP_DIR"
pm2 restart pm2.ecosystem.config.js --env production 2>/dev/null \
  || pm2 start pm2.ecosystem.config.js --env production
pm2 save

echo ""
echo "=== Deploy complete ==="
pm2 status
