/**
 * PM2 process manager config for ArcPay.
 *
 * Start:   pm2 start pm2.ecosystem.config.js --env production
 * Save:    pm2 save          (persist across reboots)
 * Boot:    pm2 startup       (then run the command it prints)
 * Logs:    pm2 logs
 * Status:  pm2 status
 */

const APP_DIR = "/var/www/arcpay";

module.exports = {
  apps: [
    // ── ArcPay backend API + on-chain listener ────────────────────────────────
    {
      name:          "arcpay-backend",
      script:        "index.js",
      cwd:           `${APP_DIR}/backend`,
      instances:     1,           // keep 1 — the SQLite file can't be shared
      autorestart:   true,
      watch:         false,
      max_memory_restart: "300M",
      restart_delay: 3000,
      env_production: {
        NODE_ENV:          "production",
        PORT:              3001,
        NGN_SERVICE_URL:   "http://localhost:3002",
        // Safety-net fallback rates — used if FX service is unreachable
        // Update these periodically to stay within ~5% of market rate
        NGN_FALLBACK_RATE: 1365,
        GHS_FALLBACK_RATE: 12,
        KES_FALLBACK_RATE: 130,
        ZAR_FALLBACK_RATE: 17,
        // Set these in .env.production — never put real values here
        // JWT_SECRET, ARCPAY_ADDRESS, ARC_TESTNET_RPC, ARC_USDC, APP_URL
      },
      error_file: "/var/log/arcpay/backend-error.log",
      out_file:   "/var/log/arcpay/backend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },

    // ── FX micro-service (NGN, GHS, KES, ZAR) ────────────────────────────────
    {
      name:          "arcpay-ngn",
      script:        "server.js",
      cwd:           `${APP_DIR}/ngn`,
      instances:     1,
      autorestart:   true,
      watch:         false,
      max_memory_restart: "100M",
      restart_delay: 5000,        // start after backend so backend doesn't race it
      env_production: {
        NODE_ENV:          "production",
        NGN_PORT:          3002,
        // Same fallbacks as backend — FX service uses these if open.er-api.com is down
        NGN_FALLBACK_RATE: 1365,
        GHS_FALLBACK_RATE: 12,
        KES_FALLBACK_RATE: 130,
        ZAR_FALLBACK_RATE: 17,
      },
      error_file: "/var/log/arcpay/ngn-error.log",
      out_file:   "/var/log/arcpay/ngn-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
