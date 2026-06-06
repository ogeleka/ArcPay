/**
 * ArcPay SDK — minimal TypeScript client.
 * Server-side: keep your API key out of the browser.
 * Client-side: safe to use for demos; move the key server-side in production.
 */

export interface CreatePaymentOptions {
  amount: number;         // USDC micro-units OR whole NGN (depends on currency)
  currency?: "USDC" | "NGN";
  orderId?: string;
  customerEmail?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  payment_id:  string;
  payment_url: string;    // backend HTML checkout (legacy)
  amount_usdc: string;
  amount_ngn:  number | null;
  rate:        number | null;
  currency:    string;
  status:      string;
  expires_at:  string;
}

export class ArcPay {
  private apiKey:  string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = "http://localhost:3001") {
    this.apiKey  = apiKey;
    this.baseUrl = baseUrl;
  }

  /** Create a payment and return the result. */
  async createPayment(options: CreatePaymentOptions): Promise<PaymentResult> {
    const res = await fetch(`${this.baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": this.apiKey,
      },
      body: JSON.stringify({
        amount:         options.amount,
        currency:       options.currency ?? "USDC",
        order_id:       options.orderId,
        customer_email: options.customerEmail,
        callback_url:   options.callbackUrl,
        metadata:       options.metadata,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "ArcPay: payment creation failed");
    return data as PaymentResult;
  }

  /**
   * Create a payment and immediately redirect the browser to the hosted
   * React checkout page. The "2-line integration".
   */
  async checkout(options: CreatePaymentOptions): Promise<void> {
    const payment = await this.createPayment(options);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    window.location.href = `${origin}/checkout/${payment.payment_id}`;
  }
}

/**
 * Verify an incoming ArcPay webhook signature.
 * Node.js (server-side): pass rawBody as string or Uint8Array.
 * Returns a promise — use `await verifyWebhook(...)`.
 */
export async function verifyWebhook(
  rawBody: string | Uint8Array,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const enc      = new TextEncoder();
  const keyBytes  = enc.encode(secret);
  const bodyBytes = typeof rawBody === "string" ? enc.encode(rawBody) : rawBody;

  const key = await crypto.subtle.importKey(
    "raw", keyBytes as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, bodyBytes as unknown as ArrayBuffer);
  const hexSig  = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  const expected = "sha256=" + hexSig;

  // Constant-time comparison
  if (expected.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}

export default ArcPay;
