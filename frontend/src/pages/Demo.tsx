import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, ChevronUp, ExternalLink, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORE_URL = import.meta.env.VITE_STORE_URL ?? "http://localhost:3100";

// Arc testnet params (for MetaMask add-chain)
const ARC_TESTNET = {
  chainId:         "0x4CEF52",        // 5042002 in hex
  chainName:       "Arc Testnet",
  // Arc's native token is really 6-decimal USDC, but wallets only accept 18 in the
  // add-network call, so we send 18 here. Doesn't affect payments — those use the
  // USDC ERC-20 token, which carries its own decimals.
  nativeCurrency:  { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls:         ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

// Tiny copy helper
function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs">
      <div className="min-w-0">
        <span className="text-gray-400 mr-2">{label}</span>
        <span className="font-mono text-gray-700 break-all">{value}</span>
      </div>
      <button onClick={copy} className="shrink-0 text-gray-400 hover:text-[#6c47ff]">
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// Collapsible step
function Step({
  n, title, subtitle, done, children,
}: {
  n: number; title: string; subtitle: string; done?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!done);
  return (
    <div className={`rounded-2xl border transition-all ${done ? "border-green-200 bg-green-50/40" : "border-gray-200 bg-white"}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
          done ? "bg-green-500 text-white" : "bg-[#6c47ff] text-white"
        }`}>
          {done ? <Check className="w-4 h-4" /> : n}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${done ? "text-green-800" : "text-gray-900"}`}>{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-300 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-300 shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

// Main page
export default function Demo() {
  const [metamaskAdded, setMetamaskAdded] = useState(false);
  const [usdcAdded,     setUsdcAdded]     = useState(false);
  const [addingChain,   setAddingChain]   = useState(false);
  const [chainError,    setChainError]    = useState<string | null>(null);

  const hasMetamask = typeof window !== "undefined" && !!(window as any).ethereum;

  async function addArcNetwork() {
    const eth = (window as any).ethereum;
    if (!eth) return;
    setAddingChain(true); setChainError(null);
    try {
      await eth.request({ method: "wallet_addEthereumChain", params: [ARC_TESTNET] });
      setMetamaskAdded(true);
    } catch (e: unknown) {
      setChainError(e instanceof Error ? e.message : "Could not add network");
    } finally { setAddingChain(false); }
  }

  async function addUsdcToken() {
    const eth = (window as any).ethereum;
    if (!eth) return;
    try {
      await eth.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address:  USDC_ADDRESS,
            symbol:   "USDC",
            decimals: 6,
            image:    "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
          },
        },
      });
      setUsdcAdded(true);
    } catch { /* user rejected — that's fine */ }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#ede9ff] px-4 py-1.5 text-sm font-medium text-[#6c47ff] mb-5">
          ⚡ Live on Arc Testnet
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Try the demo</h1>
        <p className="text-gray-500 max-w-md mx-auto">
          Four steps to make a real on-chain payment through the Footie Lagos demo store — takes about 3 minutes.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-4">

        {/* Step 1 — MetaMask */}
        <Step n={1} title="Install MetaMask" subtitle="The wallet you'll use to pay" done={hasMetamask}>
          {hasMetamask ? (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4" /> MetaMask detected — you're good.
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                MetaMask is a browser extension that lets you sign transactions and hold USDC.
              </p>
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#6c47ff] text-white text-sm font-semibold px-5 py-2.5 hover:opacity-90"
              >
                Download MetaMask <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <p className="text-xs text-gray-400">After installing, refresh this page.</p>
            </>
          )}
        </Step>

        {/* Step 2 — Add Arc network */}
        <Step n={2} title="Add Arc Testnet to MetaMask" subtitle="One click — we fill in all the details" done={metamaskAdded}>
          <p className="text-sm text-gray-500">
            Arc is a separate blockchain. You need to add it to MetaMask before you can use it.
          </p>
          {hasMetamask ? (
            <button
              onClick={addArcNetwork}
              disabled={addingChain}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6c47ff] text-white text-sm font-semibold px-5 py-2.5 hover:opacity-90 disabled:opacity-50"
            >
              {addingChain ? "Adding…" : metamaskAdded ? "✓ Arc Testnet added" : "Add Arc Testnet to MetaMask"}
            </button>
          ) : (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">Complete step 1 first.</p>
          )}
          {chainError && <p className="text-xs text-red-600">{chainError}</p>}
          <p className="text-xs text-gray-400">Or add it manually using these details:</p>
          <div className="space-y-1.5">
            <CopyLine label="Network name" value="Arc Testnet" />
            <CopyLine label="RPC URL"      value="https://rpc.testnet.arc.network" />
            <CopyLine label="Chain ID"     value="5042002" />
            <CopyLine label="Currency"     value="USDC" />
            <CopyLine label="Explorer"     value="https://testnet.arcscan.app" />
          </div>
        </Step>

        {/* Step 3 — Get test USDC */}
        <Step n={3} title="Get test USDC" subtitle="You'll need a small amount to pay with">
          <p className="text-sm text-gray-500">
            Arc testnet USDC is free — it's only for testing. Claim some from the Circle faucet.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#6c47ff] text-white text-sm font-semibold px-5 py-2.5 hover:opacity-90"
            >
              Open Circle Faucet <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {hasMetamask && (
              <button
                onClick={addUsdcToken}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2.5 hover:bg-gray-50"
              >
                {usdcAdded ? "✓ USDC added to wallet" : "Add USDC token to MetaMask"}
              </button>
            )}
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Quick guide:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
              <li>Open the faucet and paste your wallet address</li>
              <li>Pick <strong>Arc</strong> as the network and request USDC</li>
              <li>Wait a few seconds for it to arrive</li>
            </ol>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-400">USDC contract address on Arc:</p>
            <CopyLine label="USDC" value={USDC_ADDRESS} />
          </div>
        </Step>

        {/* Step 4 — Try the real Footie store */}
        <Step n={4} title="Open Footie Lagos and buy a shoe" subtitle="Pick a shoe, pay with USDC — watch it settle in under a second">
          <p className="text-sm text-gray-500">
            You're ready. Click a shoe, log in (or register quickly), go to checkout,
            and click "Pay with ArcPay". Approve in MetaMask and the payment settles on-chain in under a second.
          </p>
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-xs text-gray-500 space-y-1.5">
            <p className="font-semibold text-gray-700 text-sm">What happens when you pay:</p>
            <div className="space-y-1">
              {[
                ["Registered", "ArcPay backend pre-registers the payment on-chain"],
                ["Approve",    "You allow the ArcPay contract to spend your USDC"],
                ["Pay",        "USDC splits instantly — merchant gets 99.5%, 0.5% protocol fee"],
                ["Webhook",    "ArcPay fires a signed webhook — Footie confirms the order"],
                ["Done ✅",    "You land back on Footie Lagos with your order confirmed"],
              ].map(([label, desc]) => (
                <div key={label} className="flex gap-2">
                  <span className="font-semibold text-[#6c47ff] w-24 shrink-0">{label}</span>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </div>
          <a href={STORE_URL} target="_blank" rel="noreferrer" className="block">
            <Button className="w-full" size="lg">
              Open Footie Lagos store <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </a>
          <p className="text-xs text-gray-400 text-center">
            Opens in a new tab · running at {STORE_URL}
          </p>
        </Step>

      </div>

      {/* Footer note */}
      <div className="mt-8 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-xs text-gray-400 text-center">
        This is a testnet demo — no real money is involved. Everything runs on Arc testnet.
        <span className="mx-2">·</span>
        <Link to="/docs" className="text-[#6c47ff] hover:underline">Read the docs</Link>
      </div>
    </div>
  );
}
