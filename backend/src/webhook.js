const crypto = require("crypto");

const TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 3;

async function deliver(url, secret, payload) {
  const body = JSON.stringify(payload);
  const sig  = crypto.createHmac("sha256", secret).update(body).digest("hex");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ArcPay-Signature": `sha256=${sig}`,
          "X-ArcPay-Event": payload.event,
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (res.ok) {
        console.log(`[webhook] ${payload.event} → ${url} (attempt ${attempt})`);
        return;
      }
      console.warn(`[webhook] attempt ${attempt} HTTP ${res.status}`);
    } catch (err) {
      console.warn(`[webhook] attempt ${attempt} error: ${err.message}`);
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000)); // 2s, 4s
    }
  }

  console.error(`[webhook] gave up on ${url} after ${MAX_ATTEMPTS} attempts`);
}

module.exports = { deliver };
