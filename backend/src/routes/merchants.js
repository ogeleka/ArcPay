const express = require("express");
const crypto = require("crypto");
const { ethers } = require("ethers");
const { db } = require("../db");
const { requireApiKey } = require("../middleware/auth");

const USDC_ABI = ["function balanceOf(address) view returns (uint256)"];

// Blocks SSRF - only allow HTTPS to public hosts
function isSafeWebhookUrl(raw) {
  if (!raw) return true; // optional field
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const h = u.hostname;
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$)/.test(h)) return false;
    return true;
  } catch { return false; }
}

const router = express.Router();

// POST /merchants - legacy open endpoint removed (use POST /auth/register instead)
router.post("/", (_req, res) => {
  res.status(410).json({ error: "This endpoint is gone. Use POST /auth/register to create an account." });
});

// GET /merchants/me - profile + live on-chain USDC balance
router.get("/me", requireApiKey, async (req, res, next) => {
  try {
    const merchant = db.prepare(
      "SELECT id, name, email, wallet_address, webhook_url, webhook_secret, markup_bps, default_currency, business_type, website, use_case, created_at FROM merchants WHERE id = ?"
    ).get(req.merchantId);

    if (!merchant) return res.status(404).json({ error: "Not found" });

    const stats = db.prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN status IN ('paid','released') THEN amount ELSE 0 END), 0) AS volume
       FROM payments WHERE merchant_id = ?`
    ).get(req.merchantId);

    let usdc_balance = null;
    try {
      const network  = new ethers.Network("arc-testnet", 5042002);
      const req      = new ethers.FetchRequest(process.env.ARC_TESTNET_RPC);
      req.timeout    = 10_000;
      const provider = new ethers.JsonRpcProvider(req, network, { staticNetwork: network });
      const usdc = new ethers.Contract(process.env.ARC_USDC, USDC_ABI, provider);
      const raw = await usdc.balanceOf(merchant.wallet_address);
      usdc_balance = (Number(raw) / 1e6).toFixed(6);
    } catch (_) {}

    res.json({ ...merchant, usdc_balance, total_payments: stats.total, total_volume_usdc: (stats.volume / 1e6).toFixed(6) });
  } catch (err) {
    next(err);
  }
});

// POST /merchants/me/webhook-test - send a fake payment.paid event to webhook URL
router.post("/me/webhook-test", requireApiKey, async (req, res, next) => {
  try {
    const merchant = db.prepare(
      "SELECT webhook_url, webhook_secret FROM merchants WHERE id = ?"
    ).get(req.merchantId);

    if (!merchant?.webhook_url) {
      return res.status(400).json({ error: "No webhook URL configured" });
    }
    if (!merchant.webhook_secret) {
      return res.status(400).json({ error: "No webhook secret - re-register to generate one" });
    }

    const { deliver } = require("../webhook");
    const payload = {
      event:       "payment.paid",
      payment_id:  "0x" + "00".repeat(32),
      order_id:    "test-order-001",
      amount_usdc: 1_000_000,
      amount_ngn:  1550,
      rate:        1550,
      currency:    "USDC",
      status:      "paid",
      payer:       "0x0000000000000000000000000000000000000001",
      tx_hash:     "0x" + "aa".repeat(32),
      timestamp:   new Date().toISOString(),
      test:        true,
    };

    try {
      await deliver(merchant.webhook_url, merchant.webhook_secret, payload);
      res.json({ delivered: true, message: `Test event sent to ${merchant.webhook_url}` });
    } catch {
      res.status(502).json({ delivered: false, message: "Webhook delivery failed after 3 attempts" });
    }
  } catch (err) { next(err); }
});

// POST /merchants/me/rotate-key - invalidate old API key, issue a new one
router.post("/me/rotate-key", requireApiKey, (req, res, next) => {
  try {
    // Delete all existing keys for this merchant
    db.prepare("DELETE FROM api_keys WHERE merchant_id = ?").run(req.merchantId);

    const apiKey  = crypto.randomBytes(32).toString("hex");
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
    db.prepare("INSERT INTO api_keys (id, merchant_id, key_hash) VALUES (?, ?, ?)")
      .run(crypto.randomUUID(), req.merchantId, keyHash);

    res.json({ api_key: apiKey, message: "Previous key revoked. Store this key safely - it won't be shown again." });
  } catch (err) { next(err); }
});

// PATCH /merchants/me - update profile fields, webhook, markup, currency
router.patch("/me", requireApiKey, (req, res, next) => {
  try {
    const { name, email, wallet_address, webhook_url, markup_bps, default_currency } = req.body;

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: "Name cannot be empty" });
      db.prepare("UPDATE merchants SET name = ? WHERE id = ?").run(name.trim(), req.merchantId);
    }
    if (email !== undefined) {
      if (!email.trim()) return res.status(400).json({ error: "Email cannot be empty" });
      const taken = db.prepare("SELECT id FROM merchants WHERE email = ? AND id != ?")
        .get(email.trim().toLowerCase(), req.merchantId);
      if (taken) return res.status(409).json({ error: "That email is already in use" });
      db.prepare("UPDATE merchants SET email = ? WHERE id = ?")
        .run(email.trim().toLowerCase(), req.merchantId);
    }
    if (wallet_address !== undefined) {
      if (!/^0x[0-9a-fA-F]{40}$/.test(wallet_address.trim()))
        return res.status(400).json({ error: "Invalid wallet address" });
      db.prepare("UPDATE merchants SET wallet_address = ? WHERE id = ?")
        .run(wallet_address.trim(), req.merchantId);
    }
    if (webhook_url !== undefined) {
      if (webhook_url && !isSafeWebhookUrl(webhook_url))
        return res.status(400).json({ error: "webhook_url must be an HTTPS URL pointing to a public host" });
      db.prepare("UPDATE merchants SET webhook_url = ? WHERE id = ?")
        .run(webhook_url || null, req.merchantId);
    }
    if (markup_bps !== undefined) {
      const bps = parseInt(markup_bps);
      if (isNaN(bps) || bps < 0 || bps > 500)
        return res.status(400).json({ error: "markup_bps must be 0-500 (max 5%)" });
      db.prepare("UPDATE merchants SET markup_bps = ? WHERE id = ?").run(bps, req.merchantId);
    }
    if (default_currency !== undefined) {
      db.prepare("UPDATE merchants SET default_currency = ? WHERE id = ?")
        .run(String(default_currency).toUpperCase(), req.merchantId);
    }

    res.json({ updated: true });
  } catch (err) { next(err); }
});

module.exports = router;
