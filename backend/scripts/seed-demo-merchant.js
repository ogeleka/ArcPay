/* ============================================================
   Demo merchant seeder
   ------------------------------------------------------------
   Creates (or refreshes) a ready-made merchant account so anyone
   reviewing ArcPay can sign in with one click and land in a
   populated dashboard — live payments feed, volume, and chart —
   without registering or wiring up a store.

   Run:  node scripts/seed-demo-merchant.js
   Safe to re-run: it upserts the merchant and rebuilds its
   sample payments each time. Idempotent.
   ============================================================ */
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { db, initDb } = require("../src/db");

// Ensure tables exist (no-op if the app already created them).
initDb();

// Must match DEMO_EMAIL / DEMO_PASS in the dashboard's "Explore the demo" button.
const DEMO = {
  name:     "Demo Merchant",
  email:    "demo@arcpay.dev",
  password: "demopay123",
  // Settlement wallet whose on-chain USDC balance the dashboard shows.
  // Override with DEMO_WALLET if you want a funded address; defaults to the
  // fee recipient (which accrues protocol fees, so it usually holds USDC).
  wallet:   process.env.DEMO_WALLET || "0xD4F3Fa924910411aE6aA91cA65cF5cEaC9897b87",
  // Fixed API key + webhook secret so the demo account can be wired to the demo
  // store: put these SAME values in the store's .env (ARCPAY_API_KEY /
  // ARCPAY_WEBHOOK_SECRET) and its payments show up in this dashboard's live feed.
  // Point the webhook at the store's receiver (override with DEMO_WEBHOOK_URL).
  apiKey:        process.env.DEMO_API_KEY        || "arcpay_demo_pk_9f8e7d6c5b4a3210f1e2d3c4b5a69780",
  webhookSecret: process.env.DEMO_WEBHOOK_SECRET || "whsec_demo_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
  webhook:       process.env.DEMO_WEBHOOK_URL    || "https://arc.ogsnap.online/try/arcpay/webhook",
};

function ts(daysAgo, hoursAgo = 0) {
  return new Date(Date.now() - daysAgo * 864e5 - hoursAgo * 36e5)
    .toISOString().replace("T", " ").slice(0, 19);
}
const rid  = () => "0x" + crypto.randomBytes(32).toString("hex");
const addr = () => "0x" + crypto.randomBytes(20).toString("hex");
function fiat(local, rate, currency) {
  return { amount: Math.round((local / rate) * 1e6), currency, amount_ngn: local, rate };
}

(async () => {
  const passwordHash = await bcrypt.hash(DEMO.password, 12);

  let row = db.prepare("SELECT id FROM merchants WHERE email = ?").get(DEMO.email);
  let merchantId;
  if (row) {
    merchantId = row.id;
    db.prepare(
      `UPDATE merchants SET name=?, wallet_address=?, webhook_url=?, password_hash=?,
         default_currency=?, business_type=?, website=?, use_case=? WHERE id=?`
    ).run(DEMO.name, DEMO.wallet, DEMO.webhook, passwordHash,
          "AED", "ecommerce", "https://arc.ogsnap.online", "Sell physical goods", merchantId);
  } else {
    merchantId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO merchants
         (id, name, email, wallet_address, webhook_url, password_hash,
          default_currency, business_type, website, use_case)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(merchantId, DEMO.name, DEMO.email, DEMO.wallet, DEMO.webhook, passwordHash,
          "AED", "ecommerce", "https://arc.ogsnap.online", "Sell physical goods");
  }

  // Force the fixed webhook secret + API key (idempotent — always the same
  // values, so the store's .env and this account stay in sync on every re-seed).
  db.prepare("UPDATE merchants SET webhook_secret = ? WHERE id = ?")
    .run(DEMO.webhookSecret, merchantId);
  const keyHash = crypto.createHash("sha256").update(DEMO.apiKey).digest("hex");
  db.prepare("DELETE FROM api_keys WHERE merchant_id = ?").run(merchantId);
  db.prepare("INSERT INTO api_keys (id, merchant_id, key_hash) VALUES (?, ?, ?)")
    .run(crypto.randomUUID(), merchantId, keyHash);

  // Rebuild sample payments so the dashboard looks alive. Delete child
  // transactions first — payments have a FK from transactions(payment_id) with
  // no cascade, so removing payments directly would fail once any exist.
  db.prepare(
    "DELETE FROM transactions WHERE payment_id IN (SELECT id FROM payments WHERE merchant_id = ?)"
  ).run(merchantId);
  db.prepare("DELETE FROM payments WHERE merchant_id = ?").run(merchantId);
  const samples = [
    { ...fiat(55,    3.6725, "AED"),  status: "paid",    d: 0, h: 2, order: "FOOTIE-2043", email: "aisha@example.ae" },
    { ...fiat(35,    3.6725, "AED"),  status: "paid",    d: 0, h: 5, order: "FOOTIE-2041", email: "omar@example.ae" },
    { ...fiat(28,    3.6725, "AED"),  status: "pending", d: 0, h: 0, order: "FOOTIE-2044", email: "sara@example.ae" },
    { ...fiat(45000, 1550,   "NGN"),  status: "paid",    d: 1, h: 3, order: "NG-8891",     email: "chidi@example.ng" },
    { amount: 5000000,  currency: "USDC", amount_ngn: null, rate: null, status: "paid", d: 1, h: 9, order: "INV-1007", email: "pay@client.com" },
    { ...fiat(80,    3.6725, "AED"),  status: "paid",    d: 2, h: 1, order: "FOOTIE-2035", email: "lina@example.ae" },
    { ...fiat(120000,1550,   "NGN"),  status: "paid",    d: 3, h: 6, order: "NG-8877",     email: "tunde@example.ng" },
    { amount: 12000000, currency: "USDC", amount_ngn: null, rate: null, status: "paid", d: 4, h: 2, order: "INV-1003", email: "invoice@studio.io" },
  ];
  const ins = db.prepare(
    `INSERT INTO payments
       (id, merchant_id, amount, currency, amount_ngn, rate, status,
        order_id, customer_email, payer, tx_hash, paid_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const s of samples) {
    const created = ts(s.d, s.h + 1);
    const paid    = s.status === "paid" ? ts(s.d, s.h) : null;
    ins.run(rid(), merchantId, s.amount, s.currency, s.amount_ngn ?? null, s.rate ?? null,
      s.status, s.order, s.email,
      s.status === "paid" ? addr() : null,
      s.status === "paid" ? rid()  : null,
      paid, created, paid || created);
  }

  const paid = samples.filter(s => s.status === "paid").length;
  console.log(`✅ Demo merchant ready: ${DEMO.email} / ${DEMO.password}`);
  console.log(`   Wallet: ${DEMO.wallet}`);
  console.log(`   Seeded ${samples.length} payments (${paid} paid, ${samples.length - paid} pending).`);
  console.log("");
  console.log("   Wire your demo store to this account so its payments appear here.");
  console.log("   Put these in the store's .env, then restart it:");
  console.log(`     ARCPAY_API_KEY=${DEMO.apiKey}`);
  console.log(`     ARCPAY_WEBHOOK_SECRET=${DEMO.webhookSecret}`);
  console.log(`     ARCPAY_URL=https://arc.ogsnap.online`);
  console.log(`   Demo webhook_url is set to: ${DEMO.webhook}`);
  process.exit(0);
})().catch(err => { console.error("Seed failed:", err); process.exit(1); });
