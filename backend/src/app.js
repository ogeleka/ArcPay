const express = require("express");
const cors    = require("cors");
const path = require("path");
const { db } = require("./db");
const { getRateForCurrency, CURRENCIES } = require("./fx");

const app = express();
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:3003",
    ...(process.env.APP_URL ? [process.env.APP_URL] : []),
    ...(process.env.STORE_URL ? [process.env.STORE_URL] : []),
  ],
  credentials: true,
}));
app.use(express.json());
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

// Serve checkout SPA for all /pay/* routes
app.get("/pay/*", (_, res) =>
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
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
