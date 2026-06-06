# ArcPay — Deployment Guide

Full production deployment on a VPS with nginx + HTTPS + pm2.

**Estimated time: ~45 minutes** (mostly waiting for DNS propagation and certbot).

---

## Prerequisites

| What | Where to get |
|---|---|
| VPS (Ubuntu 22.04/24.04) | DigitalOcean, Hetzner, Linode, AWS Lightsail |
| Domain name | Namecheap, Cloudflare, GoDaddy |
| Arc testnet keys | From your `.env` file |
| WalletConnect project ID | `67da330f38709c39af17bb92658b9e20` (yours) |

---

## Step 1 — Point your domain at the VPS

In your DNS provider's dashboard, add:
```
A    arcpay.yourdomain.com    → YOUR_VPS_IP
A    www.arcpay.yourdomain.com → YOUR_VPS_IP
```

Wait for propagation (2–10 min with Cloudflare, up to 48 h elsewhere).  
Check: `nslookup arcpay.yourdomain.com`

---

## Step 2 — Initial server setup

SSH into your VPS as root or a sudo user, then:

```bash
# Download and run the setup script
curl -O https://raw.githubusercontent.com/ogeleka/ArcPay/main/scripts/setup-server.sh
bash setup-server.sh arcpay.yourdomain.com
```

The script installs: **Node 22, nginx, certbot, pm2, ufw**.  
It also runs certbot to issue your SSL certificate.

---

## Step 3 — Clone the repo

```bash
cd /var/www
git clone https://github.com/ogeleka/ArcPay.git arcpay
cd arcpay
```

---

## Step 4 — Configure production `.env` files

### Backend
```bash
cp backend/.env.production.example backend/.env
nano backend/.env
```
Fill in:
```
APP_URL=https://arcpay.yourdomain.com
ARC_TESTNET_RPC=https://rpc.testnet.arc.network
ARC_USDC=0x3600000000000000000000000000000000000000
ARCPAY_ADDRESS=0xF5f8e51425cA2240c4cBbEb964b0d1f480A7cDef
PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
NGN_FALLBACK_RATE=1600
```

### NGN service
```bash
cp ngn/.env.production.example ngn/.env
nano ngn/.env          # set NGN_FALLBACK_RATE
```

### Frontend (baked into the build)
```bash
cp frontend/.env.production.example frontend/.env.production
nano frontend/.env.production
```
Fill in:
```
VITE_API_URL=https://arcpay.yourdomain.com
VITE_ARCPAY_ADDRESS=0xF5f8e51425cA2240c4cBbEb964b0d1f480A7cDef
VITE_WALLETCONNECT_PROJECT_ID=67da330f38709c39af17bb92658b9e20
```

---

## Step 5 — Set up nginx

```bash
# Replace placeholder domain in config
sed -i "s/YOUR_DOMAIN/arcpay.yourdomain.com/g" /var/www/arcpay/nginx/arcpay.conf

# Install config
ln -sf /var/www/arcpay/nginx/arcpay.conf /etc/nginx/sites-enabled/arcpay

# Remove default nginx site
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t && systemctl reload nginx
```

---

## Step 6 — First deploy

```bash
cd /var/www/arcpay
bash scripts/deploy.sh
```

This will:
1. `git pull`
2. `npm ci` for backend + ngn
3. `npm run build` for the frontend (uses `frontend/.env.production`)
4. `pm2 start` all processes

---

## Step 7 — Survive reboots

```bash
pm2 startup          # prints a command — copy and run it
pm2 save             # freeze current process list
```

---

## Step 8 — Smoke test

```bash
# Health check
curl https://arcpay.yourdomain.com/health
# → {"ok":true}

# NGN rate (via backend proxy — or hit :3002 directly on the server)
curl https://arcpay.yourdomain.com/ngn/rate  # (if you uncommented the proxy block)

# Test merchant registration
curl -X POST https://arcpay.yourdomain.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"testpass123","wallet_address":"0xYOUR_WALLET"}'
```

Open `https://arcpay.yourdomain.com` in a browser — the landing page should load over HTTPS with the padlock.

---

## Ongoing deploys

Every time you push new code:

```bash
ssh user@YOUR_VPS_IP
cd /var/www/arcpay && bash scripts/deploy.sh
```

Or set up a GitHub Actions workflow to SSH in and run `deploy.sh` automatically.

---

## Monitoring

```bash
pm2 status                         # process list
pm2 logs arcpay-backend --lines 50 # recent log lines
pm2 monit                          # real-time CPU/memory

# Nginx logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### Free uptime monitoring

Sign up at [UptimeRobot](https://uptimerobot.com) (free) and add:
- HTTP(s) monitor → `https://arcpay.yourdomain.com/health`
- Alert: email when down

---

## SSL renewal

Certbot auto-renews. Verify the cron/timer is active:

```bash
systemctl status certbot.timer
# or
certbot renew --dry-run
```

---

## Troubleshooting

| Symptom | Check |
|---|---|
| 502 Bad Gateway | `pm2 status` — is arcpay-backend running? Check `pm2 logs arcpay-backend` |
| SSL not working | `certbot renew --dry-run`; check DNS is pointing at the VPS |
| Listener not updating DB | Check `pm2 logs arcpay-backend` for `[listener] poll error` — often an RPC timeout |
| NGN rate stale | `pm2 logs arcpay-ngn`; set `NGN_FALLBACK_RATE` as a floor |
| Frontend shows old build | Run `bash scripts/deploy.sh` to rebuild; Ctrl+Shift+R in browser |

---

## Architecture on the VPS

```
Internet
    │
   443 (HTTPS)
    │
  nginx
    ├── /  → /var/www/arcpay/frontend/dist (static React build)
    └── /api, /merchants, /payments, /health → localhost:3001 (Express)
         │
    pm2 keeps alive:
         ├── arcpay-backend (port 3001) — API + SQLite + event listener
         └── arcpay-ngn     (port 3002) — NGN FX service (internal only)
```

The event listener runs **inside** `arcpay-backend` (same process), so pm2 restarts both together if the process crashes. This is intentional — simpler than managing two services for the same concern.
