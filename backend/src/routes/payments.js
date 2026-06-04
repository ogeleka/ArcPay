const express = require("express");
const crypto  = require("crypto");
const { db }  = require("../db");
const { requireApiKey } = require("../middleware/auth");
const { getRateForCurrency, getNgnRate, fiatToUsdc, usdcToFiat, CURRENCIES } = require("../fx");

const EXPIRY_MS = 15 * 60 * 1000;
const VALID_STATUSES = new Set(["pending", "paid", "expired", "refunded", "released", "all"]);
const router = express.Router();

function applyExpiry(row) {
  if (row && row.status === "pending" && row.expires_at && new Date(row.expires_at) < new Date()) {
    return { ...row, status: "expired" };
  }
  return row;
}

// ── POST /payments ─────────────────────────────────────────────────────────
// Body: { amount, currency?, order_id?, customer_email?, callback_url?, metadata? }
//   currency omitted or "USDC" → amount is USDC micro-units (1 USDC = 1 000 000)
//   currency "NGN" (or any supported fiat) → amount is whole local units
router.post("/", requireApiKey, async (req, res, next) => {
  try {
    const {
      amount,
      currency,
      order_id,
      customer_email,
      callback_url,
      metadata,
    } = req.body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: "amount required and must be > 0" });
    }
    if (metadata && JSON.stringify(metadata).length > 2048) {
      return res.status(400).json({ error: "metadata must be 2 KB or less" });
    }

    // Fetch merchant for markup_bps
    const merchant = db.prepare(
      "SELECT markup_bps, default_currency FROM merchants WHERE id = ?"
    ).get(req.merchantId);

    // Determine effective currency: explicit > merchant default > USDC
    const effectiveCurrency = (currency?.toUpperCase() || merchant?.default_currency || "USDC");
    const isFiat    = effectiveCurrency !== "USDC" && !!CURRENCIES[effectiveCurrency];
    const markupBps = merchant?.markup_bps ?? 0;

    if (currency && !isFiat && effectiveCurrency !== "USDC") {
      return res.status(400).json({ error: `Unsupported currency: ${effectiveCurrency}. Supported: USDC, ${Object.keys(CURRENCIES).join(", ")}` });
    }

    let amountUsdc, amountLocal, lockedRate, midRate;

    if (isFiat) {
      const { rate } = await getRateForCurrency(effectiveCurrency);
      if (!rate) {
        return res.status(503).json({
          error: `FX rate for ${effectiveCurrency} unavailable — set ${effectiveCurrency}_FALLBACK_RATE in .env`,
        });
      }
      midRate     = rate;
      amountLocal = Number(amount);
      // Surcharge the local amount THEN divide — markup goes to merchant, never fewer USDC
      amountUsdc  = Math.ceil((amountLocal * (1 + markupBps / 10000)) / midRate * 1_000_000);
      lockedRate  = midRate;
    } else {
      amountUsdc  = Number(amount);
      const { rate } = await getNgnRate();
      midRate     = rate ?? null;
      lockedRate  = midRate;
      amountLocal = midRate ? usdcToFiat(amountUsdc, midRate) : null;
    }

    const paymentId = "0x" + crypto.randomBytes(32).toString("hex");
    const appUrl    = process.env.APP_URL || "http://localhost:3000";
    const expiresAt = new Date(Date.now() + EXPIRY_MS).toISOString();

    db.prepare(
      `INSERT INTO payments
         (id, merchant_id, amount, currency, amount_ngn, rate,
          markup_bps, mid_rate,
          order_id, customer_email, callback_url, metadata, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      paymentId, req.merchantId, amountUsdc, effectiveCurrency,
      isFiat ? amountLocal : amountLocal,
      lockedRate, markupBps, midRate,
      order_id ?? null, customer_email ?? null, callback_url ?? null,
      metadata ? JSON.stringify(metadata) : null, expiresAt,
    );

    const response = {
      payment_id:  paymentId,
      amount_usdc: String(amountUsdc),
      currency:    effectiveCurrency,
      order_id:    order_id ?? null,
      status:      "pending",
      expires_at:  expiresAt,
      payment_url: `${appUrl}/checkout/${paymentId}`,
    };
    if (isFiat) {
      response.amount_local  = amountLocal;
      response.rate          = lockedRate;
      response.markup_bps    = markupBps;
    }
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

// ── GET /payments ──────────────────────────────────────────────────────────
// Query params:
//   status  = paid|pending|expired|refunded|released|all  (default: all)
//   page    = 1-based page number  (default: 1)
//   limit   = rows per page 1–100  (default: 25)
router.get("/", requireApiKey, (req, res) => {
  const rawStatus = (req.query.status ?? "all").toLowerCase();
  if (!VALID_STATUSES.has(rawStatus)) {
    return res.status(400).json({ error: `status must be one of: ${[...VALID_STATUSES].join(", ")}` });
  }

  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
  const offset = (page - 1) * limit;
  const q = (req.query.q ?? "").trim();

  // Build WHERE clause — expiry is computed on-the-fly for "expired" filter
  let where = "merchant_id = ?";
  const params = [req.merchantId];

  if (rawStatus === "expired") {
    where += " AND status = 'pending' AND expires_at IS NOT NULL AND expires_at <= datetime('now')";
  } else if (rawStatus !== "all") {
    where += " AND status = ?";
    params.push(rawStatus);
  }

  // Search by payment ID or order ID (substring match)
  if (q) {
    where += " AND (p.id LIKE ? OR p.order_id LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) AS n FROM payments p WHERE ${where}`).get(...params).n;

  const rows = db.prepare(
    `SELECT p.id, p.amount, p.currency, p.amount_ngn, p.rate, p.markup_bps,
            p.status, p.order_id, p.payer, p.expires_at,
            p.created_at, p.updated_at, p.paid_at,
            t.tx_hash
     FROM payments p
     LEFT JOIN transactions t ON t.payment_id = p.id AND t.event_type = 'PaymentPaid'
     WHERE ${where}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset).map(applyExpiry);

  res.json({
    data:     rows,
    page,
    limit,
    total,
    has_more: offset + rows.length < total,
  });
});

// ── GET /payments/:id ──────────────────────────────────────────────────────
router.get("/:id", requireApiKey, (req, res) => {
  const row = db.prepare(
    `SELECT p.id, p.amount, p.currency, p.amount_ngn, p.rate, p.markup_bps,
            p.status, p.order_id, p.payer, p.expires_at,
            p.created_at, p.updated_at, p.paid_at,
            t.tx_hash
     FROM payments p
     LEFT JOIN transactions t ON t.payment_id = p.id AND t.event_type = 'PaymentPaid'
     WHERE p.id = ? AND p.merchant_id = ?`
  ).get(req.params.id, req.merchantId);

  if (!row) return res.status(404).json({ error: "Payment not found" });
  res.json(applyExpiry(row));
});

module.exports = router;
