const express  = require("express");
const crypto   = require("crypto");
const bcrypt   = require("bcrypt");
const jwt      = require("jsonwebtoken");
const { ethers } = require("ethers");
const { db }   = require("../db");

const router     = express.Router();
const SALT_ROUNDS = 12;
const JWT_EXPIRY  = "24h";

// In-memory nonce store for wallet sign-in: address(lowercase) → { nonce, expires }
const walletNonces = new Map();
const NONCE_TTL_MS = 5 * 60 * 1000;

function buildSignMessage(address, nonce) {
  return `Sign in to ArcPay\n\nWallet: ${address}\nNonce: ${nonce}`;
}

function isSafeWebhookUrl(raw) {
  if (!raw) return true;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const h = u.hostname;
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$)/.test(h)) return false;
    return true;
  } catch { return false; }
}

function signToken(merchantId) {
  return jwt.sign({ merchantId }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

// POST /auth/register
const SUPPORTED_CURRENCIES = new Set(["NGN", "GHS", "ZAR", "KES", "USD", "USDC"]);

router.post("/register", async (req, res, next) => {
  try {
    const {
      name, email, wallet_address, password, webhook_url,
      business_type, website, use_case, default_currency, markup_bps,
    } = req.body;

    if (!name?.trim())                    return res.status(400).json({ error: "Name is required" });
    if (name.trim().length > 100)         return res.status(400).json({ error: "Name must be 100 characters or fewer" });
    if (!email?.trim())                   return res.status(400).json({ error: "Email is required" });
    if (email.trim().length > 254)        return res.status(400).json({ error: "Email too long" });
    if (!wallet_address?.trim())          return res.status(400).json({ error: "Wallet address is required" });
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet_address.trim()))
      return res.status(400).json({ error: "Invalid wallet address" });
    if (!password || password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    if (password.length > 128)
      return res.status(400).json({ error: "Password must be 128 characters or fewer" });
    if (webhook_url && !isSafeWebhookUrl(webhook_url))
      return res.status(400).json({ error: "webhook_url must be an HTTPS URL pointing to a public host" });
    if (website && website.length > 500)
      return res.status(400).json({ error: "Website URL too long" });

    // Optional business profile - validate currency + markup if provided
    const currency = (default_currency || "NGN").toUpperCase();
    if (!SUPPORTED_CURRENCIES.has(currency))
      return res.status(400).json({ error: `Unsupported currency: ${currency}` });

    let markup = 0;
    if (markup_bps !== undefined) {
      markup = parseInt(markup_bps);
      if (isNaN(markup) || markup < 0 || markup > 500)
        return res.status(400).json({ error: "markup_bps must be 0-500 (max 5%)" });
    }

    const existing = db.prepare("SELECT id FROM merchants WHERE email = ?").get(email.trim().toLowerCase());
    if (existing) return res.status(409).json({ error: "An account with that email already exists" });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const merchantId   = crypto.randomUUID();

    db.prepare(
      `INSERT INTO merchants
         (id, name, email, wallet_address, webhook_url, password_hash,
          business_type, website, use_case, default_currency, markup_bps)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      merchantId, name.trim(), email.trim().toLowerCase(), wallet_address.trim(),
      webhook_url?.trim() || null, passwordHash,
      business_type?.trim() || null, website?.trim() || null, use_case?.trim() || null,
      currency, markup,
    );

    // Generate API key + webhook secret
    const apiKey       = crypto.randomBytes(32).toString("hex");
    const keyHash      = crypto.createHash("sha256").update(apiKey).digest("hex");
    const webhookSecret = crypto.randomBytes(24).toString("hex");

    db.prepare("INSERT INTO api_keys (id, merchant_id, key_hash) VALUES (?, ?, ?)")
      .run(crypto.randomUUID(), merchantId, keyHash);
    db.prepare("UPDATE merchants SET webhook_secret = ? WHERE id = ?")
      .run(webhookSecret, merchantId);

    const token = signToken(merchantId);

    res.status(201).json({
      token,
      merchant_id:     merchantId,
      api_key:         apiKey,
      webhook_secret:  webhookSecret,
    });
  } catch (err) { next(err); }
});

// POST /auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    const merchant = db.prepare(
      "SELECT id, password_hash FROM merchants WHERE email = ?"
    ).get(email.trim().toLowerCase());

    // Timing-safe: always run bcrypt even on miss to avoid user enumeration
    const hashToCheck = merchant?.password_hash ?? "$2b$12$invalidhashpaddinginvalidhashpaddinginvalidhashpadding";
    const match = await bcrypt.compare(password, hashToCheck);

    if (!merchant || !match)
      return res.status(401).json({ error: "Incorrect email or password" });

    res.json({ token: signToken(merchant.id) });
  } catch (err) { next(err); }
});

// POST /auth/wallet/nonce
// Step 1 of wallet sign-in: client requests a nonce to sign.
router.post("/wallet/nonce", (req, res) => {
  const { address } = req.body;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address))
    return res.status(400).json({ error: "Valid wallet address required" });

  const addr  = address.toLowerCase();
  const nonce = crypto.randomBytes(16).toString("hex");
  walletNonces.set(addr, { nonce, expires: Date.now() + NONCE_TTL_MS });

  res.json({ nonce, message: buildSignMessage(address, nonce) });
});

// POST /auth/wallet/login
// Step 2: client sends the signature; we verify it and issue a JWT.
router.post("/wallet/login", (req, res, next) => {
  try {
    const { address, signature } = req.body;
    if (!address || !signature)
      return res.status(400).json({ error: "address and signature are required" });

    const addr  = address.toLowerCase();
    const entry = walletNonces.get(addr);
    if (!entry || entry.expires < Date.now()) {
      walletNonces.delete(addr);
      return res.status(401).json({ error: "Nonce expired - please try again" });
    }

    // Verify the signature recovers to the claimed address
    const message = buildSignMessage(address, entry.nonce);
    let recovered;
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch {
      return res.status(401).json({ error: "Invalid signature" });
    }
    if (recovered.toLowerCase() !== addr) {
      return res.status(401).json({ error: "Signature does not match wallet" });
    }

    // One-time use
    walletNonces.delete(addr);

    // Find the merchant linked to this wallet
    const merchant = db.prepare(
      "SELECT id FROM merchants WHERE lower(wallet_address) = ?"
    ).get(addr);

    if (!merchant) {
      return res.status(404).json({ error: "No account is linked to this wallet. Sign up with email first, then this wallet will log you in." });
    }

    res.json({ token: signToken(merchant.id) });
  } catch (err) { next(err); }
});

// POST /auth/change-password
// Requires current password - no silent resets.
router.post("/change-password", async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"] ?? "";
    if (!authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "Authentication required" });

    let merchantId;
    try {
      const payload = require("jsonwebtoken").verify(authHeader.slice(7), process.env.JWT_SECRET);
      merchantId = payload.merchantId;
    } catch {
      return res.status(401).json({ error: "Session expired - please sign in again" });
    }

    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ error: "current_password and new_password are required" });
    if (new_password.length < 8)
      return res.status(400).json({ error: "New password must be at least 8 characters" });

    const merchant = db.prepare("SELECT password_hash FROM merchants WHERE id = ?").get(merchantId);
    if (!merchant) return res.status(404).json({ error: "Account not found" });

    const match = await bcrypt.compare(current_password, merchant.password_hash ?? "");
    if (!match) return res.status(401).json({ error: "Current password is incorrect" });

    const newHash = await bcrypt.hash(new_password, SALT_ROUNDS);
    db.prepare("UPDATE merchants SET password_hash = ? WHERE id = ?").run(newHash, merchantId);

    res.json({ updated: true });
  } catch (err) { next(err); }
});

module.exports = router;
