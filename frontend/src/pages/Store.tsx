/**
 * Footie Lagos — demo shoe store powered by ArcPay.
 * Uses the API key from localStorage (set when you log into the dashboard).
 * In production the createPayment call would be server-side.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, Loader2, ExternalLink } from "lucide-react";
import { ArcPay } from "@/lib/sdk";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fmtNgn } from "@/lib/utils";

// ─── Catalogue ────────────────────────────────────────────────────────────────

const PRODUCTS = [
  { id: "af1",   name: "Air Force 1 Low",     price: 45_000, tag: "Classic",   emoji: "👟", color: "bg-slate-100"  },
  { id: "j1",    name: "Jordan 1 Retro High", price: 65_000, tag: "Premium",   emoji: "🏀", color: "bg-red-50"     },
  { id: "dunk",  name: "Nike Dunk Low",        price: 40_000, tag: "Popular",   emoji: "⚡", color: "bg-green-50"   },
  { id: "yzy",   name: "Yeezy 350 V2",         price: 80_000, tag: "Exclusive", emoji: "🔥", color: "bg-orange-50"  },
];

// ─── Product card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onBuy,
  loading,
}: {
  product: typeof PRODUCTS[0];
  onBuy: (p: typeof PRODUCTS[0]) => void;
  loading: boolean;
}) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      {/* Product image area */}
      <div className={`${product.color} h-44 flex items-center justify-center text-7xl select-none`}>
        {product.emoji}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6c47ff]">
              {product.tag}
            </span>
            <p className="font-bold text-gray-900 leading-tight">{product.name}</p>
          </div>
          <p className="font-bold text-gray-900 shrink-0">{fmtNgn(product.price)}</p>
        </div>

        <Button
          className="w-full"
          onClick={() => onBuy(product)}
          disabled={loading}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating payment…</>
          ) : (
            <><ShoppingBag className="w-4 h-4 mr-2" />Pay with USDC (ArcPay)</>
          )}
        </Button>
      </div>
    </Card>
  );
}

// ─── Store page ───────────────────────────────────────────────────────────────

export default function Store() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  // Detect return from successful payment (?paid=1&product=Air+Force+1)
  const searchParams = new URLSearchParams(window.location.search);
  const justPaid  = searchParams.get("paid") === "1";
  const paidProduct = searchParams.get("product") ?? "your order";

  const apiKey = localStorage.getItem("arcpay_key");

  async function handleBuy(product: typeof PRODUCTS[0]) {
    if (!apiKey) return;
    setError(null);
    setLoading(product.id);
    try {
      const client = new ArcPay(apiKey, import.meta.env.VITE_API_URL ?? "http://localhost:3001");
      const orderId = `FOOTIE-${product.id.toUpperCase()}-${Date.now()}`;
      const payment = await client.createPayment({
        amount:        product.price,
        currency:      "NGN",
        orderId,
        customerEmail: "customer@example.com",
        metadata:      { product_name: product.name },
      });
      // Navigate to the React checkout, carrying returnUrl + product info
      const params = new URLSearchParams({
        returnUrl: "/store",
        returnLabel: `Back to Footie Lagos`,
        product: product.name,
        orderId,
      });
      window.location.href = `/checkout/${payment.payment_id}?${params}`;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment creation failed");
      setLoading(null);
    }
  }

  // ── No API key ──────────────────────────────────────────────────────────────
  if (!apiKey) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
        <div className="text-5xl">👟</div>
        <h2 className="text-xl font-bold">Footie Lagos</h2>
        <p className="text-gray-500 text-sm">
          This demo store uses your ArcPay merchant account to create payments.
          Log into the dashboard first.
        </p>
        <Link to="/dashboard">
          <Button>Go to Dashboard →</Button>
        </Link>
      </div>
    );
  }

  // ── Store ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">

      {/* Header */}
      <div className="text-center mb-10">
        <p className="text-[#6c47ff] text-sm font-semibold mb-1">Demo store · Powered by ArcPay</p>
        <h1 className="text-4xl font-bold text-gray-900">👟 Footie Lagos</h1>
        <p className="text-gray-400 mt-2">Premium sneakers · Pay in stable dollars · No bank required</p>

        {/* ArcPay badge */}
        <div className="inline-flex items-center gap-2 mt-4 bg-[#ede9ff] text-[#6c47ff] rounded-full px-4 py-1.5 text-xs font-semibold">
          ⚡ Payments via ArcPay on Arc · Sub-second finality · Dollar-stable fees
        </div>
      </div>

      {/* Payment success banner */}
      {justPaid && (
        <div className="mb-6 rounded-2xl bg-green-50 border border-green-200 px-5 py-4 flex items-center gap-4">
          <div className="text-3xl">✅</div>
          <div>
            <p className="font-bold text-green-900">Payment confirmed — {paidProduct} is on its way!</p>
            <p className="text-sm text-green-700 mt-0.5">
              Settled in under a second ⚡ · Funds went straight to Footie's wallet.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 text-center">
          {error}
        </div>
      )}

      {/* Products grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {PRODUCTS.map(p => (
          <ProductCard
            key={p.id}
            product={p}
            onBuy={handleBuy}
            loading={loading === p.id}
          />
        ))}
      </div>

      {/* How it works */}
      <div className="mt-14 rounded-2xl bg-white p-6 border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4 text-center">How this store works</h3>
        <div className="grid sm:grid-cols-3 gap-6 text-sm text-gray-500 text-center">
          {[
            ["1", "Click Buy", "Footie's server calls ArcPay API with the ₦ price. Rate is locked."],
            ["2", "Pay in USDC", "You connect MetaMask and pay. Funds go straight to Footie's wallet."],
            ["3", "Shoes ship", "ArcPay fires a webhook. Footie marks the order paid and ships."],
          ].map(([n, t, d]) => (
            <div key={n} className="space-y-1">
              <div className="w-7 h-7 rounded-full bg-[#6c47ff] text-white text-xs font-bold flex items-center justify-center mx-auto">
                {n}
              </div>
              <p className="font-semibold text-gray-900">{t}</p>
              <p>{d}</p>
            </div>
          ))}
        </div>

        {/* Integration snippet */}
        <div className="mt-6 bg-[#1e1e2e] rounded-xl p-4 text-xs font-mono text-[#cdd6f4] leading-relaxed overflow-x-auto">
          <span className="text-[#6c7086]">{"// 2 lines of code on Footie's server:"}</span>
          {"\n"}
          <span className="text-[#89b4fa]">const</span>
          {" { payment_id } = "}
          <span className="text-[#a6e3a1]">await</span>
          {` arcpay.createPayment({ amount: 45000, currency: 'NGN' });`}
          {"\n"}
          <span className="text-[#89b4fa]">window</span>
          {`.location = \`/checkout/\${payment_id}\`;`}
          <span className="text-[#6c7086]">{"  // ← hosted checkout"}</span>
        </div>
      </div>

      <div className="mt-6 text-center">
        <a href="/docs#footie" className="inline-flex items-center gap-1 text-sm text-[#6c47ff] hover:underline">
          Read the full Footie integration guide <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
