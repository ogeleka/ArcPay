#!/usr/bin/env bash
# setup-server.sh — run ONCE on a fresh Ubuntu 22.04 / 24.04 VPS
# Usage: bash setup-server.sh YOUR_DOMAIN
set -euo pipefail

DOMAIN="${1:?Usage: bash setup-server.sh yourdomain.com}"
APP_DIR="/var/www/arcpay"

echo "=== ArcPay server setup for $DOMAIN ==="

# ── 1. System packages ─────────────────────────────────────────────────────────
apt-get update -q
apt-get install -y -q curl git nginx certbot python3-certbot-nginx ufw

# ── 2. Node.js 22 (LTS) via NodeSource ────────────────────────────────────────
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "Node $(node -v) | npm $(npm -v)"

# ── 3. PM2 ────────────────────────────────────────────────────────────────────
npm install -g pm2
pm2 install pm2-logrotate

# ── 4. Log directory ──────────────────────────────────────────────────────────
mkdir -p /var/log/arcpay
chown -R "$SUDO_USER":"$SUDO_USER" /var/log/arcpay 2>/dev/null || true

# ── 5. App directory ──────────────────────────────────────────────────────────
mkdir -p "$APP_DIR"
chown -R "$SUDO_USER":"$SUDO_USER" "$APP_DIR" 2>/dev/null || true

# ── 6. Firewall ───────────────────────────────────────────────────────────────
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ── 7. Nginx placeholder (certbot needs it running first) ─────────────────────
systemctl enable nginx
systemctl start  nginx

# ── 8. Let's Encrypt ──────────────────────────────────────────────────────────
echo ""
echo "=== Obtaining SSL certificate for $DOMAIN ==="
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
  --non-interactive --agree-tos --register-unsafely-without-email \
  --redirect

# ── 9. Install ArcPay nginx config ────────────────────────────────────────────
# (Run this after cloning the repo)
echo ""
echo "=== Next steps ==="
echo "  1. Clone repo:  git clone <your-repo> $APP_DIR"
echo "  2. Edit nginx config: sed -i 's/YOUR_DOMAIN/$DOMAIN/g' $APP_DIR/nginx/arcpay.conf"
echo "  3. Install config: ln -s $APP_DIR/nginx/arcpay.conf /etc/nginx/sites-enabled/arcpay"
echo "  4. Remove default: rm -f /etc/nginx/sites-enabled/default"
echo "  5. Test + reload: nginx -t && systemctl reload nginx"
echo "  6. Run deploy:  bash $APP_DIR/scripts/deploy.sh"
echo ""
echo "=== Setup complete ==="
