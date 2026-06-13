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
const ARCPAY_ADDRESS = process.env.ARCPAY_ADDRESS || "0xF5f8e51425cA2240c4cBbEb964b0d1f480A7cDef";
const EXPLORER       = process.env.ARC_EXPLORER   || "https://testnet.arcscan.app";

// escape the code snippets before dropping them into the page
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// the sample code we show in the sidebar. no backticks or ${} in here or the
// template string below blows up
const SNIPPET_ENV = `# .env — the API key is secret, server-side only
ARCPAY_API_KEY=sk_live_xxxxxxxxxxxxxxxx
ARCPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
ARCPAY_URL=https://arc.ogsnap.online
STORE_URL=https://your-store.com
PORT=3100`;

const SNIPPET_ROUTE = `// Create a payment when the customer checks out
app.post('/buy', async (req, res) => {
  const product = PRODUCTS.find(p => p.id === req.body.product_id);
  const orderId = crypto.randomUUID();

  const payment = await fetch(ARCPAY_URL + '/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': process.env.ARCPAY_API_KEY,
    },
    body: JSON.stringify({
      amount:       product.price_ngn,  // price in Naira
      currency:     'NGN',
      order_id:     orderId,
      callback_url: STORE_URL + '/orders/' + orderId,
    }),
  }).then(r => r.json());

  // Send the customer to ArcPay's hosted checkout
  res.redirect(payment.payment_url);
});`;

const SNIPPET_WEBHOOK = `// Confirm the payment from ArcPay's signed webhook
app.post('/arcpay/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const sig = req.headers['x-arcpay-signature'];
    const expected = 'sha256=' + crypto
      .createHmac('sha256', process.env.ARCPAY_WEBHOOK_SECRET)
      .update(req.body)
      .digest('hex');

    // Reject anything not signed with your secret
    if (sig !== expected) return res.sendStatus(401);

    const evt = JSON.parse(req.body);
    if (evt.event === 'payment.paid') {
      markOrderPaid(evt.order_id);   // ship the shoes
    }
    res.json({ received: true });
  });`;

// our little catalogue
const PRODUCTS = [
  { id: "lagos-runner",     name: "Lagos Runner",           price_ngn: 4500, emoji: "👟", desc: "Lightweight mesh, built for the city grind." },
  { id: "eko-slide",        name: "Eko Slide",              price_ngn: 2800, emoji: "🩴", desc: "All-day comfort, island style." },
  { id: "vi-hightop",       name: "Victoria Island Hi-Top", price_ngn: 6200, emoji: "👢", desc: "Statement fit for the mainland flex." },
];

// just hold orders in memory. it's a demo, restart and they're gone, no big deal
const orders = new Map();

// the webhook needs the raw body for the signature check, so register it before json()
app.use(`${BASE}/arcpay/webhook`, express.raw({ type: "application/json" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// every page gets wrapped in this
function shell(title, body, opts = {}) {
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
    #live-dot { color:#0a5c36; font-size:.7rem; font-weight:700; }
    .spinner { display: inline-block; width: 1.2rem; height: 1.2rem;
               border: 3px solid #ddd; border-top-color: #1a1a1a;
               border-radius: 50%; animation: spin .8s linear infinite;
               vertical-align: middle; margin-right: .5rem; }

    /* wallet button */
    .wallet-btn { margin-left:auto; background:#6c47ff; color:#fff; border:none;
                  border-radius:8px; padding:.55rem 1.1rem; font-size:.85rem;
                  font-weight:600; cursor:pointer; font-family:inherit; }
    .wallet-btn:hover { background:#5838e0; }
    .wallet-btn.connected { background:#0a5c36; font-family:ui-monospace,Menlo,monospace; }
    .wallet-btn.connected:hover { background:#b91c1c; }
    .wallet-btn.connected:hover::after { content:' · Disconnect'; font-family:inherit; }

    /* layout: skinny setup rail on the left, everything else on the right */
    main.wide { max-width:1500px; }
    .layout { display:grid; grid-template-columns:300px minmax(0,1fr);
              gap:2.5rem; align-items:start; }
    @media (max-width:900px){ .layout{ grid-template-columns:1fr; gap:1.5rem; } }
    .col-title { font-size:.75rem; font-weight:700; text-transform:uppercase;
                 letter-spacing:.06em; color:#999; margin-bottom:.85rem;
                 display:flex; align-items:center; gap:.5rem; }
    .panel { background:#fff; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .intro { margin-bottom:1.25rem; color:#666; font-size:.9rem; max-width:640px; }

    /* the integration snippets */
    .sidebar { position:sticky; top:1rem; }
    .sidebar details { border-bottom:1px solid #f0ebe3; }
    .sidebar details:last-child { border-bottom:none; }
    .sidebar summary { cursor:pointer; padding:.85rem 1rem; font-weight:600;
                       font-size:.88rem; list-style:none; display:flex;
                       align-items:center; gap:.5rem; }
    .sidebar summary::-webkit-details-marker { display:none; }
    .sidebar summary::before { content:'▸'; color:#6c47ff; transition:transform .15s; }
    .sidebar details[open] summary::before { transform:rotate(90deg); }
    .sidebar pre.code { margin:0 .75rem .85rem; }
    pre.code { background:#1e1e2e; color:#cdd6f4; border-radius:8px; padding:.85rem;
               font-size:.72rem; line-height:1.5; overflow-x:auto;
               font-family:ui-monospace,Menlo,Consolas,monospace; white-space:pre; }
    /* "try demo 2" cta under the sidebar */
    .demo2-btn { display:flex; align-items:center; gap:.75rem; margin-top:1rem;
                 background:#6c47ff; color:#fff; text-decoration:none; border-radius:12px;
                 padding:.85rem 1rem; box-shadow:0 4px 14px rgba(108,71,255,.3); transition:background .15s; }
    .demo2-btn:hover { background:#5838e0; }
    .demo2-ic { font-size:1.4rem; line-height:1; }
    .demo2-tx { flex:1; line-height:1.25; }
    .demo2-tx strong { display:block; font-size:.92rem; }
    .demo2-tx small  { font-size:.72rem; opacity:.85; }
    .demo2-arrow { font-size:1.1rem; opacity:.9; }

    .how { padding:0 1rem 1rem; }
    .how ol { padding-left:1.1rem; }
    .how li { font-size:.82rem; color:#555; line-height:1.5; margin-bottom:.5rem; }

    /* products, 3 across */
    .shoe-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:1.25rem; }
    @media (max-width:760px){ .shoe-grid{ grid-template-columns:1fr; } }
    .shoe-grid .card { padding:1.25rem; }
    .shoe-grid .card .emoji { font-size:2.4rem; margin-bottom:.5rem; }
    .shoe-grid .card h2 { font-size:1rem; }
    .shoe-grid .card .price { font-size:1.15rem; margin-bottom:.85rem; }
    .shoe-grid .btn { padding:.6rem 1rem; font-size:.88rem; }

    /* payments table */
    .pay-table { width:100%; border-collapse:collapse; font-size:.85rem; }
    .pay-table th { text-align:left; padding:.65rem 1rem; font-size:.7rem;
                    text-transform:uppercase; letter-spacing:.05em; color:#999;
                    font-weight:600; background:#f9f6f0; }
    .pay-table td { padding:.7rem 1rem; border-top:1px solid #f0ebe3; vertical-align:middle; }
    .pay-table .oid { font-family:ui-monospace,Menlo,monospace; color:#999; font-size:.78rem; }
    .pay-table .amt { font-weight:600; white-space:nowrap; }
    .pay-table .usd { display:block; font-weight:500; color:#999; font-size:.74rem; }

    /* filter pills */
    .filters { display:flex; gap:.4rem; }
    .filter { border:1px solid #e0d9cf; background:#fff; color:#777; cursor:pointer;
              border-radius:99px; padding:.32rem .85rem; font-size:.78rem; font-weight:600;
              font-family:inherit; }
    .filter:hover { background:#f9f6f0; }
    .filter.active { background:#1a1a1a; color:#fff; border-color:#1a1a1a; }
    .pay-table .time { color:#999; font-size:.8rem; white-space:nowrap; }
    .explorer-link { color:#6c47ff; text-decoration:none; font-weight:600; font-size:.8rem; }
    .explorer-link:hover { text-decoration:underline; }
    .empty { padding:2.5rem 1rem; text-align:center; color:#bbb; font-size:.85rem; line-height:1.6; }

    /* checkout popup */
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.55);
                     z-index:100; display:flex; align-items:center; justify-content:center; padding:1.5rem; }
    .modal-box { background:#fff; border-radius:14px; width:100%; max-width:560px;
                 height:85vh; max-height:760px; display:flex; flex-direction:column;
                 overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,.3); }
    .modal-head { display:flex; align-items:center; justify-content:space-between;
                  padding:.85rem 1.1rem; border-bottom:1px solid #eee; }
    .modal-head span { font-weight:700; font-size:.95rem; }
    .modal-close { background:#f0ebe3; border:none; border-radius:8px; padding:.45rem .9rem;
                   font-size:.82rem; font-weight:600; cursor:pointer; font-family:inherit; color:#1a1a1a; }
    .modal-close:hover { background:#e0d9cf; }
    .modal-frame { flex:1; border:none; width:100%; }
    .modal-loading { flex:1; display:none; flex-direction:column; align-items:center;
                     justify-content:center; gap:1rem; color:#888; font-size:.9rem; }
    .spinner-lg { width:2.4rem; height:2.4rem; border:3px solid #eee; border-top-color:#6c47ff;
                  border-radius:50%; animation:spin .8s linear infinite; }
    .modal-success { flex:1; display:none; flex-direction:column; align-items:center;
                     justify-content:center; text-align:center; gap:.75rem; padding:2rem; }
    .modal-success h2 { font-size:1.4rem; }
    .modal-success p { color:#666; max-width:340px; }

    /* the "you closed the popup, want back in?" bar */
    .resume-bar { position:fixed; bottom:1.25rem; left:50%; transform:translateX(-50%);
                  z-index:90; background:#1a1a1a; color:#fff; border-radius:99px;
                  padding:.5rem .6rem .5rem 1.1rem; display:flex; align-items:center;
                  gap:.85rem; box-shadow:0 8px 24px rgba(0,0,0,.25); font-size:.85rem; }
    .resume-bar button { border:none; cursor:pointer; font-family:inherit; font-weight:600; }
    .resume-bar .resume { background:#6c47ff; color:#fff; border-radius:99px; padding:.45rem .95rem; font-size:.82rem; }
    .resume-bar .resume:hover { background:#5838e0; }
    .resume-bar .dismiss { background:transparent; color:#aaa; font-size:.95rem; padding:.2rem .45rem; }
    .resume-bar .dismiss:hover { color:#fff; }
  </style>
</head>
<body>
  <header>
    <span>👟</span>
    <h1>Footie Lagos</h1>
    ${opts.wallet ? `<button id="wallet-btn" class="wallet-btn" onclick="connectWallet()">Connect Wallet</button>` : ""}
  </header>
  <main class="${opts.wide ? "wide" : ""}">${body}</main>
  ${opts.wallet ? `<script>
    var connectedAddr = null;
    async function connectWallet() {
      if (connectedAddr) { return disconnectWallet(); }   // already connected, so this click means disconnect
      if (!window.ethereum) { alert('Install MetaMask to connect a wallet.'); return; }
      try {
        var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setWallet(accounts && accounts[0]);
      } catch (e) { /* user dismissed */ }
    }
    async function disconnectWallet() {
      // newer metamask can actually revoke; older versions just clear our own state
      if (window.ethereum && window.ethereum.request) {
        try { await window.ethereum.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }); } catch (e) {}
      }
      setWallet(null);
    }
    function setWallet(addr) {
      connectedAddr = addr || null;
      var btn = document.getElementById('wallet-btn');
      if (!btn) return;
      if (addr) {
        btn.textContent = addr.slice(0,6) + '…' + addr.slice(-4);
        btn.classList.add('connected');
        btn.title = 'Click to disconnect';
      } else {
        btn.textContent = 'Connect Wallet';
        btn.classList.remove('connected');
        btn.title = 'Connect your wallet';
      }
    }
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' }).then(function(a){ if (a && a.length) setWallet(a[0]); });
      if (window.ethereum.on) window.ethereum.on('accountsChanged', function(a){ setWallet(a && a[0]); });
    }
  </script>` : ""}
</body>
</html>`;
}

// routes

// the storefront
app.get(BASE, (req, res) => {
  const cards = PRODUCTS.map((p) => `
    <div class="card">
      <div class="emoji">${p.emoji}</div>
      <h2>${p.name}</h2>
      <p>${p.desc}</p>
      <div class="price">₦${p.price_ngn.toLocaleString()}</div>
      <button class="btn" onclick="openPay('${p.id}')">Pay with USDC (ArcPay)</button>
    </div>`).join("");

  res.send(shell("Home", `
    <div class="layout">

      <!-- left rail: how it's wired up -->
      <aside>
        <p class="col-title">⚙️ Integrate in two calls</p>
        <div class="panel sidebar">
          <details open>
            <summary>1 · Environment</summary>
            <pre class="code">${esc(SNIPPET_ENV)}</pre>
          </details>
          <details>
            <summary>2 · Create a payment (route)</summary>
            <pre class="code">${esc(SNIPPET_ROUTE)}</pre>
          </details>
          <details>
            <summary>3 · Confirm it (webhook)</summary>
            <pre class="code">${esc(SNIPPET_WEBHOOK)}</pre>
          </details>
          <details class="how">
            <summary>How it works</summary>
            <ol>
              <li>Customer clicks <b>Pay with USDC</b> — your server asks ArcPay to create a payment.</li>
              <li>ArcPay returns a hosted checkout URL — shown right here in a secure window.</li>
              <li>They pay in USDC. Funds settle <b>straight to your wallet</b> — ArcPay never holds them.</li>
              <li>ArcPay sends a <b>signed webhook</b>; you verify it and fulfil the order.</li>
              <li>The whole loop finishes in <b>under a second</b>.</li>
            </ol>
          </details>
        </div>

        <a href="/shop" class="demo2-btn">
          <span class="demo2-ic">🛍️</span>
          <span class="demo2-tx">
            <strong>Try Demo 2</strong>
            <small>A full e-commerce store on ArcPay</small>
          </span>
          <span class="demo2-arrow">↗</span>
        </a>
      </aside>

      <!-- the shop + the live payments table -->
      <div>
        <p class="col-title">🛍️ Footie Lagos store</p>
        <p class="intro">Fresh kicks, paid in stable dollars. Instant settlement, no middleman. Connect a wallet up top, then buy a pair — checkout opens right here.</p>
        <div class="shoe-grid">${cards}</div>

        <div style="margin-top:2.25rem">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:.85rem">
            <p class="col-title" style="margin-bottom:0">📡 Live payments <span id="live-dot">● live</span></p>
            <div class="filters" id="filters">
              <button class="filter active" data-f="all"     onclick="setFilter('all')">All</button>
              <button class="filter"        data-f="paid"    onclick="setFilter('paid')">Paid</button>
              <button class="filter"        data-f="pending" onclick="setFilter('pending')">Pending</button>
            </div>
          </div>
          <div class="panel" style="overflow:hidden">
            <table class="pay-table">
              <thead>
                <tr><th>Order</th><th>Item</th><th>Amount</th><th>Status</th><th>Time</th><th>On-chain</th></tr>
              </thead>
              <tbody id="orders-body">
                <tr><td colspan="6" class="empty">No payments yet — buy a pair to watch it land here in real time.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>

    <!-- checkout popup -->
    <div id="pay-modal" class="modal-overlay" style="display:none">
      <div class="modal-box">
        <div class="modal-head">
          <span id="modal-title">Secure checkout</span>
          <button class="modal-close" onclick="closePayModal()">✕ Cancel</button>
        </div>
        <div id="pay-loading" class="modal-loading">
          <div class="spinner-lg"></div>
          <p>Setting up your secure checkout…</p>
        </div>
        <iframe id="pay-frame" class="modal-frame" src="about:blank" allow="clipboard-write; payment"></iframe>
        <div id="pay-success" class="modal-success">
          <div style="font-size:3.2rem">🎉</div>
          <h2>Payment received!</h2>
          <p>Settled on-chain in seconds. Your shoes are on the way.</p>
          <a id="success-tx" class="explorer-link" target="_blank" rel="noreferrer">View on ArcScan ↗</a>
          <button class="btn" style="max-width:200px;margin-top:.5rem" onclick="closePayModal()">Done</button>
        </div>
      </div>
    </div>

    <!-- shown when someone bails out of the popup before paying -->
    <div id="resume-bar" class="resume-bar" style="display:none">
      <span>Checkout closed — payment still pending.</span>
      <button class="resume" onclick="reopenPay()">↩ Resume payment</button>
      <button class="dismiss" onclick="dismissResume()" title="Dismiss">✕</button>
    </div>

    <script>
      var EXPLORER = "${EXPLORER}";
      var CONTRACT = "${ARCPAY_ADDRESS}";
      var activeOrder = null;
      var pendingPay  = null;   // { order_id, payment_url } of an unfinished payment
      var lastOrders  = [];     // hang on to the last fetch so the filter buttons feel instant
      var statusFilter = 'all';

      function setFilter(f) {
        statusFilter = f;
        var btns = document.querySelectorAll('#filters .filter');
        for (var i = 0; i < btns.length; i++) {
          btns[i].classList.toggle('active', btns[i].getAttribute('data-f') === f);
        }
        render(lastOrders);
      }

      function fmtTime(iso) {
        var secs = Math.floor((Date.now() - new Date(iso)) / 1000);
        if (secs < 5)    return 'just now';
        if (secs < 60)   return secs + 's ago';
        if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
        return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }

      function badge(s) {
        return s === 'paid'
          ? '<span class="tag paid">Paid ✓</span>'
          : '<span class="tag pending">Pending</span>';
      }

      function explorer(o) {
        var href  = o.tx_hash ? EXPLORER + '/tx/' + o.tx_hash : EXPLORER + '/address/' + CONTRACT;
        var label = o.tx_hash ? 'View tx ↗' : 'View on ArcScan ↗';
        return '<a class="explorer-link" href="' + href + '" target="_blank" rel="noreferrer">' + label + '</a>';
      }

      function usdLabel(o) {
        return o.usd != null ? '<span class="usd">≈ $' + o.usd.toFixed(2) + ' USDC</span>' : '';
      }

      function render(orders) {
        lastOrders = orders;
        // these checks need every order, not just the ones currently shown
        orders.forEach(function(o) {
          if (pendingPay && o.id === pendingPay.order_id && o.status === 'paid') {
            pendingPay = null;
            document.getElementById('resume-bar').style.display = 'none';
          }
          if (activeOrder && o.id === activeOrder && o.status === 'paid') markPaidInModal(o);
        });

        var view = statusFilter === 'all' ? orders : orders.filter(function(o){ return o.status === statusFilter; });
        var el = document.getElementById('orders-body');
        if (!view.length) {
          var msg = orders.length
            ? 'No ' + statusFilter + ' payments.'
            : 'No payments yet — buy a pair to watch it land here in real time.';
          el.innerHTML = '<tr><td colspan="6" class="empty">' + msg + '</td></tr>';
          return;
        }
        el.innerHTML = view.map(function(o) {
          var last = o.status === 'paid' ? explorer(o) : '<span class="time">confirming…</span>';
          return '<tr>' +
            '<td class="oid">' + o.id.slice(0,8) + '…</td>' +
            '<td>' + o.emoji + ' ' + o.product + '</td>' +
            '<td class="amt">₦' + o.price_ngn.toLocaleString() + usdLabel(o) + '</td>' +
            '<td>' + badge(o.status) + '</td>' +
            '<td class="time">' + fmtTime(o.created_at) + '</td>' +
            '<td>' + last + '</td>' +
          '</tr>';
        }).join('');
      }

      // opening/closing the checkout popup
      // pop the modal up right away with a spinner — feels instant even while
      // the payment is being created and the checkout iframe loads
      function openModalLoading() {
        document.getElementById('pay-success').style.display = 'none';
        document.getElementById('pay-frame').style.display   = 'none';
        document.getElementById('pay-loading').style.display = 'flex';
        document.getElementById('modal-title').textContent   = 'Secure checkout';
        document.getElementById('resume-bar').style.display  = 'none';
        document.getElementById('pay-modal').style.display   = 'flex';
      }

      function showCheckout(orderId, url) {
        activeOrder = orderId;
        var frame = document.getElementById('pay-frame');
        var load  = document.getElementById('pay-loading');
        // keep the spinner up until the checkout page itself has loaded
        frame.onload = function() { load.style.display = 'none'; frame.style.display = 'block'; };
        frame.src = url;
      }

      function openPay(productId) {
        openModalLoading();                       // instant feedback on click
        var body = 'product_id=' + encodeURIComponent(productId);
        fetch('${BASE}/buy?json=1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body,
        })
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (!d.payment_url) { closePayModal(); alert(d.error || 'Could not start payment.'); return; }
            pendingPay = { order_id: d.order_id, payment_url: d.payment_url };
            showCheckout(d.order_id, d.payment_url);
          })
          .catch(function() { closePayModal(); alert('Could not reach the store server.'); });
      }

      // they bailed before paying. let them pick it back up
      function reopenPay() {
        if (!pendingPay) return;
        openModalLoading();
        showCheckout(pendingPay.order_id, pendingPay.payment_url);
      }

      function dismissResume() {
        pendingPay = null;
        document.getElementById('resume-bar').style.display = 'none';
      }

      function markPaidInModal(o) {
        pendingPay = null;
        document.getElementById('resume-bar').style.display = 'none';
        var modal = document.getElementById('pay-modal');
        if (modal.style.display === 'none') return;
        document.getElementById('pay-frame').style.display = 'none';
        document.getElementById('modal-title').textContent = 'Payment complete';
        document.getElementById('success-tx').href =
          o.tx_hash ? EXPLORER + '/tx/' + o.tx_hash : EXPLORER + '/address/' + CONTRACT;
        document.getElementById('pay-success').style.display = 'flex';
      }

      function closePayModal() {
        document.getElementById('pay-modal').style.display = 'none';
        document.getElementById('pay-loading').style.display = 'none';
        document.getElementById('pay-frame').src = 'about:blank';
        activeOrder = null;
        // didn't pay yet? leave them a way back
        if (pendingPay) document.getElementById('resume-bar').style.display = 'flex';
      }
      document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closePayModal(); });

      (function poll() {
        fetch('${BASE}/api/orders')
          .then(function(r) { return r.json(); })
          .then(render)
          .catch(function() {})
          .finally(function() { setTimeout(poll, 2500); });
      })();

      // Quietly preload the checkout app once the page is idle, so its (heavy)
      // bundle is cached and the popup opens fast on the first click.
      window.addEventListener('load', function() {
        setTimeout(function() {
          var warm = document.createElement('iframe');
          warm.setAttribute('aria-hidden', 'true');
          warm.setAttribute('tabindex', '-1');
          warm.style.cssText = 'position:absolute;left:-9999px;width:0;height:0;border:0';
          warm.src = '${ARCPAY_URL}/checkout/warmup';
          document.body.appendChild(warm);
        }, 1200);
      });
    </script>
  `, { wide: true, wallet: true }));
});

// start a payment. the popup hits this with ?json=1 and wants JSON back;
// a plain form post just gets redirected to checkout
app.post(`${BASE}/buy`, async (req, res) => {
  const wantsJson = !!req.query.json;

  if (!API_KEY || !WH_SECRET) {
    if (wantsJson) return res.status(500).json({ error: "Store not configured — set ArcPay credentials in .env" });
    return res.status(500).send(shell("Setup needed", `
      <div class="status-box">
        <div class="icon">⚠️</div>
        <h2>Not configured</h2>
        <p>Copy <code>.env.example</code> to <code>.env</code> and fill in your ArcPay credentials.</p>
        <a href="${BASE}" class="btn secondary" style="margin-top:1rem">Back to shop</a>
      </div>`));
  }

  const product = PRODUCTS.find((p) => p.id === req.body.product_id);
  if (!product) {
    if (wantsJson) return res.status(400).json({ error: "Unknown product" });
    return res.status(400).send("Unknown product");
  }

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
      if (wantsJson) return res.status(502).json({ error: err.error || "ArcPay returned an error." });
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
    if (wantsJson) return res.status(502).json({ error: "Cannot reach ArcPay backend." });
    return res.status(502).send(shell("Connection error", `
      <div class="status-box">
        <div class="icon">🔌</div>
        <h2>Cannot reach ArcPay</h2>
        <p>Make sure ArcPay is running on ${ARCPAY_URL}.</p>
        <a href="${BASE}" class="btn secondary" style="margin-top:1rem">Back to shop</a>
      </div>`));
  }

  // what to show in dollars: use arcpay's number, or fall back to price / rate
  const usd = paymentData.amount_usdc != null
    ? Number(paymentData.amount_usdc) / 1e6
    : (paymentData.rate ? product.price_ngn / paymentData.rate : null);

  orders.set(orderId, {
    id:         orderId,
    product,
    status:     "pending",
    payment_id: paymentData.payment_id,
    usd,
    created_at: new Date().toISOString(),
  });

  console.log(`[footie] order ${orderId} → payment ${paymentData.payment_id}`);
  if (wantsJson) return res.json({ payment_url: paymentData.payment_url, order_id: orderId });
  res.redirect(paymentData.payment_url);
});

// the live payments table polls this
app.get(`${BASE}/api/orders`, (req, res) => {
  const list = [...orders.values()]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20)
    .map(o => ({
      id:         o.id,
      status:     o.status,
      product:    o.product.name,
      emoji:      o.product.emoji,
      price_ngn:  o.product.price_ngn,
      usd:        o.usd != null ? o.usd : null,
      created_at: o.created_at,
      tx_hash:    o.tx_hash || null,
    }));
  res.json(list);
});

// the order page polls this one for its own status
app.get(`${BASE}/api/orders/:id`, (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ id: order.id, status: order.status, product: order.product.name });
});

// where the buyer ends up after checkout
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

// arcpay pings us here once the money lands. verify the signature, then mark it paid
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
      order.status  = "paid";
      order.tx_hash = payload.tx_hash || null;
      order.payer   = payload.payer || null;
      order.paid_at = new Date().toISOString();
      console.log(`[footie] order ${payload.order_id} → PAID ✓`);
    } else {
      console.warn(`[footie] no in-memory order for ${payload.order_id} (may be test event)`);
    }
  }

  res.json({ received: true });
});

// off we go
app.listen(PORT, () => {
  console.log(`\n👟  Footie Lagos running at http://localhost:${PORT}${BASE}`);
  console.log(`    ArcPay backend: ${ARCPAY_URL}`);
  if (!API_KEY || !WH_SECRET) {
    console.warn("    ⚠️  ARCPAY_API_KEY / ARCPAY_WEBHOOK_SECRET not set — copy .env.example to .env\n");
  }
});
