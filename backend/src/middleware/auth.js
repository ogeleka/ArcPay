const crypto = require("crypto");
const jwt    = require("jsonwebtoken");
const { db } = require("../db");

// Accepts EITHER:
//   Authorization: Bearer <jwt>   ← dashboard sessions
//   X-Api-Key: <api_key>          ← server-to-server (merchant backends)
function requireApiKey(req, res, next) {
  const authHeader = req.headers["authorization"] ?? "";
  const apiKeyHeader = req.headers["x-api-key"];

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.merchantId = payload.merchantId;
      return next();
    } catch {
      return res.status(401).json({ error: "Session expired - please sign in again" });
    }
  }

  if (apiKeyHeader) {
    const keyHash = crypto.createHash("sha256").update(apiKeyHeader).digest("hex");
    const row = db.prepare("SELECT merchant_id FROM api_keys WHERE key_hash = ?").get(keyHash);
    if (!row) return res.status(401).json({ error: "Invalid API key" });
    req.merchantId = row.merchant_id;
    return next();
  }

  return res.status(401).json({ error: "Authentication required - provide Authorization: Bearer <token> or X-Api-Key header" });
}

// The shared demo account is open to anyone, so its destructive actions
// (rotate key, change password, edit profile/webhook) are blocked — otherwise
// one reviewer could rotate the key or change the password and break the demo
// for everyone else. Read-only exploration stays fully available.
const DEMO_EMAIL = "demo@arcpay.dev";
function isDemoMerchant(merchantId) {
  const m = db.prepare("SELECT email FROM merchants WHERE id = ?").get(merchantId);
  return !!m && m.email === DEMO_EMAIL;
}
function blockDemo(req, res, next) {
  if (isDemoMerchant(req.merchantId)) {
    return res.status(403).json({ error: "This action is disabled on the shared demo account." });
  }
  next();
}

module.exports = { requireApiKey, blockDemo, isDemoMerchant, DEMO_EMAIL };
