import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Zap, Shield, DollarSign, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Animated checkout demo ───────────────────────────────────────────────────

const DEMO_STEPS = [
  {
    label: "Customer scans QR",
    ui: (
      <div className="space-y-3 text-center">
        <p className="text-xs text-gray-400 font-medium">Footie Lagos · Air Force 1</p>
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
        <p className="text-xs text-gray-400 font-medium">Footie Lagos · Air Force 1</p>
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
            Sending payment…
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

// ─── Copy button ──────────────────────────────────────────────────────────────

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

// ─── Comparison table ─────────────────────────────────────────────────────────

const COMPARISON = [
  { label: "Transaction fee",     arcpay: "0.5% flat",       paystack: "1.5% + ₦100",  flutter: "1.4%"          },
  { label: "Settlement time",     arcpay: "< 1 second ⚡",   paystack: "1–3 days",      flutter: "1–3 days"      },
  { label: "FX risk",             arcpay: "None (USDC)",      paystack: "High (NGN)",    flutter: "High (NGN)"    },
  { label: "Bank account needed", arcpay: "No",               paystack: "Yes",           flutter: "Yes"           },
  { label: "Non-custodial",       arcpay: "Yes",              paystack: "No",            flutter: "No"            },
  { label: "Local currency",      arcpay: "4 (live rate)",    paystack: "NGN only",      flutter: "NGN only"      },
  { label: "Webhook signed",      arcpay: "Yes (HMAC-SHA256)",paystack: "Yes",           flutter: "Yes"           },
];

function CompCell({ value, highlight }: { value: string; highlight?: boolean }) {
  const isYes = value === "Yes" || value.startsWith("Yes") || value.startsWith("<") || value.startsWith("None") || value.startsWith("0.5") || value.startsWith("4");
  const isNo  = value === "No"  || value.startsWith("No") || value.includes("days") || value.startsWith("High") || value.startsWith("1.5") || value.startsWith("1.4") || value.includes("only");
  return (
    <td className={`px-4 py-3 text-sm text-center ${highlight ? "bg-[#faf8ff]" : ""}`}>
      <span className={isYes && highlight ? "text-green-700 font-semibold" : isNo ? "text-gray-400" : ""}>
        {value}
      </span>
    </td>
  );
}

// ─── Supported markets ────────────────────────────────────────────────────────

const COUNTRIES = [
  { flag: "🇳🇬", country: "Nigeria",      code: "NGN", symbol: "₦",   currency: "Naira" },
  { flag: "🇬🇭", country: "Ghana",        code: "GHS", symbol: "₵",   currency: "Cedi" },
  { flag: "🇰🇪", country: "Kenya",        code: "KES", symbol: "KSh", currency: "Shilling" },
  { flag: "🇿🇦", country: "South Africa", code: "ZAR", symbol: "R",   currency: "Rand" },
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

// ─── Main page ────────────────────────────────────────────────────────────────

const SDK_SNIPPET = `// 3 lines — that's the whole integration
const { payment_id } = await arcpay.createPayment({
  amount: 45000, currency: 'NGN',   // ₦45,000
});
window.location = \`/checkout/\${payment_id}\`;`;

export default function Landing() {
  const rates = useLiveRates();
  return (
    <div className="bg-white">

      {/* ── Hero (Arc theme) ── */}
      <section className="relative arc-hero overflow-hidden">
        {/* faint Arc curve graphics */}
        <div className="arc-curve absolute -right-[20%] top-[-30%] w-[750px] h-[750px] pointer-events-none" />
        <div className="arc-curve absolute -right-[8%] top-[-10%] w-[500px] h-[500px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-28">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Left */}
            <div className="flex-1 text-center lg:text-left">
              <p className="arc-kicker text-xs sm:text-sm font-medium mb-6">{"{ USDC PAYMENTS ON ARC }"}</p>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold uppercase tracking-tight text-white leading-[0.98] mb-6">
                Accept USDC<br />
                in seconds
              </h1>
              <p className="text-lg sm:text-xl text-blue-100/80 leading-relaxed mb-9 max-w-lg mx-auto lg:mx-0">
                Drop in 3 lines of code. Dollar-stable fees, sub-second
                settlement, and funds that go straight to your wallet —
                real-world payments, built onchain.
              </p>
              <div className="flex flex-wrap items-center gap-3 justify-center lg:justify-start">
                <Link to="/dashboard"
                  className="rounded-xl bg-[#c7c2f7] text-[#0a1734] font-semibold px-6 h-12 inline-flex items-center hover:bg-white transition-colors">
                  Start integrating →
                </Link>
                <Link to="/docs"
                  className="rounded-xl border border-white/30 text-white font-semibold px-6 h-12 inline-flex items-center hover:bg-white/10 transition-colors">
                  View docs
                </Link>
                <Link to="/store" className="text-sm text-blue-100/70 hover:text-white underline underline-offset-4">
                  See demo store
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
            {/* Right — animated demo */}
            <div className="shrink-0">
              <AnimatedDemo />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div className="border-y border-gray-100 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-600">
          {[
            ["⚡", "< 1s finality"],
            ["💵", "0.5% flat fee"],
            ["🔒", "Non-custodial"],
            ["🌍", "4 local currencies"],
            ["🛡️", "Signed webhooks"],
          ].map(([icon, text]) => (
            <span key={text} className="flex items-center gap-1.5">
              <span>{icon}</span>
              <span className="font-medium">{text}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Why Arc ── */}
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
              body: "Payments confirm before the customer closes the tab. Stripe's 2–7 day settlement looks archaic next to this. That speed is structural, not a feature flag.",
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

      {/* ── Supported markets (live rates) ── */}
      <section className="bg-gray-50 py-20 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 px-3 py-1 text-xs font-semibold text-green-600 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live rates
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Price local. Get paid in dollars.</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Quote prices in your customers' currency. ArcPay converts at the live mid-market
              rate and locks it for the payment window — you settle in stable USDC.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                        1 USDC = {c.symbol}{Math.round(r.rate).toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-300">rate loading…</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            More markets coming soon — Tanzania, Uganda, Rwanda &amp; Egypt.
          </p>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How it works</h2>
          <div className="grid sm:grid-cols-4 gap-6 relative">
            {[
              { n: "1", title: "Sign up",   body: "Call POST /merchants. Get your API key and webhook secret." },
              { n: "2", title: "Create",    body: "Your server calls POST /payments with the amount in USDC or NGN." },
              { n: "3", title: "Customer pays", body: "They open the hosted checkout, connect wallet, and pay in one tap." },
              { n: "4", title: "Webhook + ship", body: "ArcPay fires a signed webhook. Verify it and fulfil the order." },
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

      {/* ── 3-line snippet ── */}
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
              <span className="text-[#6c7086]">{"// 3 lines — that's the whole integration"}</span>
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

      {/* ── Comparison table ── */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              ArcPay vs the alternatives
            </h2>
            <p className="text-gray-500">
              Built for the Arc era — not retrofitted onto old rails.
            </p>
          </div>
          <div className="rounded-2xl bg-white shadow-sm overflow-hidden border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-gray-400 font-medium text-xs uppercase tracking-wide">Feature</th>
                  <th className="px-4 py-3 text-center bg-[#faf8ff] text-[#6c47ff] font-bold">ArcPay</th>
                  <th className="px-4 py-3 text-center text-gray-400 font-medium">Paystack</th>
                  <th className="px-4 py-3 text-center text-gray-400 font-medium">Flutterwave</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(({ label, arcpay, paystack, flutter }, i) => (
                  <tr key={label} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="px-4 py-3 text-gray-700 font-medium">{label}</td>
                    <CompCell value={arcpay}   highlight />
                    <CompCell value={paystack} />
                    <CompCell value={flutter}  />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Nigeria angle ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20">
        <div className="arc-panel rounded-3xl text-white p-10 sm:p-14 text-center overflow-hidden relative">
          <p className="arc-kicker text-xs font-medium mb-5">{"{ BUILT FOR AFRICA }"}</p>
          <div className="text-4xl mb-4 flex items-center justify-center gap-1">
            {COUNTRIES.map(c => <span key={c.code}>{c.flag}</span>)}
          </div>
          <h2 className="text-3xl font-bold uppercase tracking-tight mb-4">Built for African merchants</h2>
          <p className="text-blue-100/80 text-lg leading-relaxed max-w-2xl mx-auto mb-8">
            Price your goods in Naira, Cedis, Shillings or Rand. Get paid in stable dollars.
            ArcPay shows customers the local price and converts at a locked rate —
            so no one loses money to FX drift between checkout and payment.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/dashboard"
              className="rounded-xl bg-[#c7c2f7] text-[#0a1734] font-semibold px-6 h-12 inline-flex items-center hover:bg-white transition-colors">
              Start accepting USDC
            </Link>
            <Link to="/store"
              className="rounded-xl border border-white/30 text-white font-semibold px-6 h-12 inline-flex items-center hover:bg-white/10 transition-colors">
              See Footie demo store
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <div className="font-bold text-[#6c47ff] text-lg mb-1">⚡ ArcPay</div>
              <p className="text-xs text-gray-400">Accept USDC payments in seconds.</p>
            </div>
            <nav className="flex flex-wrap items-center gap-6 text-sm text-gray-400">
              <Link to="/docs"      className="hover:text-gray-900 transition-colors">Docs</Link>
              <Link to="/store"     className="hover:text-gray-900 transition-colors">Demo store</Link>
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
