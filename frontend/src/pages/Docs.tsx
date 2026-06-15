import { useState, useRef, useEffect } from "react";
import { Check, Copy } from "lucide-react";

// Base URL of this deployment - examples always match where the docs are served from
const API_BASE = typeof window !== "undefined" ? window.location.origin : "https://arc.ogsnap.online";

// Code block with language tabs + copy

type Lang = "cURL" | "Node" | "Python";

function CodeBlock({ snippets }: { snippets: Partial<Record<Lang, string>> }) {
  const langs = Object.keys(snippets) as Lang[];
  const [active, setActive] = useState<Lang>(langs[0]);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(snippets[active] ?? "").catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-xl overflow-hidden border border-gray-800 my-4">
      <div className="flex items-center justify-between bg-[#181825] px-4 py-2">
        <div className="flex gap-1">
          {langs.map(l => (
            <button key={l} onClick={() => setActive(l)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                active === l ? "bg-[#6c47ff] text-white" : "text-gray-400 hover:text-white"
              }`}>{l}</button>
          ))}
        </div>
        <button onClick={copy} className="text-gray-500 hover:text-white transition-colors">
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <pre className="bg-[#1e1e2e] text-[#cdd6f4] p-4 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre">
        {snippets[active]}
      </pre>
    </div>
  );
}

// Nav sections

const NAV = [
  { id: "quickstart",      label: "Quick Start" },
  { id: "auth",            label: "Authentication" },
  { id: "create-payment",  label: "Create a Payment" },
  { id: "ngn",             label: "NGN Payments" },
  { id: "webhooks",        label: "Webhooks" },
  { id: "verify",          label: "Verify a Payment" },
  { id: "sdk",             label: "JS / TS SDK" },
  { id: "footie",          label: "Footie Walkthrough ⭐" },
  { id: "errors",          label: "Errors" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-14 scroll-mt-24">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">{title}</h2>
      <div className="w-10 h-0.5 bg-[#6c47ff] mb-5 rounded" />
      <div className="space-y-4 text-gray-600 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-gray-900 mt-6 mb-2">{children}</h3>;
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="bg-gray-100 rounded px-1.5 py-0.5 text-xs font-mono text-[#6c47ff]">{children}</code>;
}

// Docs page

export default function Docs() {
  const [active, setActive] = useState("quickstart");
  const contentRef = useRef<HTMLDivElement>(null);

  // Highlight active nav item on scroll
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    document.querySelectorAll("section[id]").forEach(s => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  return (
    <>
      {/* Header band - Arc theme */}
      <div className="arc-panel">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <p className="arc-kicker text-xs font-medium mb-3">{"{ DEVELOPER DOCS }"}</p>
          <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-tight text-white mb-3">Build with ArcPay</h1>
          <p className="text-blue-100/80 max-w-xl">
            Accept USDC payments on Arc in under 10 minutes. Two API calls, a signed webhook,
            and funds settle straight to your wallet.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex gap-10">

      {/* Left nav */}
      <aside className="hidden lg:block w-52 shrink-0">
        <div className="sticky top-24 space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">On this page</p>
          {NAV.map(({ id, label }) => (
            <a key={id} href={`#${id}`}
              onClick={() => setActive(id)}
              className={`block px-3 py-1.5 rounded-lg text-sm transition-colors border-l-2 ${
                active === id
                  ? "border-[#6c47ff] bg-primary/5 text-[#6c47ff] font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-200"
              }`}>
              {label}
            </a>
          ))}
        </div>
      </aside>

      {/* Content */}
      <div ref={contentRef} className="flex-1 min-w-0">

        {/* Quick Start */}
        <Section id="quickstart" title="Quick Start">
          <p>Accept your first USDC payment in under 10 minutes.</p>
          <H3>1. Create an account & get your API key</H3>
          <p>Register from the <a href="/dashboard" className="text-[#6c47ff] underline">dashboard</a>, or call the API directly. You get back an API key and a webhook secret - both shown once.</p>
          <CodeBlock snippets={{
            cURL: `curl -X POST ${API_BASE}/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Footie Dubai",
    "email": "hello@footie.ng",
    "password": "a-strong-password",
    "wallet_address": "0xYourWalletAddress",
    "webhook_url": "https://footie.ng/webhooks/arcpay"
  }'

# Response: { token, merchant_id, api_key, webhook_secret }
# Store api_key + webhook_secret safely - shown ONCE.`,
            Node: `const res = await fetch('${API_BASE}/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Footie Dubai',
    email: 'hello@footie.ng',
    password: 'a-strong-password',
    wallet_address: '0xYourWalletAddress',
    webhook_url: 'https://footie.ng/webhooks/arcpay',
  }),
});
const { api_key, webhook_secret } = await res.json();
// Store these safely - shown ONCE.`,
          }} />

          <H3>2. Create a payment</H3>
          <CodeBlock snippets={{
            cURL: `curl -X POST ${API_BASE}/payments \\
  -H "X-Api-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "amount": 1000000 }'   # 1 USDC = 1 000 000 micro-units

# Response includes payment_url - redirect your customer there.`,
            Node: `const { payment_url } = await fetch('${API_BASE}/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': process.env.ARCPAY_KEY,
  },
  body: JSON.stringify({ amount: 1000000 }),
}).then(r => r.json());

// Redirect customer to the hosted checkout:
res.redirect(payment_url);`,
            Python: `import requests, os

resp = requests.post(
    "${API_BASE}/payments",
    headers={"X-Api-Key": os.environ["ARCPAY_KEY"]},
    json={"amount": 1000000},
)
payment_url = resp.json()["payment_url"]
# Redirect customer: return redirect(payment_url)`,
          }} />

          <H3>3. Receive a webhook</H3>
          <p>ArcPay POSTs to your <InlineCode>webhook_url</InlineCode> when the payment lands on-chain. Verify the signature:</p>
          <CodeBlock snippets={{
            Node: `app.post('/webhooks/arcpay', express.raw({ type: 'application/json' }), (req, res) => {
  const sig    = req.headers['x-arcpay-signature'];
  const secret = process.env.ARCPAY_WEBHOOK_SECRET;
  const expected = 'sha256=' +
    require('crypto').createHmac('sha256', secret).update(req.body).digest('hex');

  if (!require('crypto').timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return res.sendStatus(401);
  }

  const { event, payment_id, order_id, amount_usdc } = JSON.parse(req.body);
  if (event === 'payment.paid') {
    // mark order paid, ship the shoes
  }
  res.sendStatus(200);
});`,
            Python: `import hmac, hashlib, os
from flask import request, abort

@app.route('/webhooks/arcpay', methods=['POST'])
def webhook():
    sig    = request.headers.get('X-ArcPay-Signature', '')
    secret = os.environ['ARCPAY_WEBHOOK_SECRET'].encode()
    body   = request.get_data()
    expected = 'sha256=' + hmac.new(secret, body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        abort(401)
    data = request.json
    if data['event'] == 'payment.paid':
        pass  # mark order paid
    return '', 200`,
          }} />
        </Section>

        {/* Auth */}
        <Section id="auth" title="Authentication">
          <p>Pass your API key in the <InlineCode>X-Api-Key</InlineCode> header on every request.</p>
          <CodeBlock snippets={{
            cURL: `curl ${API_BASE}/payments \\
  -H "X-Api-Key: YOUR_SECRET_API_KEY"`,
          }} />
          <p className="text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            ⚠️ Keep your API key server-side. Never expose it in browser JavaScript in production.
          </p>
        </Section>

        {/* Create Payment */}
        <Section id="create-payment" title="Create a Payment">
          <p><strong>POST</strong> <InlineCode>/payments</InlineCode></p>

          <H3>Request body</H3>
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-gray-50">
              {["Field", "Type", "Required", "Description"].map(h => (
                <th key={h} className="text-left px-3 py-2 text-gray-500 font-semibold border border-gray-200">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[
                ["amount",         "number",  "✓", "USDC micro-units (1 USDC = 1 000 000) or whole NGN"],
                ["currency",       "string",  "",  '"USDC" (default) or "NGN"'],
                ["order_id",       "string",  "",  "Your internal order reference"],
                ["customer_email", "string",  "",  "Customer email for records"],
                ["callback_url",   "string",  "",  "Included in the webhook payload"],
                ["metadata",       "object",  "",  "Arbitrary key-value data passed through"],
              ].map(([f, t, r, d]) => (
                <tr key={f as string} className="border border-gray-200">
                  <td className="px-3 py-1.5 font-mono text-[#6c47ff]">{f}</td>
                  <td className="px-3 py-1.5 text-gray-400">{t}</td>
                  <td className="px-3 py-1.5 text-center">{r}</td>
                  <td className="px-3 py-1.5">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <H3>Response</H3>
          <CodeBlock snippets={{
            Node: `{
  "payment_id":  "0xabc123...",
  "amount_usdc": "2903226",    // USDC base units
  "amount_ngn":  4500,         // whole NGN (if NGN payment)
  "rate":        1550,         // locked FX rate at creation
  "currency":    "NGN",
  "order_id":    "FOOTIE-1021",
  "status":      "pending",
  "expires_at":  "2026-06-01T22:15:00.000Z",
  "payment_url": "${API_BASE}/checkout/0xabc123..."
}`,
          }} />
        </Section>

        {/* NGN */}
        <Section id="ngn" title="NGN Payments">
          <p>
            Pass <InlineCode>currency: "NGN"</InlineCode> and an <InlineCode>amount</InlineCode> in <strong>whole Naira</strong>.
            ArcPay converts to USDC at the live rate (locked at creation) so the amount can't drift during checkout.
          </p>
          <CodeBlock snippets={{
            cURL: `curl -X POST ${API_BASE}/payments \\
  -H "X-Api-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 4500,
    "currency": "NGN",
    "order_id": "FOOTIE-1021",
    "customer_email": "buyer@example.com"
  }'`,
            Node: `const payment = await arcpay.createPayment({
  amount:        4500,          // ₦4,500
  currency:      'NGN',
  orderId:       'FOOTIE-1021',
  customerEmail: 'buyer@example.com',
});
// payment.amount_usdc → "2903226"  (≈ 2.90 USDC at ₦1,550/USD)
// payment.rate        → 1550        (locked - won't drift)`,
            Python: `resp = requests.post(
    "${API_BASE}/payments",
    headers={"X-Api-Key": key},
    json={"amount": 4500, "currency": "NGN", "order_id": "FOOTIE-1021"},
)`,
          }} />
          <p>The checkout page shows <strong>both</strong> the NGN price and the USDC equivalent with the locked rate.</p>
        </Section>

        {/* Webhooks */}
        <Section id="webhooks" title="Webhooks">
          <p>ArcPay fires a signed POST to your <InlineCode>webhook_url</InlineCode> after every on-chain event. Delivery is retried 3× (2 s, 4 s backoff).</p>

          <H3>Events</H3>
          <div className="space-y-1">
            {[
              ["payment.paid",     "Customer paid - funds settled straight to your wallet"],
              ["payment.refunded", "Merchant refunded - funds returned to the payer"],
            ].map(([e, d]) => (
              <div key={e} className="flex gap-3 text-sm">
                <InlineCode>{e}</InlineCode>
                <span className="text-gray-500">{d}</span>
              </div>
            ))}
          </div>

          <H3>Payload shape</H3>
          <CodeBlock snippets={{
            Node: `{
  "event":       "payment.paid",
  "payment_id":  "0xabc...",
  "order_id":    "FOOTIE-1021",     // your reference, passed through
  "amount_usdc": 2903226,
  "amount_ngn":  4500,
  "rate":        1550,
  "currency":    "NGN",
  "status":      "paid",
  "payer":       "0xCustomerWallet",
  "tx_hash":     "0xTxHash",
  "timestamp":   "2026-06-01T21:00:00.000Z"
}`,
          }} />

          <H3>Signature header</H3>
          <p><InlineCode>X-ArcPay-Signature: sha256=&lt;hmac-hex&gt;</InlineCode></p>
          <p>Computed as HMAC-SHA256 of the raw request body using your <InlineCode>webhook_secret</InlineCode>.</p>
        </Section>

        {/* Verify */}
        <Section id="verify" title="Verify a Payment">
          <p>Poll <InlineCode>GET /payments/:id</InlineCode> to double-check status before shipping.</p>
          <CodeBlock snippets={{
            cURL: `curl ${API_BASE}/payments/0xabc123 \\
  -H "X-Api-Key: YOUR_KEY"`,
            Node: `const payment = await fetch(\`${API_BASE}/payments/\${paymentId}\`, {
  headers: { 'X-Api-Key': process.env.ARCPAY_KEY },
}).then(r => r.json());

if (payment.status !== 'paid') {
  throw new Error('Do not ship - payment not confirmed');
}`,
            Python: `p = requests.get(
    f"${API_BASE}/payments/{payment_id}",
    headers={"X-Api-Key": key},
).json()
assert p["status"] == "paid", "Do not ship"`,
          }} />
        </Section>

        {/* SDK */}
        <Section id="sdk" title="JS / TS SDK">
          <p>Import the typed SDK in your Node or browser code:</p>
          <CodeBlock snippets={{
            Node: `import ArcPay from './arcpay-sdk';  // or from '@arcpay/sdk' when published

const arcpay = new ArcPay(process.env.ARCPAY_KEY, '${API_BASE}');

// Create a payment
const payment = await arcpay.createPayment({ amount: 4500, currency: 'NGN' });

// Or create + redirect in one call (browser only)
await arcpay.checkout({ amount: 4500, currency: 'NGN', orderId: 'FOOTIE-1021' });`,
          }} />

          <H3>Browser script tag <span className="text-xs font-normal text-gray-400">(hosted CDN coming soon)</span></H3>
          <p>A hosted, drop-in script is on the roadmap. Until then, integrate server-side with the Node example above - that keeps your API key off the browser, which is the recommended pattern anyway.</p>
          <CodeBlock snippets={{
            cURL: `<!-- Preview of the planned drop-in widget -->
<script src="${API_BASE}/sdk/v1/arcpay.js"></script>
<script>
  const arcpay = new ArcPay({
    apiKey:  'YOUR_KEY',           // for production, create the payment server-side instead
    baseUrl: '${API_BASE}',
  });
  arcpay.checkout({ amount: 4500, currency: 'NGN' });
</script>`,
          }} />
        </Section>

        {/* Footie walkthrough */}
        <Section id="footie" title="Footie Store - Full Walkthrough">
          <p>
            Footie Dubai sells premium sneakers priced in Dirhams. Here's the exact integration
            that powers the <a href="/demo" className="text-[#6c47ff] underline">live demo</a>.
          </p>

          <H3>Step 1 - Footie's server creates a payment</H3>
          <CodeBlock snippets={{
            Node: `// footie-server.js - runs on Footie's backend
app.post('/checkout', async (req, res) => {
  const { productId, customerEmail } = req.body;
  const product = await db.products.findById(productId);

  const payment = await fetch('${API_BASE}/payments', {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.ARCPAY_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount:        product.price_ngn,   // e.g. 45000 for ₦45,000
      currency:      'NGN',
      order_id:      \`FOOTIE-\${product.id}\`,
      customer_email: customerEmail,
      callback_url:  'https://footie.ng/orders',
      metadata:      { product_name: product.name, size: req.body.size },
    }),
  }).then(r => r.json());

  res.redirect(payment.payment_url);     // → ArcPay hosted checkout
});`,
          }} />

          <H3>Step 2 - Customer pays on ArcPay checkout</H3>
          <p>
            Customer sees "₦45,000 · 29.03 USDC" and the locked rate. They connect MetaMask,
            approve USDC, and pay in one tap. Funds go straight to Footie's wallet - ArcPay never holds the money.
          </p>

          <H3>Step 3 - Footie receives a webhook and ships</H3>
          <CodeBlock snippets={{
            Node: `app.post('/webhooks/arcpay', express.raw({ type: 'application/json' }), (req, res) => {
  // 1. Verify signature
  const sig  = req.headers['x-arcpay-signature'];
  const mac  = 'sha256=' + crypto.createHmac('sha256', process.env.ARCPAY_WEBHOOK_SECRET)
    .update(req.body).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(mac))) return res.sendStatus(401);

  // 2. Process event
  const { event, order_id, amount_usdc, tx_hash } = JSON.parse(req.body);
  if (event === 'payment.paid') {
    await db.orders.markPaid({ orderId: order_id, txHash: tx_hash });
    await fulfillment.ship(order_id);  // ship the shoes 👟
  }
  res.sendStatus(200);
});`,
          }} />

          <H3>Step 4 - Belt & suspenders</H3>
          <CodeBlock snippets={{
            Node: `// Footie can also poll directly to confirm before shipping
const payment = await fetch(\`/payments/\${paymentId}\`, {
  headers: { 'X-Api-Key': process.env.ARCPAY_KEY }
}).then(r => r.json());

if (payment.status !== 'paid') throw new Error('Not paid yet');`,
          }} />
        </Section>

        {/* Errors */}
        <Section id="errors" title="Errors">
          <p>All errors return <InlineCode>{"{ \"error\": \"message\" }"}</InlineCode> with an appropriate HTTP status.</p>
          <table className="w-full text-xs border-collapse mt-2">
            <thead><tr className="bg-gray-50">
              {["Status", "Meaning", "Common cause"].map(h => (
                <th key={h} className="text-left px-3 py-2 text-gray-500 font-semibold border border-gray-200">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[
                ["400", "Bad request",     "Missing or invalid amount"],
                ["401", "Unauthorized",    "Missing or wrong X-Api-Key"],
                ["404", "Not found",       "Payment ID doesn't exist or belongs to another merchant"],
                ["409", "Conflict",        "Email already registered"],
                ["503", "Service unavail.","FX rate unavailable and no NGN_FALLBACK_RATE set"],
                ["500", "Server error",    "Something unexpected - check backend logs"],
              ].map(([s, m, c]) => (
                <tr key={s as string} className="border border-gray-200">
                  <td className="px-3 py-1.5 font-mono text-[#6c47ff]">{s}</td>
                  <td className="px-3 py-1.5 font-medium">{m}</td>
                  <td className="px-3 py-1.5 text-gray-500">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

      </div>
    </div>
    </>
  );
}
