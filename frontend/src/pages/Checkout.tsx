import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "react-qr-code";
import {
  useAccount, useChainId, useSwitchChain,
  useReadContract, useWriteContract, useWaitForTransactionReceipt,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CheckCircle, Clock, QrCode, Loader2, AlertCircle, CreditCard, Info } from "lucide-react";

import { getPayment, type PaymentDetails } from "@/lib/api";
import { arcTestnet, USDC_ADDRESS } from "@/lib/chain";
import { ARCPAY_ABI, USDC_ABI } from "@/lib/contracts";
import { fmtUsdc, fmtNgn, secondsUntil } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = "idle" | "wrong-network" | "checking" | "creating" | "approving" | "paying" | "settled" | "failed";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepRow({ label, state }: { label: string; state: "done" | "active" | "idle" }) {
  return (
    <div className={`flex items-center gap-2.5 text-sm ${
      state === "done"   ? "text-green-700" :
      state === "active" ? "text-[#6c47ff] font-semibold" :
                           "text-gray-400"
    }`}>
      {state === "done"   ? <CheckCircle className="w-4 h-4 shrink-0" /> :
       state === "active" ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> :
                            <div className="w-4 h-4 shrink-0 rounded-full border-2 border-gray-200" />}
      {label}
    </div>
  );
}

function SettledCard({
  hash, ms, explorerUrl, returnUrl, returnLabel, productName, orderId,
}: {
  hash: string; ms: number; explorerUrl: string;
  returnUrl?: string | null; returnLabel?: string; productName?: string | null; orderId?: string | null;
}) {
  function goBack() {
    if (!returnUrl) return;
    // Pass paid=1 + product back so the store can show the success banner
    const params = new URLSearchParams({ paid: "1" });
    if (productName) params.set("product", productName);
    if (orderId)     params.set("orderId", orderId);
    window.location.href = `${returnUrl}?${params}`;
  }

  return (
    <div className="text-center py-6 space-y-4 animate-[fadeIn_0.4s_ease]">
      <div className="text-6xl">✅</div>
      <div>
        <p className="text-xl font-bold text-gray-900">Payment complete</p>
        <p className="text-green-700 text-sm font-semibold mt-1">
          Settled in {ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`} ⚡
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Arc's sub-second finality</p>
      </div>
      <a
        href={`${explorerUrl}/tx/${hash}`}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-xs text-[#6c47ff] underline break-all"
      >
        {hash.slice(0, 18)}…{hash.slice(-8)}
      </a>
      {returnUrl && (
        <button
          onClick={goBack}
          className="block w-full mt-2 rounded-xl bg-gray-900 text-white text-sm font-semibold py-2.5 hover:bg-gray-800 transition-colors"
        >
          {returnLabel}
        </button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Checkout() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const qp           = new URLSearchParams(window.location.search);
  const returnUrl    = qp.get("returnUrl");
  const returnLabel  = qp.get("returnLabel") ?? "← Go back";
  const productName  = qp.get("product");
  const orderId      = qp.get("orderId");
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [loadErr, setLoadErr]   = useState<string | null>(null);
  const [step,    setStep]      = useState<Step>("idle");
  const [errMsg,  setErrMsg]    = useState<string | null>(null);
  const [txHash,  setTxHash]    = useState<`0x${string}` | undefined>();
  const [settled, setSettled]   = useState<{ hash: string; ms: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showQr, setShowQr]     = useState(false);
  const payStartRef             = useRef<number>(0);

  const { address, isConnected } = useAccount();
  const chainId                  = useChainId();
  const { switchChain }          = useSwitchChain();
  const { writeContractAsync }   = useWriteContract();

  const onRightNetwork = chainId === arcTestnet.id;

  // ── Load payment ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!paymentId) return;
    getPayment(paymentId).then(setPayment).catch((e: Error) => setLoadErr(e.message));
  }, [paymentId]);

  // ── Expiry countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!payment?.expires_at) return;
    const tick = () => setTimeLeft(secondsUntil(payment.expires_at));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [payment?.expires_at]);

  // ── On-chain payment state ──────────────────────────────────────────────────
  const { refetch: refetchOnChain } = useReadContract({
    address: payment?.arcpay_address as `0x${string}`,
    abi: ARCPAY_ABI,
    functionName: "payments",
    args: [paymentId as `0x${string}`],
    query: { enabled: !!payment && isConnected && onRightNetwork },
  });

  // ── USDC allowance ─────────────────────────────────────────────────────────
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [address!, payment?.arcpay_address as `0x${string}`],
    query: { enabled: !!address && !!payment && isConnected && onRightNetwork },
  });

  // ── Wait for submitted tx ───────────────────────────────────────────────────
  const { isSuccess: txConfirmed, isError: txFailed } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (!txConfirmed || !txHash) return;
    if (step === "approving") {
      setTxHash(undefined);
      runPay();
    } else if (step === "paying") {
      setSettled({ hash: txHash, ms: Date.now() - payStartRef.current });
      setStep("settled");
      setTxHash(undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txConfirmed, txHash, step]);

  useEffect(() => {
    if (txFailed) {
      setErrMsg("Transaction rejected or failed.");
      setStep("failed");
      setTxHash(undefined);
    }
  }, [txFailed]);

  // ── Main flow ───────────────────────────────────────────────────────────────
  const runApprove = useCallback(async () => {
    if (!payment) return;
    await refetchAllowance();
    const currentAllowance = allowance ?? 0n;
    if (BigInt(currentAllowance) >= BigInt(payment.amount)) {
      runPay(); return;
    }
    setStep("approving"); setErrMsg(null);
    try {
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [payment.arcpay_address as `0x${string}`, BigInt(payment.amount)],
      });
      setTxHash(hash);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      setErrMsg(msg.includes("user rejected") ? "You rejected the transaction." : msg);
      setStep("failed");
    }
  }, [payment, allowance, writeContractAsync, refetchAllowance]);

  const runPay = useCallback(async () => {
    if (!payment) return;
    setStep("paying"); setErrMsg(null);
    payStartRef.current = Date.now();
    try {
      const hash = await writeContractAsync({
        address: payment.arcpay_address as `0x${string}`,
        abi: ARCPAY_ABI,
        functionName: "pay",
        args: [payment.payment_id as `0x${string}`],
      });
      setTxHash(hash);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      setErrMsg(msg.includes("user rejected") ? "You rejected the transaction." : msg);
      setStep("failed");
    }
  }, [payment, writeContractAsync]);

  const handlePay = useCallback(async () => {
    if (!payment) return;
    setErrMsg(null);
    setStep("checking");

    // Poll until the backend's on-chain registration is confirmed (up to 15s)
    let isRegistered = false;
    for (let i = 0; i < 15; i++) {
      const { data: fresh } = await refetchOnChain();
      const merchant = (fresh as readonly [`0x${string}`, `0x${string}`, ...unknown[]] | undefined)?.[1] as string | undefined;
      if (merchant && merchant !== "0x0000000000000000000000000000000000000000") {
        isRegistered = true;
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!isRegistered) {
      setErrMsg("Payment registration is taking longer than expected. Please try again in a moment.");
      setStep("idle");
      return;
    }

    await runApprove();
  }, [payment, refetchOnChain, runApprove]);

  // ── Derived UI state ────────────────────────────────────────────────────────
  const isExpired = payment?.status === "expired" || timeLeft === 0 && !!payment?.expires_at;
  const isAlreadyPaid = payment?.status === "paid" || payment?.status === "released";
  const explorerUrl = arcTestnet.blockExplorers.default.url;

  const stepState = (s: Step): "done" | "active" | "idle" => {
    const order: Step[] = ["creating", "approving", "paying", "settled"];
    const cur = order.indexOf(step);
    const tgt = order.indexOf(s);
    if (cur === -1 || tgt === -1) return "idle";
    if (tgt < cur || step === "settled") return "done";
    if (tgt === cur) return "active";
    return "idle";
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loadErr) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center p-8 space-y-3">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="font-semibold text-gray-900">Payment not found</p>
          <p className="text-sm text-gray-400">{loadErr}</p>
        </Card>
      </div>
    );
  }
  if (!payment) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#6c47ff] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-6 items-start justify-center">

        {/* ── Main card ── */}
        <Card className="w-full max-w-sm mx-auto lg:mx-0 shadow-lg">
          <CardBody className="space-y-5">

            {/* Header */}
            <div className="text-center">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-widest mb-1">
                {payment.merchant_name}
              </p>
              <p className="text-5xl font-bold text-gray-900">{fmtUsdc(payment.amount)}</p>
              {payment.amount_ngn && (
                <p className="text-gray-400 text-sm mt-1">{fmtNgn(payment.amount_ngn)}</p>
              )}
            </div>

            {/* C3 — Fee breakdown (only shown when merchant applied markup) */}
            {payment.markup_bps > 0 && payment.amount_ngn && payment.mid_rate && (
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-xs space-y-1.5">
                <p className="font-semibold text-gray-600 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-gray-400" /> Price breakdown
                </p>
                <div className="flex justify-between text-gray-500">
                  <span>Local price</span>
                  <span className="font-mono">{fmtNgn(payment.amount_ngn)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Mid-market rate</span>
                  <span className="font-mono">1 USDC = ₦{payment.mid_rate.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Merchant FX buffer</span>
                  <span className="font-mono">+{(payment.markup_bps / 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-1.5 mt-0.5">
                  <span>You pay</span>
                  <span className="font-mono">{fmtUsdc(payment.amount)}</span>
                </div>
              </div>
            )}

            {/* Expiry */}
            {!isAlreadyPaid && !settled && payment.expires_at && (
              <div className={`flex items-center justify-center gap-1.5 text-sm ${
                timeLeft < 120 ? "text-red-500" : "text-gray-400"
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{isExpired ? "Expired" : `Expires in ${fmt(timeLeft)}`}</span>
              </div>
            )}

            {/* Settled */}
            {settled && (
              <SettledCard
                hash={settled.hash} ms={settled.ms} explorerUrl={explorerUrl}
                returnUrl={returnUrl} returnLabel={returnLabel}
                productName={productName} orderId={orderId ?? payment?.order_id}
              />
            )}

            {/* Already paid from backend */}
            {!settled && isAlreadyPaid && (
              <div className="text-center py-4 space-y-2">
                <div className="text-4xl">✅</div>
                <p className="font-semibold text-green-800">Payment already received</p>
              </div>
            )}

            {/* Expired */}
            {!settled && isExpired && !isAlreadyPaid && (
              <div className="rounded-xl bg-red-50 p-4 text-center text-sm text-red-700">
                This payment link has expired. Ask the merchant to create a new one.
              </div>
            )}

            {/* Steps */}
            {!settled && !isAlreadyPaid && !isExpired && (
              <>
                {["checking", "creating", "approving", "paying"].includes(step) && (
                  <div className="rounded-xl bg-gray-50 p-3 space-y-2">
                    <StepRow
                      label={step === "checking" ? "Confirming registration on-chain…" : "Payment registered on-chain ✓"}
                      state={step === "checking" ? "active" : "done"}
                    />
                    <StepRow label="Approve USDC"  state={stepState("approving")} />
                    <StepRow label="Send payment"  state={stepState("paying")} />
                  </div>
                )}

                {/* Error */}
                {errMsg && (
                  <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {errMsg}
                  </div>
                )}

                {/* Actions */}
                {!isConnected ? (
                  <div className="flex justify-center">
                    <ConnectButton label="Connect Wallet to Pay" />
                  </div>
                ) : !onRightNetwork ? (
                  <Button className="w-full" onClick={() => switchChain({ chainId: arcTestnet.id })}>
                    Switch to Arc Testnet
                  </Button>
                ) : step === "failed" ? (
                  <Button className="w-full" onClick={handlePay}>Retry</Button>
                ) : ["checking", "creating", "approving", "paying"].includes(step) ? (
                  <Button className="w-full" disabled>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {step === "checking"  ? "Verifying on-chain registration…" :
                     step === "creating"  ? "Registering on-chain…"            :
                     step === "approving" ? "Approving USDC…"                  :
                                           "Sending payment…"}
                  </Button>
                ) : (
                  <Button className="w-full" size="lg" onClick={handlePay}>
                    Pay {fmtUsdc(payment.amount)}
                  </Button>
                )}
              </>
            )}

            {/* D — Card coming soon + How to get USDC */}
            {!settled && !isAlreadyPaid && !isExpired && (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-dashed border-gray-200 px-3 py-2.5 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    Pay with card → USDC
                  </span>
                  <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full text-[10px] font-semibold">Coming soon</span>
                </div>
                <p className="text-center text-[10px] text-gray-400">
                  Don't have USDC?{" "}
                  <a
                    href="https://www.coinbase.com/how-to-buy/usdc"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-[#6c47ff]"
                  >
                    How to get USDC →
                  </a>
                </p>
              </div>
            )}

            {/* Trust line */}
            <p className="text-center text-[10px] text-gray-300">
              Non-custodial · Powered by ArcPay · Built on Arc
            </p>

            {/* QR toggle (mobile) */}
            <button
              onClick={() => setShowQr(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 lg:hidden"
            >
              <QrCode className="w-3.5 h-3.5" />
              {showQr ? "Hide" : "Pay from another device"}
            </button>
            {showQr && (
              <div className="flex justify-center lg:hidden">
                <QRCode value={window.location.href} size={140} />
              </div>
            )}
          </CardBody>
        </Card>

        {/* ── QR panel (desktop) ── */}
        <div className="hidden lg:flex flex-col items-center gap-3 pt-4">
          <div className="rounded-2xl bg-white shadow-sm p-5">
            <QRCode value={window.location.href} size={160} />
          </div>
          <p className="text-xs text-gray-400 text-center max-w-[12rem]">
            Scan to pay from a mobile wallet
          </p>
          <div className="text-[10px] text-gray-300 text-center space-y-0.5">
            <p>Rate locked at creation</p>
            {payment.mid_rate && <p>1 USDC = ₦{payment.mid_rate.toLocaleString()}</p>}
            {payment.markup_bps > 0 && (
              <p className="text-gray-400">+{(payment.markup_bps / 100).toFixed(1)}% FX buffer included</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
