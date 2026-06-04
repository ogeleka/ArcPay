/**
 * FX micro-service
 *
 * GET /rate?currency=NGN   → { currency, rate, stale, fetchedAt }
 * GET /rates               → { rates: { NGN: 1361, GHS: 11.8, … }, stale, fetchedAt }
 * GET /convert?usdc=&currency=NGN → { usdc, local, currency, rate, stale }
 */

import "dotenv/config";
import express from "express";
import { getRate, getNgnRate, SUPPORTED } from "./fx.js";

const app  = express();
const PORT = process.env.NGN_PORT || 3002;

// GET /rate?currency=NGN (default NGN for backwards compatibility)
app.get("/rate", async (req, res) => {
  const currency = (req.query.currency ?? "NGN").toUpperCase();
  try {
    const { rate, stale, fetchedAt } = await getRate(currency);
    // keep usdToNgn field so the backend's fx.js fallback still works
    res.json({ currency, rate, usdToNgn: rate, stale, fetchedAt });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /rates — all supported currencies in one shot
app.get("/rates", async (_req, res) => {
  const results = {};
  let anyStale = false;
  let fetchedAt = null;

  for (const code of Object.keys(SUPPORTED)) {
    const r = await getRate(code);
    results[code] = r.rate;
    if (r.stale) anyStale = true;
    if (r.fetchedAt) fetchedAt = r.fetchedAt;
  }

  res.json({ rates: results, stale: anyStale, fetchedAt });
});

// GET /convert?usdc=1000000&currency=NGN
app.get("/convert", async (req, res) => {
  const raw      = req.query.usdc;
  const currency = (req.query.currency ?? "NGN").toUpperCase();

  if (raw === undefined || isNaN(Number(raw)) || Number(raw) < 0) {
    return res.status(400).json({ error: "usdc query param required (base units)" });
  }

  try {
    const { rate, stale, fetchedAt } = await getRate(currency);
    const usdc  = Number(raw) / 1_000_000;
    const local = rate !== null ? Math.round(usdc * rate) : null;
    res.json({ usdc: Number(raw), local, currency, rate, stale, fetchedAt });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`FX service → http://localhost:${PORT}`);
  console.log(`Supported: ${Object.keys(SUPPORTED).join(", ")}`);
});
