# ArcPay — Security Tracker

Legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · ✅ Already good

---

## 🔴 CRITICAL

### S1 — JWT_SECRET is a placeholder `backend/.env`
**Risk:** Anyone who knows the default value can forge JWT tokens and impersonate any merchant dashboard session.
**Fix:** Generate a real secret and set it before running:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# paste into backend/.env → JWT_SECRET=<output>
```
**Status:** ✅ Done — replace value in `backend/.env` with the generated key above

---

### S2 — No rate limiting on any endpoint
**Risk:** `/auth/login` can be brute-forced. `/auth/register` can be spammed. `/payments` can be hammered.
**Fix:** Add `express-rate-limit` in `app.js`:
```js
const rateLimit = require("express-rate-limit");
app.use("/auth/login",    rateLimit({ windowMs: 15*60*1000, max: 10  }));
app.use("/auth/register", rateLimit({ windowMs: 60*60*1000, max: 5   }));
app.use("/payments",      rateLimit({ windowMs: 60*1000,    max: 100 }));
```
**Status:** ✅ Done — `express-rate-limit` added in `app.js`

---

## 🟠 HIGH

### S3 — SSRF via merchant webhook URL
**Risk:** A merchant can set `webhook_url` to `http://169.254.169.254/...` (cloud metadata) or any internal service. The backend will POST to it faithfully.
**Fix:** Validate webhook URL before saving — reject non-HTTPS, private IPs, and localhost:
```js
function isSafeWebhookUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname)) return false;
    return true;
  } catch { return false; }
}
```
**Status:** ✅ Done — `isSafeWebhookUrl()` in auth.js + merchants.js (localhost allowed in dev)

---

### S4 — Two separate merchant registration endpoints
**Risk:** `POST /merchants` (old, no auth needed, no password) still exists alongside `/auth/register`. Creates merchants with no login capability and inconsistent records. Confusing surface area.
**Fix:** Remove `POST /merchants` or redirect it to `/auth/register`. The old endpoint in `routes/merchants.js` should be deleted.
**Status:** ✅ Done — `POST /merchants` now returns 410 Gone, directs to `/auth/register`

---

### S5 — No security headers on HTTP responses
**Risk:** No `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`. The served checkout page could be iframed and clickjacked.
**Fix:** Add `helmet` middleware:
```js
const helmet = require("helmet");
app.use(helmet());
```
**Status:** ✅ Done — `helmet` added in `app.js` (CSP disabled for checkout SPA compatibility)

---

### S6 — No input length limits on text fields
**Risk:** `name`, `email`, `website`, `webhook_url` have no max-length check — DB bloat or memory pressure.
**Fix:** Cap field lengths at the route level (e.g. name ≤ 100, email ≤ 254, webhook_url ≤ 500).
**Status:** ✅ Done — length checks added to `/auth/register`

---

## 🟡 MEDIUM

### S7 — JWT tokens are 7-day, non-revocable
**Risk:** A stolen token is valid for 7 days. No logout invalidation, no refresh rotation.
**Fix (minimal):** Shorten to `"24h"`. Full fix: store a `token_version` on the merchant and embed it in the JWT — incrementing it on logout invalidates all old tokens.
**Status:** ✅ Done — changed to `"24h"` in `auth.js`

---

### S8 — `wallet_address` not validated on old `POST /merchants`
**Risk:** Arbitrary strings stored as wallet addresses via the legacy endpoint. Could cause issues in on-chain lookups.
**Fix:** Already validated in `/auth/register` — apply same regex (`/^0x[0-9a-fA-F]{40}$/`) in the legacy route or remove it (see S4).
**Status:** ✅ Done — legacy endpoint removed (S4), register validates wallet format

---

### S9 — Contract: `createPayment()` is open to any caller
**Risk:** Anyone can spam the contract with fake payment IDs. Won't affect real payments (IDs are cryptographically random from the backend) but wastes on-chain storage.
**Fix (future):** Add an `owner` address on the contract and restrict `createPayment` to `require(msg.sender == owner)`.
**Status:** 🟡 Low priority for testnet — address before mainnet

---

### S10 — `markRefunded()` doesn't move funds
**Risk:** Calling `markRefunded` only sets a status flag — it does NOT return funds to the payer. This must be handled off-chain by the merchant manually sending USDC back.
**Fix:** Clearly document this in the API docs. Consider adding a UI note in the dashboard.
**Status:** ❌ Not documented — confusing for integrators

---

### S11 — Error handler logs full error object in production
**Risk:** `console.error(err)` in the global error handler may log sensitive request data (headers, body) to log files.
**Fix:** Log `err.message` and `err.stack` only. Strip request body from logged errors.
**Status:** 🟡 Low risk locally, important before VPS deploy

---

## 🔵 LOW / INFORMATIONAL

### S12 — `schema.sql` is stale
**Description:** `src/schema.sql` reflects the original schema, not the current one (missing `password_hash`, `markup_bps`, `amount_ngn`, etc.). Anyone trying to set up from scratch using this file will get a broken DB.
**Fix:** Regenerate `schema.sql` from the current live DB:
```bash
sqlite3 backend/arcpay.db .schema > backend/src/schema.sql
```
**Status:** ✅ Done — `schema.sql` regenerated to match live DB

---

### S13 — `metadata` field not validated
**Description:** Merchants can store arbitrary JSON in `metadata` on payments. Not rendered in UI currently but worth capping.
**Fix:** Reject if `JSON.stringify(metadata).length > 2048`.
**Status:** 🔵 No immediate risk

---

### S14 — CORS allows `STORE_URL` env var as origin
**Description:** If `STORE_URL` is ever set to a broad value or wildcard, the CORS policy opens up.
**Fix:** Audit what's in `STORE_URL` before going to production. Consider an explicit allowlist instead.
**Status:** 🔵 Fine for local dev

---

## ✅ ALREADY SECURE

| What | Why it's good |
|---|---|
| API keys hashed with SHA-256 before DB storage | Raw key never persisted |
| bcrypt with 12 salt rounds for passwords | Industry standard |
| Timing-safe login (bcrypt runs even on unknown email) | No user enumeration |
| Webhook signature uses HMAC-SHA256 | Standard, verified on Footie's side |
| All DB queries use parameterized statements | No SQL injection surface |
| JWT verified on every authenticated request | Standard Bearer flow |
| Wallet address format validated on register | Rejects garbage addresses |
| `markup_bps` capped at 500 server-side | Can't be abused via API |
| New contract settles atomically — no funds held in escrow | Non-custodial by design |
| Contract status set before transfers — reentrancy safe | Checks-Effects-Interactions ✅ |
| Solidity 0.8.26 — built-in overflow protection | No SafeMath needed |

---

## Priority order before VPS deploy

1. **S1** — Set real JWT_SECRET ← do this right now, 2 minutes
2. **S2** — Add rate limiting ← 15 minutes, npm install + 4 lines
3. **S5** — Add helmet ← 5 minutes, npm install + 1 line
4. **S4** — Remove old `/merchants` registration endpoint ← 5 minutes
5. **S7** — Shorten JWT to 24h ← 1 line change
6. **S3** — Webhook URL validation ← 30 minutes
7. **S12** — Regenerate schema.sql ← 2 minutes
