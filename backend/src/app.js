const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");
const path      = require("path");
const { db }    = require("./db");
const { getRateForCurrency, CURRENCIES } = require("./fx");

const app = express();

// Security headers
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled — checkout page loads external scripts

// CORS — explicit allowlist only
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3003",
  ...(process.env.APP_URL  ? [process.env.APP_URL]  : []),
  ...(process.env.STORE_URL ? [process.env.STORE_URL] : []),
].filter(Boolean);

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));

// Rate limiting
const limiter = (max, windowMin) => rateLimit({
  windowMs: windowMin * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please slow down." },
});

app.use("/auth/login",    limiter(10, 15));  // 10 attempts per 15 min
app.use("/auth/register", limiter(5,  60));  // 5 registrations per hour
app.use("/payments",      limiter(120, 1));  // 120 creates/reads per min per IP

app.use(express.json({ limit: "64kb" })); // reject oversized payloads
app.use(express.static(path.join(__dirname, "..", "public")));

// Public: payment details the checkout page needs (no API key required)
app.get("/api/pay/:id", (req, res) => {
  const row = db.prepare(
    `SELECT p.id, p.amount, p.currency, p.amount_ngn, p.rate, p.markup_bps, p.mid_rate,
            p.status, p.payer, p.expires_at, p.order_id,
            m.wallet_address AS merchant_address, m.name AS merchant_name
     FROM payments p JOIN merchants m ON m.id = p.merchant_id
     WHERE p.id = ?`
  ).get(req.params.id);

  if (!row) return res.status(404).json({ error: "Payment not found" });

  // Compute expiry on-the-fly — no contract change needed
  const expired = row.status === "pending" && row.expires_at && new Date(row.expires_at) < new Date();
  const status  = expired ? "expired" : row.status;

  res.json({
    payment_id:       row.id,
    amount:           String(row.amount),     // USDC base units
    amount_ngn:       row.amount_ngn,         // whole local amount, may be null
    rate:             row.rate,               // locked FX rate, may be null
    markup_bps:       row.markup_bps ?? 0,    // merchant FX markup applied at create time
    mid_rate:         row.mid_rate,           // mid-market rate before markup, may be null
    currency:         row.currency || "USDC",
    status,
    expires_at:       row.expires_at,
    payer:            row.payer,
    order_id:         row.order_id,
    merchant_name:    row.merchant_name,
    merchant_address: row.merchant_address,
    arcpay_address:   process.env.ARCPAY_ADDRESS,
    usdc_address:     process.env.ARC_USDC,
  });
});

// Serve checkout SPA for all /pay/* and /checkout/* routes
app.get(["/pay/*", "/checkout/*"], (_, res) =>
  res.sendFile(path.join(__dirname, "..", "public", "checkout.html"))
);

// Dashboard
app.get(["/", "/dashboard"], (_, res) =>
  res.sendFile(path.join(__dirname, "..", "public", "dashboard.html"))
);;

// Public: live FX rates for the supported markets (landing page + checkout)
app.get("/api/rates", async (_req, res) => {
  const out = {};
  for (const code of Object.keys(CURRENCIES)) {
    const { rate, stale } = await getRateForCurrency(code);
    out[code] = { rate, stale, symbol: CURRENCIES[code].symbol, name: CURRENCIES[code].name };
  }
  res.json({ rates: out, fetched_at: new Date().toISOString() });
});

app.get("/health", (_, res) => res.json({ ok: true }));
app.use("/auth", require("./routes/auth"));
app.use("/merchants", require("./routes/merchants"));
app.use("/payments", require("./routes/payments"));

app.use((err, req, res, next) => {
  console.error(`[error] ${req.method} ${req.path} — ${err.message}`);
  if (process.env.NODE_ENV !== "production") console.error(err.stack);
  res.status(err.status ?? 500).json({ error: "Internal server error" });
});

module.exports = app;
