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

/** Verify an incoming ArcPay webhook signature (Node.js / server-side only). */
export function verifyWebhook(
  rawBody: string | Buffer,
  signatureHeader: string,
  secret: string,
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("crypto") as typeof import("crypto");
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}

export default ArcPay;
