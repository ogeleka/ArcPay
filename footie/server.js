require("dotenv").config();
const express = require("express");
const crypto  = require("crypto");

const app = express();
const PORT        = process.env.PORT        || 3100;
const BASE        = (process.env.BASE_PATH  || "/demo").replace(/\/$/, "");
const ARCPAY_URL  = process.env.ARCPAY_URL  || "http://localhost:3001";
const STORE_URL   = process.env.STORE_URL   || `http://localhost:${PORT}${BASE}`;
const API_KEY     = process.env.ARCPAY_API_KEY;
const WH_SECRET   = process.env.ARCPAY_WEBHOOK_SECRET;

// ── Products ────────────────────────────────────────────────────────────────
const PRODUCTS = [
  { id: "lagos-runner",     name: "Lagos Runner",           price_ngn: 4500, emoji: "👟", desc: "Lightweight mesh, built for the city grind." },
  { id: "eko-slide",        name: "Eko Slide",              price_ngn: 2800, emoji: "🩴", desc: "All-day comfort, island style." },
  { id: "vi-hightop",       name: "Victoria Island Hi-Top", price_ngn: 6200, emoji: "👢", desc: "Statement fit for the mainland flex." },
];

// ── In-memory order store ───────────────────────────────────────────────────
const orders = new Map();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(`${BASE}/arcpay/webhook`, express.raw({ type: "application/json" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ── HTML helpers ────────────────────────────────────────────────────────────
function shell(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Footie Lagos</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           background: #f9f6f0; color: #1a1a1a; min-height: 100vh; }
    header { background: #1a1a1a; color: #fff; padding: 1rem 2rem;
             display: flex; align-items: center; gap: 1rem; }
    header h1 { font-size: 1.4rem; letter-spacing: -0.5px; }
    header span { font-size: 1.6rem; }
    main { max-width: 960px; margin: 0 auto; padding: 2rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; }
    .card { background: #fff; border-radius: 12px; padding: 1.5rem;
            box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    .card .emoji { font-size: 3rem; margin-bottom: .75rem; }
    .card h2 { font-size: 1.1rem; margin-bottom: .4rem; }
    .card p  { font-size: .875rem; color: #666; margin-bottom: 1rem; }
    .card .price { font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; }
    .btn { display: inline-block; background: #1a1a1a; color: #fff;
           border: none; border-radius: 8px; padding: .7rem 1.4rem;
           font-size: .95rem; font-weight: 600; cursor: pointer;
           text-decoration: none; width: 100%; text-align: center; }
    .btn:hover { background: #333; }
    .btn.secondary { background: #f0ebe3; color: #1a1a1a; }
    .btn.secondary:hover { background: #e0d9cf; }
    .status-box { background: #fff; border-radius: 12px; padding: 2rem;
                  box-shadow: 0 2px 8px rgba(0,0,0,.08); max-width: 480px; margin: 0 auto; }
    .status-box .icon { font-size: 3rem; margin-bottom: 1rem; text-align: center; }
    .status-box h2 { font-size: 1.3rem; margin-bottom: .5rem; text-align: center; }
    .status-box p  { color: #666; text-align: center; margin-bottom: 1.5rem; }
    .tag { display: inline-block; padding: .25rem .75rem; border-radius: 99px;
           font-size: .8rem; font-weight: 700; text-transform: uppercase;
           letter-spacing: .5px; }
    .tag.pending { background: #fff3cd; color: #856404; }
    .tag.paid    { background: #d1e7dd; color: #0a5c36; }
    .meta { font-size: .8rem; color: #999; margin-top: .5rem; }
    .center { text-align: center; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner { display: inline-block; width: 1.2rem; height: 1.2rem;
               border: 3px solid #ddd; border-top-color: #1a1a1a;
               border-radius: 50%; animation: spin .8s linear infinite;
               vertical-align: middle; margin-right: .5rem; }
  </style>
</head>
<body>
  <header>
    <span>👟</span>
    <h1>Footie Lagos</h1>
  </header>
  <main>${body}</main>
</body>
</html>`;
}

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /demo — product listing
app.get(BASE, (req, res) => {
  const cards = PRODUCTS.map((p) => `
    <div class="card">
      <div class="emoji">${p.emoji}</div>
      <h2>${p.name}</h2>
      <p>${p.desc}</p>
      <div class="price">₦${p.price_ngn.toLocaleString()}</div>
      <form method="POST" action="${BASE}/buy">
        <input type="hidden" name="product_id" value="${p.id}" />
        <button class="btn" type="submit">Pay with USDC (ArcPay)</button>
      </form>
    </div>`).join("");

  res.send(shell("Home", `
    <p style="margin-bottom:1.5rem;color:#666">Fresh kicks, paid in stable dollars. Instant settlement, no middleman.</p>
    <div class="grid">${cards}</div>
  `));
});

// POST /demo/buy — create ArcPay payment, redirect to checkout
app.post(`${BASE}/buy`, async (req, res) => {
  if (!API_KEY || !WH_SECRET) {
    return res.status(500).send(shell("Setup needed", `
      <div class="status-box">
        <div class="icon">⚠️</div>
        <h2>Not configured</h2>
        <p>Copy <code>.env.example</code> to <code>.env</code> and fill in your ArcPay credentials.</p>
        <a href="${BASE}" class="btn secondary" style="margin-top:1rem">Back to shop</a>
      </div>`));
  }

  const product = PRODUCTS.find((p) => p.id === req.body.product_id);
  if (!product) return res.status(400).send("Unknown product");

  const orderId = crypto.randomUUID();

  let paymentData;
  try {
    const response = await fetch(`${ARCPAY_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": API_KEY,
      },
      body: JSON.stringify({
        amount:       product.price_ngn,
        currency:     "NGN",
        order_id:     orderId,
        callback_url: `${STORE_URL}/orders/${orderId}`,
        metadata:     { product: product.id, store: "footie-lagos" },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("[footie] ArcPay error:", err);
      return res.status(502).send(shell("Payment error", `
        <div class="status-box">
          <div class="icon">❌</div>
          <h2>Could not create payment</h2>
          <p>${err.error || "ArcPay returned an error. Is the backend running?"}</p>
          <a href="${BASE}" class="btn secondary" style="margin-top:1rem">Try again</a>
        </div>`));
    }

    paymentData = await response.json();
  } catch (err) {
    console.error("[footie] fetch error:", err.message);
    return res.status(502).send(shell("Connection error", `
      <div class="status-box">
        <div class="icon">🔌</div>
        <h2>Cannot reach ArcPay</h2>
        <p>Make sure ArcPay is running on ${ARCPAY_URL}.</p>
        <a href="${BASE}" class="btn secondary" style="margin-top:1rem">Back to shop</a>
      </div>`));
  }

  orders.set(orderId, {
    id:         orderId,
    product,
    status:     "pending",
    payment_id: paymentData.payment_id,
    created_at: new Date().toISOString(),
  });

  console.log(`[footie] order ${orderId} → payment ${paymentData.payment_id}`);
  res.redirect(paymentData.payment_url);
});

// GET /demo/api/orders/:id — JSON polling endpoint
app.get(`${BASE}/api/orders/:id`, (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ id: order.id, status: order.status, product: order.product.name });
});

// GET /demo/orders/:id — order status page
app.get(`${BASE}/orders/:id`, (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) {
    return res.status(404).send(shell("Order not found", `
      <div class="status-box">
        <div class="icon">??</div>
        <h2>Order not found</h2>
        <p>This link may have expired or the order ID is wrong.</p>
        <a href="${BASE}" class="btn secondary" style="margin-top:1rem">Back to shop</a>
      </div>`));
  }

  const isPaid = order.status === "paid";

  const statusBlock = isPaid
    ? `<div class="tag paid">Paid ✓</div>`
    : `<div class="tag pending"><span class="spinner"></span>Verifying payment…</div>`;

  const message = isPaid
    ? `Your shoes are on their way! 🎉`
    : `Waiting for blockchain confirmation. This page updates automatically.`;

  res.send(shell(`Order ${order.id.slice(0, 8)}`, `
    <div class="status-box">
      <div class="icon">${order.product.emoji}</div>
      <h2>${order.product.name}</h2>
      <p style="font-size:1.1rem;font-weight:600;color:#1a1a1a">₦${order.product.price_ngn.toLocaleString()}</p>
      <div style="margin:.75rem 0">${statusBlock}</div>
      <p id="msg">${message}</p>
      <div class="meta">Order ID: ${order.id}</div>
      ${isPaid ? `<a href="${BASE}" class="btn" style="margin-top:1.5rem">Shop more</a>` : ""}
    </div>
    ${!isPaid ? `<script>
      (function poll() {
        fetch("${BASE}/api/orders/${order.id}")
          .then(r => r.json())
          .then(data => {
            if (data.status === "paid") { location.reload(); return; }
            setTimeout(poll, 2500);
          })
          .catch(() => setTimeout(poll, 5000));
      })();
    </script>` : ""}
  `));
});

// POST /demo/arcpay/webhook — HMAC-verified payment event from ArcPay
app.post(`${BASE}/arcpay/webhook`, (req, res) => {
  if (!WH_SECRET) {
    console.error("[footie] ARCPAY_WEBHOOK_SECRET not set — rejecting webhook");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  const sig      = req.headers["x-arcpay-signature"] || "";
  const rawBody  = req.body;
  const expected = "sha256=" + crypto.createHmac("sha256", WH_SECRET).update(rawBody).digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    console.warn("[footie] webhook signature mismatch — rejected");
    return res.status(401).json({ error: "Invalid signature" });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  console.log(`[footie] webhook event: ${payload.event}, order: ${payload.order_id}`);

  if (payload.event === "payment.paid" && payload.order_id) {
    const order = orders.get(payload.order_id);
    if (order) {
      order.status = "paid";
      console.log(`[footie] order ${payload.order_id} → PAID ✓`);
    } else {
      console.warn(`[footie] no in-memory order for ${payload.order_id} (may be test event)`);
    }
  }

  res.json({ received: true });
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n👟  Footie Lagos running at http://localhost:${PORT}${BASE}`);
  console.log(`    ArcPay backend: ${ARCPAY_URL}`);
  if (!API_KEY || !WH_SECRET) {
    console.warn("    ⚠️  ARCPAY_API_KEY / ARCPAY_WEBHOOK_SECRET not set — copy .env.example to .env\n");
  }
});
