import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Copy, Check, RefreshCw, ExternalLink, Loader2, AlertCircle, Webhook, Key, Plus, Eye, EyeOff, ShieldCheck,
  ShoppingBag, Repeat, User, Heart, Sparkles, ArrowLeft, ArrowRight, Wallet,
  LayoutDashboard, Receipt, Settings as SettingsIcon, FileText, LifeBuoy,
  Search, Download, Link2, CreditCard, Code2, LogOut, ChevronUp, ChevronDown, X } from "lucide-react";

import { useAccount, useSignMessage } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import {
  getMe, listPayments, createPayment, testWebhook, rotateKey, updateWebhookUrl,
  updateMerchant, changePassword, register, login, walletNonce, walletLogin,
  type MerchantProfile, type Payment, type PaymentList,
} from "@/lib/api";
import { fmtUsdc, fmtNgn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatsSkeleton, TableSkeleton } from "@/components/ui/skeleton";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildChart(payments: Payment[], days = 7) {
  const map: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    map[d.toISOString().slice(0, 10)] = 0;
  }
  for (const p of payments) {
    if (p.status !== "paid" && p.status !== "released") continue;
    const key = p.created_at.slice(0, 10);
    if (key in map) map[key] = +(((map[key] ?? 0) + p.amount / 1e6).toFixed(2));
  }
  return Object.entries(map).map(([date, usdc]) => ({ date: date.slice(5), usdc }));
}

function trunc(s: string, n = 10) { return s.slice(0, n) + "…"; }

// ─── Tiny copy hook ───────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return { copied, copy };
}

// ─── Create-payment modal ─────────────────────────────────────────────────────

function CreateModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [amount,   setAmount]   = useState("");
  const [currency, setCurrency] = useState<"USDC" | "NGN">("USDC");
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<{ url: string; qr: string } | null>(null);
  const { copied, copy } = useCopy();

  async function submit() {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    setLoading(true);
    try {
      const raw = currency === "NGN" ? n : Math.round(n * 1e6);
      const res = await createPayment(token, { amount: raw, currency });
      // Point to the React checkout, not the old HTML one
      const checkoutUrl = `${window.location.origin}/checkout/${res.payment_id}`;
      setResult({ url: checkoutUrl, qr: checkoutUrl });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <CardHeader>
          <h3 className="font-semibold">Create Payment Link</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          {!result ? (
            <>
              <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
                {(["USDC", "NGN"] as const).map(c => (
                  <button key={c} onClick={() => setCurrency(c)}
                    className={`flex-1 py-2 font-semibold transition-colors ${currency === c ? "bg-[#6c47ff] text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                    {c}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Amount ({currency === "NGN" ? "whole ₦" : "USDC"})
                </label>
                <input
                  type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()}
                  placeholder={currency === "NGN" ? "e.g. 4500" : "e.g. 5.00"}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#6c47ff]"
                />
                {currency === "NGN" && <p className="text-xs text-gray-400 mt-1">Converted to USDC at the live rate</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button className="flex-1" onClick={submit} disabled={loading || !amount}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-center">
                <QRCode value={result.qr} size={150} />
              </div>
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2 text-xs font-mono break-all">
                <span className="flex-1 truncate">{result.url}</span>
                <button onClick={() => copy(result.url)} className="shrink-0 text-gray-400 hover:text-[#6c47ff]">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setResult(null)}>New</Button>
                <a href={result.url} target="_blank" rel="noreferrer" className="flex-1">
                  <Button className="w-full" size="md">
                    Open <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </a>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ─── Auth view ────────────────────────────────────────────────────────────────

type AuthMode = "signin" | "register";

interface RegisterResult {
  token: string;
  api_key: string;
  webhook_secret: string;
  merchant_name: string;
}

const BUSINESS_TYPES = [
  { id: "ecommerce",  label: "E-commerce & Marketplaces", icon: ShoppingBag },
  { id: "saas",       label: "SaaS / Subscriptions",      icon: Repeat },
  { id: "individual", label: "Freelancer / Individual",   icon: User },
  { id: "ngo",        label: "NGO / Non-profit",          icon: Heart },
  { id: "other",      label: "Other",                     icon: Sparkles },
];

const USE_CASES = [
  "Sell physical goods",
  "Digital products",
  "Accept service payments",
  "Build for my clients",
];

// Countries we operate in — each maps to its local currency for FX conversion
const COUNTRIES = [
  { code: "NG", flag: "🇳🇬", name: "Nigeria",      currency: "NGN", symbol: "₦"   },
  { code: "GH", flag: "🇬🇭", name: "Ghana",        currency: "GHS", symbol: "₵"   },
  { code: "KE", flag: "🇰🇪", name: "Kenya",        currency: "KES", symbol: "KSh" },
  { code: "ZA", flag: "🇿🇦", name: "South Africa", currency: "ZAR", symbol: "R"   },
];

const EXPLORER = "https://testnet.arcscan.app";

const inputCls = "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#6c47ff] transition-colors";
const isEmail  = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const isAddr   = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s.trim());

function AuthView({ onLogin }: { onLogin: (token: string, m: MerchantProfile) => void }) {
  const [mode, setMode] = useState<AuthMode>("signin");

  // sign-in
  const [siEmail, setSiEmail] = useState("");
  const [siPass,  setSiPass]  = useState("");
  const [showPass, setShowPass] = useState(false);
  const [siErr,   setSiErr]   = useState<string | null>(null);
  const [siBusy,  setSiBusy]  = useState(false);

  // wallet auth (shared by sign-in + register auto-fill)
  const { address, isConnected } = useAccount();
  const { openConnectModal }     = useConnectModal();
  const { signMessageAsync }     = useSignMessage();
  const [walletBusy,  setWalletBusy]  = useState(false);
  const [pendingLogin, setPendingLogin] = useState(false);

  async function doWalletLogin(addr: string) {
    setWalletBusy(true); setSiErr(null);
    try {
      const { message } = await walletNonce(addr);
      const signature   = await signMessageAsync({ message });
      const { token }   = await walletLogin(addr, signature);
      const m = await getMe(token);
      localStorage.setItem("arcpay_token", token);
      onLogin(token, m);
    } catch (e: unknown) {
      setSiErr(e instanceof Error ? e.message : "Wallet sign-in failed");
    } finally { setWalletBusy(false); }
  }

  function handleWalletSignIn() {
    setSiErr(null);
    if (!isConnected || !address) {
      setPendingLogin(true);
      openConnectModal?.();
      return;
    }
    doWalletLogin(address);
  }

  // Connect a wallet just to fill the registration address field
  const [pendingFill, setPendingFill] = useState(false);
  function connectWalletForAddress() {
    if (isConnected && address) { setWallet(address); return; }
    setPendingFill(true);
    openConnectModal?.();
  }

  // React once the wallet connects, depending on what the user asked for
  useEffect(() => {
    if (!isConnected || !address) return;
    if (pendingLogin) { setPendingLogin(false); doWalletLogin(address); }
    if (pendingFill)  { setPendingFill(false);  setWallet(address); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLogin, pendingFill, isConnected, address]);

  // register wizard
  const [step,        setStep]        = useState<1 | 2>(1);
  const [name,        setName]        = useState("");
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [website,     setWebsite]     = useState("");
  const [regEmail,    setRegEmail]    = useState("");
  const [useCase,     setUseCase]     = useState<string | null>(null);
  const [market,      setMarket]      = useState("NG");      // country code, or "GLOBAL" for USDC-only
  const [wallet,      setWallet]      = useState("");
  const [regPass,     setRegPass]     = useState("");
  const [showRPass,   setShowRPass]   = useState(false);
  const [regErr,      setRegErr]      = useState<string | null>(null);
  const [regBusy,     setRegBusy]     = useState(false);
  const [regResult,   setRegResult]   = useState<RegisterResult | null>(null);

  const { copied: copiedKey, copy: copyKey } = useCopy();
  const { copied: copiedSec, copy: copySec } = useCopy();

  const step1Valid = name.trim() && businessType && isEmail(regEmail);

  async function handleSignIn() {
    if (!siEmail.trim() || !siPass) return;
    setSiBusy(true); setSiErr(null);
    try {
      const { token } = await login(siEmail.trim(), siPass);
      const m = await getMe(token);
      localStorage.setItem("arcpay_token", token);
      onLogin(token, m);
    } catch (e: unknown) {
      setSiErr(e instanceof Error ? e.message : "Incorrect email or password");
    } finally { setSiBusy(false); }
  }

  function goToStep2() {
    setRegErr(null);
    if (!step1Valid) { setRegErr("Please fill in your name, business type, and a valid email."); return; }
    setStep(2);
  }

  async function handleRegister() {
    setRegErr(null);
    if (!isAddr(wallet)) { setRegErr("Enter a valid wallet address (0x… 42 characters). Copy it from MetaMask."); return; }
    if (regPass.length < 8) { setRegErr("Password must be at least 8 characters."); return; }
    setRegBusy(true);
    try {
      const picked = COUNTRIES.find(c => c.code === market);
      const res = await register({
        name: name.trim(),
        email: regEmail.trim(),
        wallet_address: wallet.trim(),
        password: regPass,
        business_type: businessType ?? undefined,
        website: website.trim() || undefined,
        use_case: useCase ?? undefined,
        default_currency: market === "GLOBAL" ? "USDC" : (picked?.currency ?? "USDC"),
      });
      setRegResult({ token: res.token, api_key: res.api_key, webhook_secret: res.webhook_secret, merchant_name: name.trim() });
    } catch (e: unknown) {
      setRegErr(e instanceof Error ? e.message : "Registration failed.");
    } finally { setRegBusy(false); }
  }

  async function handleEnterDashboard() {
    if (!regResult) return;
    try {
      const m = await getMe(regResult.token);
      localStorage.setItem("arcpay_token", regResult.token);
      onLogin(regResult.token, m);
    } catch { setSiErr("Could not load profile."); }
  }

  function switchMode(m: AuthMode) { setMode(m); setRegErr(null); setSiErr(null); }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <span className="text-3xl">⚡</span>
          <h1 className="text-2xl font-bold mt-2 tracking-tight">ArcPay</h1>
          <p className="text-sm text-gray-500 mt-1">USDC payment gateway on Arc</p>
        </div>

        <Card>
          {/* ─── SIGN IN ─── */}
          {mode === "signin" && (
            <CardBody className="space-y-4 pt-6">
              <div>
                <h2 className="text-lg font-bold">Welcome back</h2>
                <p className="text-sm text-gray-400 mt-0.5">Sign in to your merchant dashboard.</p>
              </div>
              {siErr && (
                <div className="flex gap-2 items-center rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />{siErr}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
                <input type="email" value={siEmail} onChange={e => setSiEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSignIn()}
                  placeholder="you@example.com" className={inputCls} autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={siPass}
                    onChange={e => setSiPass(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSignIn()}
                    placeholder="••••••••" className={`${inputCls} pr-10`} />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button className="w-full" onClick={handleSignIn} disabled={siBusy || !siEmail || !siPass}>
                {siBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</> : "Sign in"}
              </Button>

              {/* divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-gray-100" />
                <span className="text-[10px] uppercase tracking-widest text-gray-300">or</span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>

              {/* Wallet sign-in */}
              <button
                onClick={handleWalletSignIn}
                disabled={walletBusy}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                {walletBusy
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Check your wallet…</>
                  : <><Wallet className="w-4 h-4 text-[#6c47ff]" />Sign in with wallet</>}
              </button>
              <p className="text-[11px] text-center text-gray-400 -mt-1">
                Logs you in if this wallet is linked to an account.
              </p>

              <p className="text-xs text-center text-gray-400">
                New to ArcPay?{" "}
                <button onClick={() => switchMode("register")} className="text-[#6c47ff] font-semibold hover:underline">
                  Start integrating →
                </button>
              </p>
            </CardBody>
          )}

          {/* ─── REGISTER WIZARD ─── */}
          {mode === "register" && !regResult && (
            <>
              {/* progress header */}
              <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  {[1, 2].map((s, i) => (
                    <div key={s} className="flex items-center gap-3 flex-1 last:flex-none">
                      <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-colors ${
                        step >= s ? "bg-[#6c47ff] text-white" : "bg-gray-100 text-gray-400"
                      }`}>
                        {step > s ? <Check className="w-4 h-4" /> : s}
                      </div>
                      <span className={`text-xs font-semibold ${step >= s ? "text-gray-900" : "text-gray-400"}`}>
                        {s === 1 ? "Who you are" : "Set up payments"}
                      </span>
                      {i === 0 && <div className={`h-px flex-1 ${step > 1 ? "bg-[#6c47ff]" : "bg-gray-200"}`} />}
                    </div>
                  ))}
                </div>
              </div>

              <CardBody className="space-y-4 pt-5">
                {regErr && (
                  <div className="flex gap-2 items-center rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />{regErr}
                  </div>
                )}

                {/* ── STEP 1 · Who you are ── */}
                {step === 1 && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Business / Name <span className="text-red-400">*</span></label>
                      <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Footie Lagos" className={inputCls} autoFocus />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2">What are you building? <span className="text-red-400">*</span></label>
                      <div className="grid grid-cols-1 gap-2">
                        {BUSINESS_TYPES.map(({ id, label, icon: Icon }) => (
                          <button key={id} type="button" onClick={() => setBusinessType(id)}
                            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm text-left transition-all ${
                              businessType === id
                                ? "border-[#6c47ff] bg-[#6c47ff]/5 ring-1 ring-[#6c47ff]"
                                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                            }`}>
                            <Icon className={`w-4 h-4 shrink-0 ${businessType === id ? "text-[#6c47ff]" : "text-gray-400"}`} />
                            <span className={businessType === id ? "font-medium text-gray-900" : "text-gray-600"}>{label}</span>
                            {businessType === id && <Check className="w-4 h-4 text-[#6c47ff] ml-auto" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Website <span className="text-gray-300">(optional)</span></label>
                      <input type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yourbusiness.com" className={inputCls} />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email <span className="text-red-400">*</span></label>
                      <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && goToStep2()}
                        placeholder="you@example.com" className={inputCls} />
                    </div>

                    <Button className="w-full" onClick={goToStep2} disabled={!step1Valid}>
                      Continue <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                    <p className="text-xs text-center text-gray-400">
                      Already have an account?{" "}
                      <button onClick={() => switchMode("signin")} className="text-[#6c47ff] font-semibold hover:underline">Sign in</button>
                    </p>
                  </>
                )}

                {/* ── STEP 2 · Set up payments ── */}
                {step === 2 && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2">How will you use ArcPay? <span className="text-gray-300">(optional)</span></label>
                      <div className="flex flex-wrap gap-2">
                        {USE_CASES.map(uc => (
                          <button key={uc} type="button" onClick={() => setUseCase(useCase === uc ? null : uc)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                              useCase === uc
                                ? "border-[#6c47ff] bg-[#6c47ff] text-white"
                                : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                            }`}>
                            {uc}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2">Where are you based?</label>
                      <div className="grid grid-cols-2 gap-2">
                        {COUNTRIES.map(c => (
                          <button key={c.code} type="button"
                            onClick={() => setMarket(c.code)}
                            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                              market === c.code
                                ? "border-[#6c47ff] bg-[#6c47ff]/5 ring-1 ring-[#6c47ff]"
                                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                            }`}>
                            <span className="text-xl leading-none">{c.flag}</span>
                            <div className="min-w-0">
                              <p className={`text-sm font-medium truncate ${market === c.code ? "text-[#6c47ff]" : "text-gray-700"}`}>{c.name}</p>
                              <p className="text-[10px] text-gray-400">{c.currency} {c.symbol}</p>
                            </div>
                          </button>
                        ))}
                        {/* Global / USDC-only — an equal, first-class choice */}
                        <button type="button" onClick={() => setMarket("GLOBAL")}
                          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all col-span-2 ${
                            market === "GLOBAL"
                              ? "border-[#6c47ff] bg-[#6c47ff]/5 ring-1 ring-[#6c47ff]"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }`}>
                          <span className="text-xl leading-none">🌍</span>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${market === "GLOBAL" ? "text-[#6c47ff]" : "text-gray-700"}`}>No local currency</p>
                            <p className="text-[10px] text-gray-400">Price directly in USDC</p>
                          </div>
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {market === "GLOBAL"
                          ? "You'll price directly in USDC — no FX conversion."
                          : `You'll price in ${COUNTRIES.find(c => c.code === market)?.currency ?? "your currency"}; customers pay in USDC at the live rate.`}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-gray-500">Wallet address <span className="text-red-400">*</span></label>
                        <button type="button" onClick={connectWalletForAddress}
                          className="flex items-center gap-1.5 text-xs font-semibold text-[#6c47ff] hover:underline">
                          <Wallet className="w-3.5 h-3.5" />
                          {isConnected && address ? "Use connected wallet" : "Connect wallet"}
                        </button>
                      </div>
                      <div className="relative">
                        <Wallet className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input value={wallet} onChange={e => setWallet(e.target.value)}
                          placeholder="0xD4F3…7b87" className={`${inputCls} pl-9 font-mono`} />
                      </div>
                      <p className="text-xs mt-1 text-gray-400">Where your USDC settles — connect MetaMask to fill this automatically. Non-custodial.</p>
                      {wallet && !isAddr(wallet) && (
                        <p className="text-xs text-red-500 mt-1">That doesn't look like a valid wallet address.</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Dashboard password <span className="text-red-400">*</span></label>
                      <div className="relative">
                        <input type={showRPass ? "text" : "password"} value={regPass}
                          onChange={e => setRegPass(e.target.value)}
                          placeholder="Min. 8 characters" className={`${inputCls} pr-10`} />
                        <button type="button" onClick={() => setShowRPass(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showRPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" onClick={() => { setStep(1); setRegErr(null); }} className="px-4">
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                      <Button className="flex-1" onClick={handleRegister} disabled={regBusy}>
                        {regBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account…</> : "Create my account →"}
                      </Button>
                    </div>
                  </>
                )}
              </CardBody>
            </>
          )}

          {/* ─── REGISTER SUCCESS — credentials shown once ─── */}
          {mode === "register" && regResult && (
            <CardBody className="space-y-4 pt-6">
              <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3">
                <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">You're all set, {regResult.merchant_name}!</p>
                  <p className="text-xs text-green-700 mt-0.5">Copy your credentials below — they won't be shown again.</p>
                </div>
              </div>
              {[
                { label: "API Key", value: regResult.api_key, onCopy: () => copyKey(regResult.api_key), copied: copiedKey },
                { label: "Webhook Secret", value: regResult.webhook_secret, onCopy: () => copySec(regResult.webhook_secret), copied: copiedSec },
              ].map(({ label, value, onCopy, copied }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
                  <div className="flex gap-2">
                    <code className="flex-1 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-xs font-mono break-all leading-relaxed">{value}</code>
                    <button onClick={onCopy} className="shrink-0 rounded-xl border border-gray-200 px-3 hover:bg-gray-50">
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                    </button>
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                The API key is for your server only — never put it in frontend code. Your password is how you log in here.
              </div>
              <Button className="w-full" onClick={handleEnterDashboard}>Go to dashboard →</Button>
            </CardBody>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Dashboard view ───────────────────────────────────────────────────────────

function DashboardView({ token, merchant: initialMerchant, onLogout }: {
  token: string;
  merchant: MerchantProfile;
  onLogout: () => void;
}) {
  const [merchant,    setMerchant]    = useState(initialMerchant);
  const [paymentList, setPaymentList] = useState<PaymentList>({ data: [], page: 1, limit: 25, total: 0, has_more: false });
  const [statusFilter, setStatusFilter] = useState("all");
  const [page,        setPage]        = useState(1);
  const [showModal,   setShowModal]   = useState(false);
  const [rates,       setRates]       = useState<Record<string, number>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // Profile state
  const [profileName,    setProfileName]    = useState(merchant.name);
  const [profileEmail,   setProfileEmail]   = useState(merchant.email);
  const [profileWallet,  setProfileWallet]  = useState(merchant.wallet_address);
  const [profileSaving,  setProfileSaving]  = useState(false);
  const [profileMsg,     setProfileMsg]     = useState<string | null>(null);

  // Connect wallet → fill the settlement address field
  const { address: connectedAddr, isConnected: walletConnected } = useAccount();
  const { openConnectModal: openWalletModal } = useConnectModal();
  const [pendingWalletFill, setPendingWalletFill] = useState(false);
  function connectProfileWallet() {
    if (walletConnected && connectedAddr) { setProfileWallet(connectedAddr); return; }
    setPendingWalletFill(true);
    openWalletModal?.();
  }
  useEffect(() => {
    if (pendingWalletFill && walletConnected && connectedAddr) {
      setPendingWalletFill(false);
      setProfileWallet(connectedAddr);
    }
  }, [pendingWalletFill, walletConnected, connectedAddr]);
  const [curPass,        setCurPass]        = useState("");
  const [newPass,        setNewPass]        = useState("");
  const [showCurPass,    setShowCurPass]    = useState(false);
  const [showNewPass,    setShowNewPass]    = useState(false);
  const [passSaving,     setPassSaving]     = useState(false);
  const [passMsg,        setPassMsg]        = useState<string | null>(null);

  // Webhook panel state
  const [webhookUrl,    setWebhookUrl]    = useState(merchant.webhook_url ?? "");
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [webhookMsg,    setWebhookMsg]    = useState<string | null>(null);
  const [testingHook,   setTestingHook]   = useState(false);
  const [showSecret,    setShowSecret]    = useState(false);
  const { copied: secretCopied, copy: copySecret } = useCopy();

  // Markup panel state
  const [markupBps,     setMarkupBps]     = useState(merchant.markup_bps ?? 0);
  const [markupSaving,  setMarkupSaving]  = useState(false);
  const [markupMsg,     setMarkupMsg]     = useState<string | null>(null);

  // Rotate key state
  const [rotating,   setRotating]   = useState(false);
  const [newKey,     setNewKey]     = useState<string | null>(null);
  const { copied: keyCopied, copy: copyKey } = useCopy();
  const { copy: copyUrl } = useCopy();

  // Shell + payments-page state
  const [activeView,   setActiveView]   = useState<"home" | "payments" | "settings">("home");
  const [settingsTab,  setSettingsTab]  = useState<"profile" | "password" | "apikey" | "webhook" | "currency" | "snippet">("profile");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Open a specific settings panel from the sidebar
  function openSetting(tab: typeof settingsTab) {
    setSettingsTab(tab);
    setActiveView("settings");
    setSettingsOpen(true);
  }
  const [search,     setSearch]     = useState("");
  const [exporting,  setExporting]  = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const refresh = useCallback(async (sf = statusFilter, pg = page, q = search) => {
    const [m, ps] = await Promise.all([getMe(token), listPayments(token, sf, pg, 25, q)]);
    setMerchant(m);
    setPaymentList(ps);
    setLoadingData(false);
    setLastRefresh(new Date());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter, page, search]);

  useEffect(() => {
    refresh();
    // Fetch live FX rates for all supported currencies
    fetch("/api/rates")
      .then(r => r.json())
      .then(d => {
        const map: Record<string, number> = {};
        for (const [code, v] of Object.entries(d.rates ?? {})) {
          const rate = (v as { rate?: number }).rate;
          if (rate) map[code] = rate;
        }
        setRates(map);
      })
      .catch(() => {});
    // Live poll every 10 s
    pollRef.current = setInterval(refresh, 10_000);
    return () => clearInterval(pollRef.current);
  }, [refresh]);

  // Debounced search — reset to page 1
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); refresh(statusFilter, 1, search); }, 350);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ── Webhook actions ────────────────────────────────────────────────────────
  async function saveWebhook() {
    setWebhookSaving(true); setWebhookMsg(null);
    try {
      await updateWebhookUrl(token, webhookUrl);
      setWebhookMsg("Saved ✓");
    } catch { setWebhookMsg("Save failed"); }
    finally { setWebhookSaving(false); }
  }

  async function saveMarkup() {
    setMarkupSaving(true); setMarkupMsg(null);
    try {
      await updateMerchant(token, { markup_bps: markupBps });
      setMarkupMsg("Saved ✓");
    } catch { setMarkupMsg("Save failed"); }
    finally { setMarkupSaving(false); }
  }

  async function sendTestWebhook() {
    setTestingHook(true); setWebhookMsg(null);
    try {
      const r = await testWebhook(token);
      setWebhookMsg(r.message);
    } catch (e: unknown) {
      setWebhookMsg(e instanceof Error ? e.message : "Delivery failed");
    } finally { setTestingHook(false); }
  }

  async function handleRotate() {
    if (!confirm("Revoke the current API key and issue a new one?")) return;
    setRotating(true);
    try {
      const r = await rotateKey(token);
      setNewKey(r.api_key);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally { setRotating(false); }
  }

  async function saveProfile() {
    if (!profileName.trim()) { setProfileMsg("Name cannot be empty"); return; }
    if (!profileEmail.trim()) { setProfileMsg("Email cannot be empty"); return; }
    if (profileWallet && !/^0x[0-9a-fA-F]{40}$/.test(profileWallet.trim())) {
      setProfileMsg("Invalid wallet address"); return;
    }
    setProfileSaving(true); setProfileMsg(null);
    try {
      await updateMerchant(token, {
        name:           profileName.trim(),
        email:          profileEmail.trim(),
        wallet_address: profileWallet.trim(),
      });
      setProfileMsg("Saved ✓");
      refresh();
    } catch (e: unknown) {
      setProfileMsg(e instanceof Error ? e.message : "Save failed");
    } finally { setProfileSaving(false); }
  }

  async function savePassword() {
    if (!curPass || !newPass) { setPassMsg("Both fields are required"); return; }
    if (newPass.length < 8) { setPassMsg("New password must be at least 8 characters"); return; }
    setPassSaving(true); setPassMsg(null);
    try {
      await changePassword(token, curPass, newPass);
      setPassMsg("Password changed ✓");
      setCurPass(""); setNewPass("");
    } catch (e: unknown) {
      setPassMsg(e instanceof Error ? e.message : "Failed");
    } finally { setPassSaving(false); }
  }

  async function saveCurrency(code: string) {
    setMerchant(m => ({ ...m, default_currency: code }));
    try { await updateMerchant(token, { default_currency: code }); } catch { /* non-blocking */ }
  }

  // Export current filter to CSV (pages through up to 2,000 rows)
  async function exportCsv() {
    setExporting(true);
    try {
      const all: Payment[] = [];
      let pg = 1;
      for (let i = 0; i < 20; i++) {
        const res = await listPayments(token, statusFilter, pg, 100, search);
        all.push(...res.data);
        if (!res.has_more) break;
        pg++;
      }
      const header = ["payment_id", "status", "amount_usdc", "amount_local", "currency", "order_id", "payer", "tx_hash", "created_at", "paid_at"];
      const lines = all.map(p => [
        p.id, p.status, (p.amount / 1e6).toFixed(6), p.amount_ngn ?? "", p.currency,
        p.order_id ?? "", p.payer ?? "", p.tx_hash ?? "", p.created_at, p.paid_at ?? "",
      ]);
      const csv = [header, ...lines]
        .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `arcpay-payments-${statusFilter}-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Export failed");
    } finally { setExporting(false); }
  }

  // Checklist completion (A3) — derived from merchant state
  const hasWallet  = !!merchant.wallet_address;
  const hasWebhook = !!merchant.webhook_url;
  const hasPayment = merchant.total_payments > 0;
  const hasMarkup  = (merchant.markup_bps ?? 0) > 0;
  const coreDone   = hasWallet && hasWebhook && hasPayment;

  // "All set" banner — dismiss permanently per merchant
  const bannerKey = `arcpay_setup_done_${merchant.id}`;
  const [bannerDismissed, setBannerDismissed] = useState(
    () => localStorage.getItem(bannerKey) === "1"
  );
  function dismissBanner() {
    localStorage.setItem(bannerKey, "1");
    setBannerDismissed(true);
  }

  // ── Chart data ─────────────────────────────────────────────────────────────
  const payments  = paymentList.data;
  const chartData = buildChart(payments);
  const todayKey  = new Date().toISOString().slice(0, 10);
  const todayVol  = payments
    .filter(p => p.created_at.slice(0, 10) === todayKey && (p.status === "paid" || p.status === "released"))
    .reduce((s, p) => s + p.amount / 1e6, 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  const NAV = [
    { id: "home",     label: "Dashboard", icon: LayoutDashboard },
    { id: "payments", label: "Payments",  icon: Receipt },
    { id: "settings", label: "Settings",  icon: SettingsIcon },
  ] as const;

  const SETTINGS_TABS = [
    { id: "profile",  label: "Profile",            icon: User },
    { id: "password", label: "Password",           icon: ShieldCheck },
    { id: "apikey",   label: "API Key",            icon: Key },
    { id: "webhook",  label: "Webhook",            icon: Webhook },
    { id: "currency", label: "Currency & markup",  icon: Repeat },
    { id: "snippet",  label: "Integration snippet", icon: Code2 },
  ] as const;

  const settingsLabel = SETTINGS_TABS.find(t => t.id === settingsTab)?.label ?? "Settings";

  const balanceStr = merchant.usdc_balance ? `${parseFloat(merchant.usdc_balance).toFixed(2)} USDC` : "—";

  // "Your tools" cards on Home — tailored to the merchant's business type
  type Tool = { icon: typeof Link2; title: string; desc: string; onClick?: () => void; soon?: boolean };
  const TOOLS: Tool[] = (() => {
    const link     = { icon: Link2,      title: "Payment links",  desc: "Create a shareable pay link", onClick: () => setShowModal(true) };
    const checkout = { icon: CreditCard, title: "Hosted checkout", desc: "ArcPay-hosted pay page",      onClick: () => setShowModal(true) };
    const hooks    = { icon: Webhook,    title: "Webhooks",        desc: "Get notified on payment",     onClick: () => openSetting("webhook") };
    const docs     = { icon: Code2,      title: "API & SDK",       desc: "Integrate in minutes",        onClick: () => window.open("/docs", "_blank") };
    const invoices = { icon: FileText,   title: "Invoices",        desc: "Coming soon",                 soon: true };
    switch (merchant.business_type) {
      case "saas":       return [link, hooks, docs];
      case "individual": return [link, invoices, docs];
      case "ngo":        return [link, checkout, hooks];
      case "ecommerce":  return [link, checkout, hooks];
      default:           return [link, checkout, docs];
    }
  })();

  // Local-currency equivalent — follows the merchant's chosen currency
  const CURRENCY_SYM: Record<string, string> = { NGN: "₦", GHS: "₵", KES: "KSh", ZAR: "R", USD: "$", USDC: "" };
  const localCur  = merchant.default_currency || "NGN";
  const localRate = localCur === "USDC" ? null : (rates[localCur] ?? null);
  const localSym  = CURRENCY_SYM[localCur] ?? "";
  const fmtLocal  = (usdc: number) => `≈ ${localSym}${Math.round(usdc * (localRate ?? 0)).toLocaleString()}`;

  const statsCards = [
    {
      label: "USDC Balance",
      value: merchant.usdc_balance ? `${parseFloat(merchant.usdc_balance).toFixed(2)} USDC` : "—",
      sub: merchant.usdc_balance && localRate
        ? fmtLocal(parseFloat(merchant.usdc_balance))
        : "wallet on Arc",
    },
    {
      label: "Today's Volume",
      value: `${todayVol.toFixed(2)} USDC`,
      sub: localRate ? fmtLocal(todayVol) : "",
    },
    { label: "Total Payments", value: String(merchant.total_payments), sub: "all time" },
    {
      label: "Total Volume",
      value: `${parseFloat(merchant.total_volume_usdc).toFixed(2)} USDC`,
      sub: localRate ? fmtLocal(parseFloat(merchant.total_volume_usdc)) : "paid + released",
    },
  ];

  const checklist = [
    { done: hasWallet,  title: "Add your wallet address", desc: "Where your USDC settles",            cta: null as null | (() => void) },
    { done: hasWebhook, title: "Set your webhook URL",    desc: "Where ArcPay notifies your app",     cta: () => openSetting("webhook") },
    { done: hasPayment, title: "Make your first payment", desc: "Create a link and complete a pay",   cta: () => setShowModal(true) },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex">
      {/* ─── Sidebar — Arc navy theme ─── */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 arc-sidebar sticky top-0 h-screen text-blue-100">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-white/10">
          <span className="text-xl">⚡</span>
          <span className="font-bold tracking-tight text-white">ArcPay</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* Dashboard + Payments */}
          {([NAV[0], NAV[1]] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveView(id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeView === id
                  ? "bg-white/10 text-white"
                  : "text-blue-100/70 hover:bg-white/5 hover:text-white"}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}

          {/* Settings — collapsible dropdown */}
          <button
            onClick={() => { setSettingsOpen(o => !o); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === "settings"
                ? "bg-white/10 text-white"
                : "text-blue-100/70 hover:bg-white/5 hover:text-white"}`}>
            <SettingsIcon className="w-4 h-4" /> Settings
            {settingsOpen
              ? <ChevronUp className="w-3.5 h-3.5 ml-auto" />
              : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
          </button>
          {settingsOpen && (
            <div className="ml-3 pl-3 border-l border-white/10 space-y-0.5 py-1">
              {SETTINGS_TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => openSetting(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeView === "settings" && settingsTab === id
                      ? "bg-[#c7c2f7]/20 text-white"
                      : "text-blue-100/60 hover:bg-white/5 hover:text-white"}`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          )}

          <p className="px-3 pt-5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-blue-200/40">Payment tools</p>
          <button onClick={() => setShowModal(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-blue-100/70 hover:bg-white/5 hover:text-white transition-colors">
            <Link2 className="w-4 h-4" /> Payment links
          </button>
          {["Checkout pages", "Invoices", "Mass payouts"].map(t => (
            <div key={t} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-blue-100/30 cursor-default">
              <CreditCard className="w-4 h-4" /> {t}
              <span className="ml-auto text-[9px] bg-white/10 text-blue-100/50 px-1.5 py-0.5 rounded-full">soon</span>
            </div>
          ))}

          <p className="px-3 pt-5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-blue-200/40">Developers</p>
          <a href="/docs" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-blue-100/70 hover:bg-white/5 hover:text-white transition-colors"><FileText className="w-4 h-4" /> API Docs</a>
          <a href="/docs" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-blue-100/70 hover:bg-white/5 hover:text-white transition-colors"><Code2 className="w-4 h-4" /> SDK Docs</a>
        </nav>

        <div className="px-5 py-4 border-t border-white/10">
          <a href="mailto:support@arcpay.dev" className="flex items-center gap-2 text-xs text-blue-100/50 hover:text-white transition-colors">
            <LifeBuoy className="w-3.5 h-3.5" /> support@arcpay.dev
          </a>
        </div>
      </aside>

      {/* ─── Main column ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar (B1) — balance always visible */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 z-10">
          {/* mobile nav pills */}
          <div className="flex lg:hidden gap-1">
            {NAV.map(({ id, label }) => (
              <button key={id} onClick={() => setActiveView(id)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${activeView === id ? "bg-[#6c47ff] text-white" : "bg-gray-100 text-gray-500"}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="hidden lg:block text-sm font-semibold capitalize">{activeView === "home" ? "Dashboard" : activeView}</p>

          <div className="flex items-center gap-3">
            {/* Currency flag — click to go to currency settings */}
            <button
              onClick={() => openSetting("currency")}
              title={`Currency: ${merchant.default_currency}`}
              className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors">
              <span className="text-base leading-none">
                {{"NGN":"🇳🇬","GHS":"🇬🇭","KES":"🇰🇪","ZAR":"🇿🇦","USD":"🇺🇸","USDC":"💵"}[merchant.default_currency] ?? "💱"}
              </span>
              <span className="font-semibold">{merchant.default_currency}</span>
            </button>
            <button onClick={() => refresh()} className="text-gray-400 hover:text-gray-600 transition-colors" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-red-200 hover:bg-red-50 transition-colors">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* identity banner — Arc theme */}
            <div className="arc-panel rounded-2xl px-5 py-4 flex items-center justify-between gap-4 overflow-hidden">
              <div className="min-w-0">
                <p className="arc-kicker text-[10px] font-medium mb-1">{`{ ${activeView === "home" ? "MERCHANT" : activeView.toUpperCase()} }`}</p>
                <p className="font-bold text-white truncate text-lg">{merchant.name}</p>
                <p className="text-xs text-blue-100/60 font-mono truncate">{merchant.wallet_address || "No wallet set"}</p>
              </div>
              <div className="shrink-0 text-right">
                {!hasWallet ? (
                  <span className="text-[10px] bg-amber-400/20 text-amber-200 px-2 py-1 rounded-full font-semibold">Verify account</span>
                ) : (
                  <>
                    <p className="text-[10px] uppercase tracking-wide text-blue-100/50">USDC Balance</p>
                    <p className="text-xl font-bold text-white">{balanceStr}</p>
                  </>
                )}
              </div>
            </div>

            {/* ════════ HOME ════════ */}
            <div className={activeView === "home" ? "space-y-6" : "hidden"}>

              {/* Get started checklist (A3) */}
              {!coreDone ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Get started</h3>
                      <span className="text-xs text-gray-400">{checklist.filter(c => c.done).length}/3</span>
                    </div>
                  </CardHeader>
                  <CardBody className="space-y-2">
                    {checklist.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${s.done ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                          {s.done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${s.done ? "text-gray-400 line-through" : "text-gray-900"}`}>{s.title}</p>
                          <p className="text-xs text-gray-400">{s.desc}</p>
                        </div>
                        {!s.done && s.cta && <Button size="sm" variant="outline" onClick={s.cta}>Do it</Button>}
                      </div>
                    ))}
                  </CardBody>
                </Card>
              ) : !bannerDismissed ? (
                <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600 shrink-0" />
                  <p className="text-sm font-medium text-green-800">You're all set up and ready to go! 🎉</p>
                  <div className="ml-auto flex items-center gap-3">
                    {!hasMarkup && (
                      <button onClick={() => openSetting("currency")} className="text-xs text-green-700 font-semibold hover:underline">
                        Set FX markup →
                      </button>
                    )}
                    <button onClick={dismissBanner} className="text-green-600 hover:text-green-800" title="Dismiss">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Stats */}
              {loadingData ? <StatsSkeleton /> : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {statsCards.map(({ label, value, sub }) => (
                    <Card key={label} className="p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">{label}</p>
                      <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
                      {sub && (
                        <p className={`text-xs mt-0.5 truncate ${
                          sub.startsWith("≈") ? "text-gray-500 font-medium" : "text-gray-400"
                        }`}>{sub}</p>
                      )}
                    </Card>
                  ))}
                </div>
              )}

              {/* Chart + Your tools */}
              <div className="grid lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader><h3 className="font-semibold">Revenue — last 7 days (USDC)</h3></CardHeader>
                  <CardBody className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,.1)", fontSize: 12 }}
                          formatter={(v: unknown) => [`${v} USDC`, "Volume"]}
                        />
                        <Bar dataKey="usdc" fill="#6c47ff" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardBody>
                </Card>

                {/* Your tools (B3) */}
                <Card>
                  <CardHeader><h3 className="font-semibold text-sm">Your tools</h3></CardHeader>
                  <CardBody className="space-y-2">
                    {TOOLS.map(t => (
                      <button key={t.title} onClick={t.onClick} disabled={t.soon}
                        className="w-full flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-default transition-colors">
                        <t.icon className="w-4 h-4 text-[#6c47ff] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{t.title}</p>
                          <p className="text-xs text-gray-400">{t.desc}</p>
                        </div>
                        {t.soon && <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">soon</span>}
                      </button>
                    ))}
                  </CardBody>
                </Card>
              </div>

              {/* Live payments feed (B3) */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Recent payments</h3>
                      <span className="text-[10px] font-normal text-[#6c47ff]">● live</span>
                    </div>
                    <button onClick={() => setActiveView("payments")} className="text-xs text-[#6c47ff] font-semibold hover:underline">View all →</button>
                  </div>
                </CardHeader>
                <CardBody>
                  {payments.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                      <div className="text-3xl">💸</div>
                      <p className="text-sm text-gray-400">No payments yet — create your first link.</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {payments.slice(0, 5).map(p => (
                        <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                          <StatusBadge status={p.status} />
                          <span className="font-mono text-xs text-gray-400">{trunc(p.id, 10)}</span>
                          <span className="ml-auto text-sm font-medium">{fmtUsdc(p.amount)}</span>
                          {p.amount_ngn && <span className="text-xs text-gray-400 w-20 text-right">{fmtNgn(p.amount_ngn)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* ════════ PAYMENTS (B4) ════════ */}
            <div className={activeView === "payments" ? "space-y-4" : "hidden"}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Payments</h3>
                      <span className="text-[10px] font-normal text-[#6c47ff]">● live</span>
                      {lastRefresh && (
                        <span className="text-[10px] text-gray-300 hidden sm:inline">
                          updated {Math.round((Date.now() - lastRefresh.getTime()) / 1000)}s ago
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Search */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                          placeholder="Search ID / order…"
                          className="w-40 sm:w-52 rounded-lg border border-gray-200 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[#6c47ff]" />
                      </div>
                      <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting || paymentList.total === 0}>
                        {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Download className="w-3.5 h-3.5 mr-1.5" />CSV</>}
                      </Button>
                    </div>
                  </div>
                  {/* Filter tabs */}
                  <div className="flex gap-1 mt-3 flex-wrap">
                    {(["all", "paid", "pending", "expired", "refunded"] as const).map(s => (
                      <button key={s}
                        onClick={() => { setStatusFilter(s); setPage(1); refresh(s, 1); }}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors capitalize ${
                          statusFilter === s ? "bg-[#6c47ff] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                        {s}
                        {s === "all" && paymentList.total > 0 && <span className="ml-1 opacity-70">{paymentList.total}</span>}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                {loadingData ? (
                  <TableSkeleton rows={4} />
                ) : payments.length === 0 ? (
                  <CardBody>
                    <div className="text-center py-10 space-y-3">
                      <div className="text-4xl">💸</div>
                      <p className="font-semibold text-gray-900">
                        {search ? "No matches" : statusFilter === "all" ? "No payments yet" : `No ${statusFilter} payments`}
                      </p>
                      <p className="text-sm text-gray-400">
                        {search ? `Nothing matches "${search}".` : statusFilter === "all"
                          ? "Create your first payment link and send it to a customer."
                          : `Nothing to show for the "${statusFilter}" filter.`}
                      </p>
                      {statusFilter === "all" && !search && (
                        <Button size="sm" onClick={() => setShowModal(true)}>
                          <Plus className="w-3.5 h-3.5 mr-1.5" /> Create payment link
                        </Button>
                      )}
                    </div>
                  </CardBody>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            {["ID", "Amount", "Status", "Payer", "Created", ""].map(h => (
                              <th key={h} className="text-left px-6 py-3">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map(p => (
                            <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="px-6 py-3 font-mono text-xs text-gray-500">
                                {trunc(p.id, 10)}
                                <button onClick={() => copyUrl(p.id)} className="ml-1 text-gray-300 hover:text-[#6c47ff]" title="Copy ID">⎘</button>
                              </td>
                              <td className="px-6 py-3">
                                <span className="font-medium">{fmtUsdc(p.amount)}</span>
                                {p.amount_ngn && <span className="block text-xs text-gray-400">{fmtNgn(p.amount_ngn)}</span>}
                              </td>
                              <td className="px-6 py-3"><StatusBadge status={p.status} /></td>
                              <td className="px-6 py-3 font-mono text-xs text-gray-400">{p.payer ? trunc(p.payer) : "—"}</td>
                              <td className="px-6 py-3 text-xs text-gray-400">{new Date(p.created_at + " UTC").toLocaleString()}</td>
                              <td className="px-6 py-3 whitespace-nowrap">
                                {p.tx_hash ? (
                                  <a href={`${EXPLORER}/tx/${p.tx_hash}`} target="_blank" rel="noreferrer"
                                    className="text-[#6c47ff] hover:underline text-xs">ArcScan ↗</a>
                                ) : (
                                  <a href={`/checkout/${p.id}`} target="_blank" rel="noreferrer"
                                    className="text-[#6c47ff] hover:underline text-xs">Open ↗</a>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {(paymentList.has_more || page > 1) && (
                      <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-xs text-gray-500">
                        <span>{(page - 1) * paymentList.limit + 1}–{Math.min(page * paymentList.limit, paymentList.total)} of {paymentList.total}</span>
                        <div className="flex gap-2">
                          <button onClick={() => { const p = page - 1; setPage(p); refresh(statusFilter, p); }} disabled={page === 1}
                            className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50">← Prev</button>
                          <button onClick={() => { const p = page + 1; setPage(p); refresh(statusFilter, p); }} disabled={!paymentList.has_more}
                            className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50">Next →</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card>
            </div>

            {/* ════════ SETTINGS ════════ */}
            <div className={activeView === "settings" ? "space-y-5 max-w-xl" : "hidden"}>

              {/* ── Header — chosen from the sidebar dropdown ── */}
              <div>
                <h2 className="text-lg font-bold text-gray-900">{settingsLabel}</h2>
                <p className="text-xs text-gray-400 mt-0.5">Pick another option from <span className="font-medium text-gray-500">Settings</span> in the sidebar.</p>
              </div>

              {/* Mobile settings tabs (sidebar is hidden on small screens) */}
              <div className="lg:hidden flex gap-1.5 flex-wrap">
                {SETTINGS_TABS.map(({ id, label }) => (
                  <button key={id} onClick={() => setSettingsTab(id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      settingsTab === id ? "bg-[#6c47ff] text-white" : "bg-gray-100 text-gray-500"}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* ── Profile ── */}
              {settingsTab === "profile" && (
                <Card>
                  <CardHeader><div className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400" /><h3 className="font-semibold text-sm">Profile</h3></div></CardHeader>
                  <CardBody className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Business / Name</label>
                      <input value={profileName} onChange={e => setProfileName(e.target.value)}
                        placeholder="e.g. Footie Lagos"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#6c47ff]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
                      <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#6c47ff]" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-gray-500">Settlement wallet address</label>
                        <button type="button" onClick={connectProfileWallet}
                          className="flex items-center gap-1.5 text-xs font-semibold text-[#6c47ff] hover:underline">
                          <Wallet className="w-3.5 h-3.5" />
                          {walletConnected && connectedAddr ? "Use connected wallet" : "Connect wallet"}
                        </button>
                      </div>
                      <div className="relative">
                        <Wallet className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input value={profileWallet} onChange={e => setProfileWallet(e.target.value)}
                          placeholder="0xD4F3…7b87"
                          className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2.5 text-sm font-mono outline-none focus:border-[#6c47ff]" />
                      </div>
                      {profileWallet && !/^0x[0-9a-fA-F]{40}$/.test(profileWallet) && (
                        <p className="text-xs text-red-500 mt-1">Invalid wallet address</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">USDC settles here — connect MetaMask to fill it. ArcPay never holds your funds.</p>
                    </div>
                    {profileMsg && (
                      <p className={`text-xs ${profileMsg.includes("✓") ? "text-green-700" : "text-red-600"}`}>{profileMsg}</p>
                    )}
                    <Button className="w-full" onClick={saveProfile} disabled={profileSaving}>
                      {profileSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save changes"}
                    </Button>
                  </CardBody>
                </Card>
              )}

              {/* ── Password ── */}
              {settingsTab === "password" && (
                <Card>
                  <CardHeader><div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-gray-400" /><h3 className="font-semibold text-sm">Change password</h3></div></CardHeader>
                  <CardBody className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Current password</label>
                      <div className="relative">
                        <input type={showCurPass ? "text" : "password"} value={curPass}
                          onChange={e => setCurPass(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#6c47ff]" />
                        <button type="button" onClick={() => setShowCurPass(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showCurPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">New password</label>
                      <div className="relative">
                        <input type={showNewPass ? "text" : "password"} value={newPass}
                          onChange={e => setNewPass(e.target.value)}
                          placeholder="Min. 8 characters"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#6c47ff]" />
                        <button type="button" onClick={() => setShowNewPass(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {passMsg && (
                      <p className={`text-xs ${passMsg.includes("✓") ? "text-green-700" : "text-red-600"}`}>{passMsg}</p>
                    )}
                    <Button className="w-full" onClick={savePassword} disabled={passSaving}>
                      {passSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating…</> : "Change password"}
                    </Button>
                  </CardBody>
                </Card>
              )}

              {/* ── API Key ── */}
              {settingsTab === "apikey" && (
                <Card>
                  <CardHeader><div className="flex items-center gap-2"><Key className="w-4 h-4 text-gray-400" /><h3 className="font-semibold text-sm">API Key</h3></div></CardHeader>
                  <CardBody className="space-y-3">
                    {newKey ? (
                      <>
                        <p className="text-xs text-green-700 bg-green-50 rounded-lg p-2">New key issued — copy it now, it won't be shown again.</p>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2 text-xs font-mono break-all">
                          <span className="flex-1">{newKey}</span>
                          <button onClick={() => copyKey(newKey)} className="shrink-0">
                            {keyCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5 text-xs">
                          <Key className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                          <span className="flex-1 font-mono text-gray-400 tracking-widest">{"•".repeat(20)}</span>
                        </div>
                        <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
                          Your API key was shown once at registration. Rotate below to get a new one.
                        </div>
                        <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={handleRotate} disabled={rotating}>
                          {rotating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Rotate key to reveal a new one
                        </Button>
                      </>
                    )}
                  </CardBody>
                </Card>
              )}

              {/* ── Webhook ── */}
              {settingsTab === "webhook" && (
                <Card>
                  <CardHeader><div className="flex items-center gap-2"><Webhook className="w-4 h-4 text-gray-400" /><h3 className="font-semibold text-sm">Webhook</h3></div></CardHeader>
                  <CardBody className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Endpoint URL</label>
                      <input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                        placeholder="https://yoursite.com/arcpay/webhook"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#6c47ff]" />
                    </div>
                    {merchant.webhook_secret && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Signing Secret</label>
                        <div className="flex gap-2 items-center">
                          <div className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono bg-gray-50 truncate">
                            {showSecret ? merchant.webhook_secret : "•".repeat(24)}
                          </div>
                          <button onClick={() => setShowSecret(v => !v)} className="shrink-0 rounded-xl border border-gray-200 p-2 hover:bg-gray-50" title={showSecret ? "Hide" : "Reveal"}>
                            {showSecret ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-400" />}
                          </button>
                          <button onClick={() => copySecret(merchant.webhook_secret!)} className="shrink-0 rounded-xl border border-gray-200 p-2 hover:bg-gray-50" title="Copy">
                            {secretCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Verify the <code className="bg-gray-100 px-1 rounded">X-ArcPay-Signature</code> header with this.</p>
                      </div>
                    )}
                    {webhookMsg && (
                      <p className={`text-xs ${webhookMsg.includes("fail") || webhookMsg.includes("error") ? "text-red-600" : "text-green-700"}`}>{webhookMsg}</p>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={saveWebhook} disabled={webhookSaving}>
                        {webhookSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save URL"}
                      </Button>
                      <Button className="flex-1" onClick={sendTestWebhook} disabled={testingHook || !webhookUrl}>
                        {testingHook ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Send test
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* ── Currency & Markup ── */}
              {settingsTab === "currency" && (
                <Card>
                  <CardHeader><div className="flex items-center gap-2"><span className="text-gray-400 text-sm font-bold">%</span><h3 className="font-semibold text-sm">Currency &amp; FX markup</h3></div></CardHeader>
                  <CardBody className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2">Default currency</label>
                      <select value={merchant.default_currency}
                        onChange={e => saveCurrency(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#6c47ff] bg-white cursor-pointer">
                        {["NGN","GHS","KES","ZAR","USDC"].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-gray-500">FX Markup</label>
                        <span className="text-sm font-bold text-[#6c47ff]">{(markupBps / 100).toFixed(1)}%</span>
                      </div>
                      <input type="range" min={0} max={500} step={25} value={markupBps}
                        onChange={e => { setMarkupBps(Number(e.target.value)); setMarkupMsg(null); }}
                        className="w-full accent-[#6c47ff]" />
                      <div className="flex justify-between text-[10px] text-gray-300 mt-1"><span>0%</span><span>5% max</span></div>
                    </div>
                    {localRate && markupBps > 0 && (() => {
                      const sample = ({ NGN: 4500, GHS: 50, KES: 500, ZAR: 80, USD: 5 } as Record<string, number>)[localCur] ?? 4500;
                      return (
                        <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-xs space-y-1.5">
                          <p className="font-semibold text-gray-600">Live preview — {localSym}{sample.toLocaleString()} item</p>
                          <p className="text-gray-500">No markup: <span className="font-mono">{(sample / localRate).toFixed(2)} USDC</span></p>
                          <p className="text-[#6c47ff] font-medium">With {(markupBps/100).toFixed(1)}%: <span className="font-mono">{(sample * (1 + markupBps/10000) / localRate).toFixed(2)} USDC</span></p>
                          <p className="text-gray-400">Buffer goes to your wallet on off-ramp.</p>
                        </div>
                      );
                    })()}
                    {markupMsg && <p className={`text-xs ${markupMsg.includes("fail") ? "text-red-600" : "text-green-700"}`}>{markupMsg}</p>}
                    <Button className="w-full" onClick={saveMarkup} disabled={markupSaving}>
                      {markupSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save markup"}
                    </Button>
                  </CardBody>
                </Card>
              )}

              {/* ── Integration snippet ── */}
              {settingsTab === "snippet" && (
                <Card>
                  <CardHeader><h3 className="font-semibold text-sm">Integration snippet</h3></CardHeader>
                  <CardBody>
                    <pre className="bg-[#1e1e2e] text-[#cdd6f4] rounded-xl p-4 text-xs font-mono leading-relaxed overflow-x-auto">
{`const { payment_url } = await fetch('${window.location.origin.replace("3000","3001")}/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': 'YOUR_API_KEY'   // keep this server-side only
  },
  body: JSON.stringify({ amount: 1000000 })  // 1 USDC = 1 000 000
}).then(r => r.json());

window.location = payment_url;`}
                    </pre>
                  </CardBody>
                </Card>
              )}

            </div>

          </div>
        </main>
      </div>

      {/* Sticky integrate CTA (B2) */}
      <a href="/docs" className="fixed bottom-5 right-5 z-20 flex items-center gap-2 bg-[#6c47ff] text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg hover:opacity-90 transition-opacity">
        <Code2 className="w-4 h-4" /> Integrate with API →
      </a>

      {showModal && <CreateModal token={token} onClose={() => { setShowModal(false); refresh(); }} />}
    </div>
  );
}

// ─── Page root ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [token,    setToken]    = useState<string | null>(() => localStorage.getItem("arcpay_token"));
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);

  // Auto-restore session from localStorage
  useEffect(() => {
    const t = localStorage.getItem("arcpay_token");
    if (!t) return;
    getMe(t).then(m => { setToken(t); setMerchant(m); }).catch(() => {
      localStorage.removeItem("arcpay_token");
    });
  }, []);

  function handleLogin(t: string, m: MerchantProfile) { setToken(t); setMerchant(m); }
  function handleLogout() {
    localStorage.removeItem("arcpay_token");
    setToken(null); setMerchant(null);
  }

  if (token && merchant) {
    return <DashboardView token={token} merchant={merchant} onLogout={handleLogout} />;
  }
  return <AuthView onLogin={handleLogin} />;
}
