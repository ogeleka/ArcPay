import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Zap, Shield, DollarSign, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STORE_URL } from "@/lib/utils";

// Animated checkout demo

const DEMO_STEPS = [
  {
    label: "Customer scans QR",
    ui: (
      <div className="space-y-3 text-center">
        <p className="text-xs text-gray-400 font-medium">Footie Dubai · Air Force 1</p>
        <div className="text-3xl font-bold text-gray-900">₦45,000</div>
        <p className="text-sm text-gray-400">≈ 29.03 USDC · rate locked</p>
        {/* Mini QR */}
        <div className="mx-auto w-20 h-20 grid grid-cols-5 gap-0.5">
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className={`rounded-[1px] ${
              [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24,6,11,12,13,18,7,8,16,17][i] % 3 === 0
                ? "bg-gray-900" : "bg-gray-100"
            }`} />
          ))}
        </div>
        <p className="text-[10px] text-gray-300">Scan from mobile wallet</p>
      </div>
    ),
  },
  {
    label: "Approve & pay",
    ui: (
      <div className="space-y-4 text-center">
        <p className="text-xs text-gray-400 font-medium">Footie Dubai · Air Force 1</p>
        <div className="text-3xl font-bold text-gray-900">29.03 USDC</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2 text-xs text-green-700">
            <Check className="w-3.5 h-3.5" /> Registered on-chain
          </div>
          <div className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2 text-xs text-green-700">
            <Check className="w-3.5 h-3.5" /> USDC approved
          </div>
          <div className="flex items-center gap-2 bg-[#ede9ff] rounded-lg px-3 py-2 text-xs text-[#6c47ff] font-semibold animate-pulse">
            <div className="w-3 h-3 rounded-full border-2 border-[#6c47ff] border-t-transparent animate-spin" />
            Sending payment...
          </div>
        </div>
      </div>
    ),
  },
  {
    label: "Settled ⚡",
    ui: (
      <div className="space-y-3 text-center">
        <div className="text-5xl animate-[fadeIn_0.3s_ease]">✅</div>
        <div>
          <p className="text-xl font-bold text-gray-900">Payment complete</p>
          <p className="text-green-700 text-sm font-semibold mt-1">Settled in 0.4s ⚡</p>
          <p className="text-xs text-gray-400 mt-0.5">Arc's sub-second finality</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-left space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Amount</span>
            <span className="font-medium">29.03 USDC</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Fee</span>
            <span className="font-medium">0.15 USDC (0.5%)</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">To merchant</span>
            <span className="font-medium text-green-700">28.88 USDC ✓</span>
          </div>
        </div>
      </div>
    ),
  },
];

function AnimatedDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep(s => (s + 1) % DEMO_STEPS.length), 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative mx-auto" style={{ width: 240 }}>
      {/* Phone frame */}
      <div className="rounded-[2rem] bg-gray-900 p-2 shadow-2xl">
        <div className="rounded-[1.6rem] bg-white overflow-hidden">
          {/* Notch */}
          <div className="bg-gray-900 h-6 flex items-center justify-center">
            <div className="w-16 h-3 bg-gray-800 rounded-full" />
          </div>
          {/* Screen */}
          <div className="p-4 min-h-[260px] flex flex-col justify-center">
            <div className="text-[10px] text-[#6c47ff] font-bold text-center mb-3">⚡ ArcPay</div>
            {DEMO_STEPS[step].ui}
          </div>
          {/* Step dots */}
          <div className="flex justify-center gap-1.5 py-3">
            {DEMO_STEPS.map((_, i) => (
              <button key={i} onClick={() => setStep(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === step ? "bg-[#6c47ff]" : "bg-gray-200"}`}
              />
            ))}
          </div>
        </div>
      </div>
      {/* Label */}
      <p className="text-center text-xs text-blue-100/70 mt-3">{DEMO_STEPS[step].label}</p>
    </div>
  );
}

// Copy button

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy} className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// Supported markets

const COUNTRIES = [
  { flag: "🇳🇬", country: "Nigeria",      code: "NGN", symbol: "₦",   currency: "Naira" },
  { flag: "🇬🇭", country: "Ghana",        code: "GHS", symbol: "₵",   currency: "Cedi" },
  { flag: "🇰🇪", country: "Kenya",        code: "KES", symbol: "KSh", currency: "Shilling" },
  { flag: "🇿🇦", country: "South Africa", code: "ZAR", symbol: "R",   currency: "Rand" },
  { flag: "🇦🇪", country: "United Arab Emirates", code: "AED", symbol: "AED", currency: "Dirham" },
];

type RateMap = Record<string, { rate: number | null; stale: boolean }>;

function useLiveRates(): RateMap {
  const [rates, setRates] = useState<RateMap>({});
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/rates")
        .then(r => r.json())
        .then(d => { if (alive) setRates(d.rates ?? {}); })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000); // refresh each minute
    return () => { alive = false; clearInterval(id); };
  }, []);
  return rates;
}

// Main page

const SDK_SNIPPET = `// 3 lines - that's the whole integration
const { payment_id } = await arcpay.createPayment({
  amount: 45000, currency: 'NGN',   // ₦45,000
});
window.location = \`/checkout/\${payment_id}\`;`;

export default function Landing() {
  const rates = useLiveRates();
  return (
    <div className="bg-white">

      {/* Hero (Arc theme) */}
      <section className="relative arc-hero overflow-hidden">
        {/* faint Arc curve graphics */}
        <div className="arc-curve absolute -right-[20%] top-[-30%] w-[750px] h-[750px] pointer-events-none" />
        <div className="arc-curve absolute -right-[8%] top-[-10%] w-[500px] h-[500px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-28">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Left */}
            <div className="flex-1 text-center lg:text-left">
              <p className="arc-kicker text-xs sm:text-sm font-medium mb-6">{"USDC PAYMENT RAIL · ON ARC"}</p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold uppercase tracking-tight text-white leading-[0.98] mb-6">
                USDC payments that settle<br />
                straight to the merchant.
              </h1>
              <p className="text-lg sm:text-xl text-blue-100/80 leading-relaxed mb-4 max-w-lg mx-auto lg:mx-0">
                ArcPay is a non-custodial payment gateway on Arc. Price a checkout in
                naira, cedis, shillings, rand, dirhams, or dollars, and the customer pays
                USDC that settles directly to your wallet in a single on-chain
                transaction. The rate is locked at checkout, so the price can't drift.
                We never hold the funds.
              </p>
              <p className="text-sm text-blue-100/50 mb-9 max-w-lg mx-auto lg:mx-0">
                Dollar-stable payments for Africa, the Gulf and beyond.
              </p>
              {/* phone mockup - shown here on mobile, in the right column on desktop */}
              <div className="lg:hidden flex justify-center mb-9">
                <AnimatedDemo />
              </div>
              <div className="flex flex-wrap items-center gap-3 justify-center lg:justify-start">
                <Link to="/dashboard"
                  className="rounded-xl bg-[#c7c2f7] text-[#0a1734] font-semibold px-6 h-12 inline-flex items-center hover:bg-white transition-colors">
                  Start integrating →
                </Link>
                <Link to="/demo"
                  className="rounded-xl border border-white/30 text-white font-semibold px-6 h-12 inline-flex items-center hover:bg-white/10 transition-colors">
                  Try the demo ↗
                </Link>
                <Link to="/docs" className="text-sm text-blue-100/70 hover:text-white underline underline-offset-4">
                  View docs
                </Link>
              </div>
              {/* Live in */}
              <div className="mt-7 flex items-center gap-2 justify-center lg:justify-start text-sm text-blue-100/60">
                <span className="font-medium text-blue-100/80">Live in</span>
                <span className="flex items-center gap-1 text-lg">
                  {COUNTRIES.map(c => <span key={c.code} title={c.country}>{c.flag}</span>)}
                </span>
                <span>· more soon</span>
              </div>
            </div>
            {/* Right - animated demo (desktop only; on mobile it sits above the buttons) */}
            <div className="shrink-0 hidden lg:block">
              <AnimatedDemo />
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="border-y border-gray-100 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-600">
          {[
            "Deterministic finality on Arc",
            "0.5% flat fee, locked per invoice",
            "Non-custodial: contract to wallet",
            "5 local currencies + USD",
            "HMAC-signed webhooks",
          ].map(text => (
            <span key={text} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6c47ff]/60 shrink-0" />
              <span className="font-medium">{text}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Why Arc */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Why this only works on Arc
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Other blockchains add friction. Arc removes it.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: DollarSign,
              title: "Dollar-stable gas",
              body: "USDC is Arc's native gas token. Every fee is a predictable dollar amount. No ETH. No surprises. A merchant can quote exact transaction costs.",
            },
            {
              icon: Zap,
              title: "Sub-second finality",
              body: "Payments reach final settlement before the customer closes the tab. You can fulfil the order the instant it clears, instead of waiting days for a bank to confirm. The speed is structural, not a setting.",
            },
            {
              icon: Shield,
              title: "Non-custodial by design",
              body: "Funds flow from payer to your wallet via smart contract. ArcPay never holds your money. No bank, no FX desk, no middleman with your keys.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-[#ede9ff] flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-[#6c47ff]" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Supported markets (live rates) */}
      <section className="bg-gray-50 py-20 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 px-3 py-1 text-xs font-semibold text-green-600 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live rates
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Price local. Get paid in dollars.</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Quote prices in your customers' currency. ArcPay converts at the live mid-market
              rate and locks it for the payment window - you settle in stable USDC.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {COUNTRIES.map(c => {
              const r = rates[c.code];
              const live = !!r?.rate && !r.stale;
              return (
                <div key={c.code} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl leading-none">{c.flag}</span>
                    {live && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900">{c.country}</p>
                  <p className="text-xs text-gray-400 mb-3">{c.currency} · {c.code}</p>
                  <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                    {r?.rate ? (
                      <p className="text-sm font-mono font-semibold text-gray-900">
                        1 USDC = {c.symbol}{r.rate >= 100 ? Math.round(r.rate).toLocaleString() : r.rate.toFixed(2)}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-300">rate loading...</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            More markets coming soon - Egypt, Saudi Arabia, India &amp; beyond.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How it works</h2>
          <div className="grid sm:grid-cols-4 gap-6 relative">
            {[
              { n: "1", title: "Sign up",          body: "Register in the dashboard for your API key and webhook secret. No approval, no waiting." },
              { n: "2", title: "Create a payment", body: "Your server calls POST /payments with the amount in USDC or a local currency. You get a hosted checkout link back." },
              { n: "3", title: "Customer pays",    body: "They open the checkout, connect a wallet, and pay USDC in one tap. It settles straight to your wallet." },
              { n: "4", title: "Confirm & ship",   body: "ArcPay sends a signed webhook the moment it settles. Verify the signature and fulfil the order." },
            ].map(({ n, title, body }) => (
              <div key={n} className="relative text-center">
                <div className="w-10 h-10 rounded-full bg-[#6c47ff] text-white font-bold text-sm flex items-center justify-center mx-auto mb-3">
                  {n}
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3-line snippet */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">3 lines of code</h2>
          <p className="text-gray-500">That's the whole integration. Seriously.</p>
        </div>
        <div className="relative rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-[#181825] px-4 py-2 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <span className="ml-2 text-xs text-gray-500">checkout.js</span>
          </div>
          <div className="relative bg-[#1e1e2e]">
            <CopyBtn text={SDK_SNIPPET} />
            <pre className="text-[#cdd6f4] p-6 text-sm font-mono leading-relaxed overflow-x-auto">
              <span className="text-[#6c7086]">{"// 3 lines - that's the whole integration"}</span>
              {"\n"}
              <span className="text-[#89b4fa]">const</span>
              {" { payment_id } = "}
              <span className="text-[#a6e3a1]">await</span>
              {" arcpay.createPayment({\n"}
              {"  amount: "}
              <span className="text-[#fab387]">45000</span>
              {", currency: "}
              <span className="text-[#a6e3a1]">'NGN'</span>
              {"   "}
              <span className="text-[#6c7086]">{"// ₦45,000"}</span>
              {"\n});\n"}
              <span className="text-[#89b4fa]">window</span>
              {".location = `/checkout/${payment_id}`;"}
            </pre>
          </div>
        </div>
        <div className="text-center mt-6">
          <Link to="/docs"><Button variant="outline">Read the full docs →</Button></Link>
        </div>
      </section>

      {/* Nigeria angle */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20">
        <div className="arc-panel rounded-3xl text-white p-10 sm:p-14 text-center overflow-hidden relative">
          <p className="arc-kicker text-xs font-medium mb-5">{"{ PRICE LOCAL, EARN DOLLARS }"}</p>
          <div className="text-4xl mb-4 flex items-center justify-center gap-1">
            {COUNTRIES.map(c => <span key={c.code}>{c.flag}</span>)}
          </div>
          <h2 className="text-3xl font-bold uppercase tracking-tight mb-4">Built for merchants everywhere</h2>
          <p className="text-blue-100/80 text-lg leading-relaxed max-w-2xl mx-auto mb-8">
            Price your goods in Naira, Cedis, Shillings, Rand or Dirhams. Get paid in stable dollars.
            ArcPay shows customers the local price and converts at a locked rate -
            so no one loses money to FX drift between checkout and payment.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/dashboard"
              className="rounded-xl bg-[#c7c2f7] text-[#0a1734] font-semibold px-6 h-12 inline-flex items-center hover:bg-white transition-colors">
              Start accepting USDC
            </Link>
            <a href={STORE_URL}
              target="_blank" rel="noreferrer"
              className="rounded-xl border border-white/30 text-white font-semibold px-6 h-12 inline-flex items-center hover:bg-white/10 transition-colors">
              See Footie Dubai demo ↗
            </a>
          </div>
        </div>
      </section>

      {/* Try the demo */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="rounded-3xl border border-gray-100 bg-white shadow-sm p-8 sm:p-12">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#ede9ff] px-3 py-1 text-xs font-semibold text-[#6c47ff] mb-5">
                ⚡ Live on Arc testnet
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">See a real payment in under 3 minutes</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Two ways to try it. The guided walkthrough takes you through the Footie Dubai store step by step, or jump straight into the full shop - a complete e-commerce store with accounts, a cart, and ArcPay checkout.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/demo">
                  <Button size="lg">Guided walkthrough →</Button>
                </Link>
                <a href="/shop/" target="_blank" rel="noreferrer">
                  <Button size="lg" variant="outline">Open the full store ↗</Button>
                </a>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { n: "1", label: "Add Arc testnet to MetaMask",       sub: "One click - we fill in the details" },
                { n: "2", label: "Claim free test USDC from faucet",  sub: "Takes about 10 seconds to arrive"   },
                { n: "3", label: "Buy a shoe on Footie Dubai",        sub: "Real checkout, real on-chain tx"    },
                { n: "4", label: "Watch it settle in under 1 second", sub: "Sub-second finality on Arc"         },
              ].map(({ n, label, sub }) => (
                <div key={n} className="flex items-center gap-4 rounded-xl bg-gray-50 px-4 py-3">
                  <div className="w-7 h-7 rounded-full bg-[#6c47ff] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {n}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <div className="font-bold text-[#6c47ff] text-lg mb-1">⚡ ArcPay</div>
              <p className="text-xs text-gray-400">Accept USDC payments in seconds.</p>
            </div>
            <nav className="flex flex-wrap items-center gap-6 text-sm text-gray-400">
              <Link to="/docs"      className="hover:text-gray-900 transition-colors">Docs</Link>
              <a href={STORE_URL} target="_blank" rel="noreferrer" className="hover:text-gray-900 transition-colors">Demo store ↗</a>
              <Link to="/dashboard" className="hover:text-gray-900 transition-colors">Dashboard</Link>
              <a href="https://arc.network" target="_blank" rel="noreferrer"
                className="hover:text-gray-900 transition-colors">Arc ↗</a>
            </nav>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-300">© 2026 ArcPay. All rights reserved.</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-300">Built on</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#ede9ff] px-2.5 py-1 text-[#6c47ff] font-semibold">
                ⚡ Arc
              </span>
              <Check className="w-3.5 h-3.5 text-green-500" />
              <span className="text-gray-300">All systems operational</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
