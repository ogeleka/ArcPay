/**
 * End-to-end integration test:
 *   1. Sign up a merchant via the backend API
 *   2. Create a payment via the backend API
 *   3. Call createPayment + approve + pay on-chain (same wallet plays payer & merchant)
 *   4. Poll the API until the listener marks the payment "paid"
 *
 * Pre-req: `cd backend && node index.js` is running in another terminal.
 * Run:     npx hardhat run scripts/e2e.js --network arcTestnet
 */
require("dotenv").config();
const { ethers } = require("hardhat");

const BACKEND = "http://localhost:3001";
const USDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
];

async function api(method, path, body, apiKey) {
  const res = await fetch(`${BACKEND}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-Api-Key": apiKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`API ${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function poll(path, apiKey, until, intervalMs = 2000, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const data = await api("GET", path, null, apiKey);
    if (until(data)) return data;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${path}`);
}

async function main() {
  const [signer] = await ethers.getSigners();
  const arcPayAddress = process.env.ARCPAY_ADDRESS;
  const usdcAddress = process.env.ARC_USDC;
  if (!arcPayAddress || !usdcAddress) throw new Error("ARCPAY_ADDRESS and ARC_USDC required in .env");

  console.log("Signer:", signer.address);

  // 1. Merchant signup
  const tag = Date.now();
  const { merchant_id, api_key } = await api("POST", "/merchants", {
    name: "E2E Merchant",
    email: `e2e-${tag}@test.com`,
    wallet_address: signer.address,
  });
  console.log("[1/5] Merchant created:", merchant_id);

  // 2. Create payment (5 USDC)
  const AMOUNT = 5_000_000n;
  const { payment_id } = await api("POST", "/payments", { amount: String(AMOUNT) }, api_key);
  console.log("[2/5] Payment created:", payment_id);
  console.log("      payment_url: http://localhost:3000/pay/" + payment_id);

  // 3. Register payment on-chain (merchant = signer for this test)
  const arcPay = await ethers.getContractAt("ArcPay", arcPayAddress);
  let tx = await arcPay.createPayment(payment_id, signer.address, AMOUNT);
  await tx.wait();
  console.log("[3/5] createPayment tx:", tx.hash);

  // 4. Approve + pay
  const usdc = new ethers.Contract(usdcAddress, USDC_ABI, signer);
  tx = await usdc.approve(arcPayAddress, AMOUNT);
  await tx.wait();
  console.log("[4/5] approve tx:", tx.hash);

  tx = await arcPay.pay(payment_id);
  await tx.wait();
  console.log("      pay tx:", tx.hash);

  // 5. Poll backend until listener updates status
  console.log("[5/5] Polling backend for status = paid ...");
  const result = await poll(`/payments/${payment_id}`, api_key, (d) => d.status === "paid");
  console.log("\n=== Integration test passed ===");
  console.log("Status :", result.status);
  console.log("Payer  :", result.payer);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
