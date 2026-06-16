# ArcPay - Live Demo Script (sign up -> connect API key -> take a real payment)

## The one-liner
**ArcPay is Stripe for stablecoins. Price in your local currency, get paid in dollars, settled on-chain in under a second, straight to your own wallet.**

## 30-second elevator pitch
> A merchant prices a product in naira or dirhams. With cards, the money takes 2 to 7 days, a gateway
> holds it, they pay 3 to 4 percent, and the local currency moves against them before it lands.
> ArcPay fixes all of it: the customer pays in USDC, it settles on-chain in under a second straight to
> the merchant's own wallet, the rate is locked at checkout, and ArcPay never touches the money.
> One flat 0.5 percent fee. Two API calls and a signed webhook to integrate.

## The four selling points (say these out loud)
1. **Dollar-stable, instantly** - settle in USDC in under a second, no FX erosion.
2. **Non-custodial, always** - funds go payer -> merchant wallet via smart contract. Lead with this.
3. **Rate locked at checkout** - what the customer sees is exactly what the merchant keeps.
4. **Two calls to integrate** - create a payment, verify one signed webhook.

---

## PRE-FLIGHT CHECKLIST (do all of this BEFORE you present)

This is a live integration demo. Rehearse it once end to end. Have ready:

- [ ] **MetaMask** installed, **Arc Testnet added**, and the wallet funded with **testnet USDC**
      (Circle faucet). Confirm a small USDC balance shows in the wallet.
- [ ] A **fresh email** to register a new merchant with (so the sign-up is genuinely live).
- [ ] Browser **logged out** of `arc.ogsnap.online/dashboard`.
- [ ] An **SSH session already open** on the VPS, sitting at the store's env file:
      `nano /var/www/arcpay/footie/.env` (so you only have to paste, not navigate, on stage).
- [ ] The **Footie Dubai store** tab open at `arc.ogsnap.online/try`.
- [ ] Three browser tabs: dashboard, the store, and the VPS terminal.
- [ ] Know your webhook URL by heart: `https://arc.ogsnap.online/try/arcpay/webhook`

> Golden rule: copy your API key and webhook secret into a scratch notepad the instant they appear.
> They are shown ONCE. If you lose them you have to rotate and start over.

---

## THE LIVE DEMO (about 7-8 minutes): from zero to a real payment

### Act 1 - Sign up live (90s)
Go to `arc.ogsnap.online/dashboard`. Click **Start integrating**.
> "I'm a brand new merchant. No account, nothing. Watch me go from zero to taking dollar payments,
> live, right now."

Fill **step 1**: business name (Footie Dubai), pick **E-commerce**, email.
Fill **step 2**: pick the **UAE / AED** market, click **Connect wallet** (MetaMask auto-fills your
address), set a password. Hit **Create my account**.
> "Notice I just connected my own wallet. That is where my money will land. ArcPay never sees it."

The credentials screen appears: **API key + webhook secret, shown once.**
> "This is the only time I will ever see these. The key authenticates my server. The webhook secret
> proves that payment alerts genuinely come from ArcPay. Let me copy them."

Copy both into your notepad. Click **Go to dashboard**.

### Act 2 - Connect the API key to my store (2 min)
This is the moment they want to see: wiring a real key into a real app.

Switch to your **VPS terminal** (already at `footie/.env`).
> "Here is my store's config. I'm dropping in the key and secret I just generated."

Paste:
```
ARCPAY_API_KEY=<the key you just copied>
ARCPAY_WEBHOOK_SECRET=<the secret you just copied>
```
Save (Ctrl+O, Enter, Ctrl+X), then restart the store so it picks them up:
```
pm2 restart footie
```
> "That is it. My store now talks to ArcPay with my credentials. No SDK bloat, no dashboards full of
> toggles. One key."

(Optional flourish) Back in the dashboard, open **Settings -> Integration snippet**.
> "And this is the entire server-side integration. One POST with that key, you get a checkout URL.
> That is the whole thing."

### Act 3 - Wire the webhook (60s)
In the dashboard go to **Settings -> Webhook**.
Paste the endpoint: `https://arc.ogsnap.online/try/arcpay/webhook`. Click **Save URL**.
Then click **Send test**.
> "I just told ArcPay where to notify my server when a payment lands. And that test event I just
> fired is **signed** - my server checks the signature before it trusts it. A webhook you cannot
> verify is just an open door. Ours is signed with HMAC, per-merchant secret, timing-safe."

### Act 4 - Take a real payment (2.5 min)
Switch to the **Footie Dubai store** (`/try`).
> "Now I'm the customer. Real store, priced in dirhams. The buyer never has to know what 4 USDC is,
> they just see AED 15."

Click **Pay with USDC**. The checkout opens.
> "Look at the breakdown: local price in AED, the live mid-market rate locked for this payment, and
> the exact USDC. That rate cannot drift now. Connect MetaMask, approve, pay."

Approve in MetaMask. Pay.

### Act 5 - The wow + proof on-chain (60s)
The store flips to **paid** with a delivery estimate. Switch to the dashboard.
> "And there it is. The webhook I just wired fired. My order is confirmed. Settled on-chain in under
> a second. My 99.5 percent is already in my wallet, the 0.5 percent fee taken."

Point at **Recent payments** (the new payment), the **balance**, and click **View tx / ArcScan**.
> "And I can prove it. Here is the transaction on the block explorer. No pending, no processing, no
> trust required. I signed up, wired my key, set my webhook, and took a real dollar-stable payment,
> live, in under eight minutes."

---

## IF SOMETHING GOES WRONG (live-demo safety nets)

- **"Invalid API key" at checkout** -> the store didn't pick up the new key. Re-check the `.env`
  paste and run `pm2 restart footie` again. (This is why we pre-open the SSH session.)
- **Payment seems stuck** -> give it a few seconds; the store polls ArcPay directly, it will flip.
  Worst case, refresh the store tab.
- **Don't want to risk the live .env edit** -> SAFE MODE: pre-wire the store before the talk and skip
  Act 2's paste. Instead, in Act 2 just SHOW the freshly generated key + the Integration snippet and
  say "this key goes into my server, like this." Everything else stays live.
- **No testnet USDC** -> top up from the Circle faucet (faucet.circle.com), pick Arc, paste your
  address. Always do this the night before.
- **Backup payment path** -> from the dashboard, **Create Payment Link** generates a checkout + QR
  using your account, with no store needed. Good fallback if the store misbehaves.

---

## WHAT MAKES THE INFRASTRUCTURE SPECIAL (deep-dive talking points)

1. **Smart-contract settlement, not a ledger entry.** Funds split atomically in one transaction,
   99.5 percent merchant / 0.5 percent fee. ArcPay is never in custody. Structurally non-custodial.
2. **Signed webhooks done right.** HMAC-SHA256 over the raw body, per-merchant secret, timing-safe
   verification, retried with backoff. Same discipline as Stripe, on a stablecoin rail.
3. **Belt-and-suspenders confirmation.** The store also polls ArcPay directly, so the buyer never
   waits on a delayed webhook. Two independent confirmation paths, one truth.
4. **FX locked at the source.** Live mid-market rate, kept warm in cache, frozen into the payment at
   creation. No mid-checkout surprise. Merchants can add their own FX buffer in basis points.
5. **Dollar-stable gas.** USDC is Arc's native gas token, so every fee is a predictable dollar amount.
6. **Multi-currency by config.** Naira, cedis, shillings, rand, dirhams - same rate-fetch/lock/convert
   path. Adding the dirham was a one-line change, not a rebuild.

---

## CLOSING LINE (pick one)
- "I just onboarded, wired my key, and took a real payment in front of you in minutes. That is the
  whole promise: dollar-stable, instant, non-custodial, and dead simple to integrate."
- "We didn't build a crypto checkout. We built settlement infrastructure that's invisible to the
  customer and impossible to mess with for the merchant."

---

## Q&A CHEAT SHEET
- **Why not just use USDC directly?** Customers think in local prices. ArcPay bridges local pricing
  to dollar settlement without the merchant touching FX.
- **What if the customer has no crypto?** Testnet faucet for the demo; on-ramps/wallet partners plug
  in here for production. Merchant integration doesn't change.
- **Is it live?** Yes, Arc testnet. Contract deployed, on-chain settlement, signed webhooks, two demo
  stores running.
- **Vs Paystack / Flutterwave?** They're custodial, settle in local currency, take days. We're
  non-custodial, settle in dollars, under a second. Different rail. Can sit alongside them.
- **Why Arc?** Sub-second finality, USDC as native gas, EVM-compatible.
- **Fee?** Flat 0.5 percent, merchant keeps 99.5 percent, settled atomically on-chain.
