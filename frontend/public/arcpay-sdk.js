/**
 * ArcPay Browser SDK v1
 * Include via: <script src="/arcpay-sdk.js"></script>
 * Then: const arcpay = new ArcPay({ apiKey: '...', baseUrl: '...' });
 */
(function (global) {
  "use strict";

  class ArcPay {
    constructor({ apiKey, baseUrl = "http://localhost:3001" }) {
      if (!apiKey) throw new Error("ArcPay: apiKey is required");
      this.apiKey  = apiKey;
      this.baseUrl = baseUrl;
    }

    /** Create a payment. Returns { payment_id, payment_url, amount_usdc, ... } */
    async createPayment({ amount, currency = "USDC", orderId, customerEmail, callbackUrl, metadata }) {
      const res = await fetch(`${this.baseUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": this.apiKey,
        },
        body: JSON.stringify({
          amount,
          currency,
          order_id:       orderId,
          customer_email: customerEmail,
          callback_url:   callbackUrl,
          metadata,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ArcPay: request failed");
      return data;
    }

    /**
     * Create a payment then redirect to the hosted checkout.
     * This is the 2-line integration.
     */
    async checkout(options) {
      const payment = await this.createPayment(options);
      window.location.href = `${window.location.origin}/checkout/${payment.payment_id}`;
    }
  }

  global.ArcPay = ArcPay;
})(typeof window !== "undefined" ? window : this);
