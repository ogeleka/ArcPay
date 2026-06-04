const { ethers } = require("hardhat");

// Minimal ERC-20 ABI — only what we need for the smoke test
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

async function main() {
  const arcPayAddress = process.env.ARCPAY_ADDRESS;
  const usdcAddress = process.env.ARC_USDC;
  if (!arcPayAddress || !usdcAddress) {
    throw new Error("ARCPAY_ADDRESS and ARC_USDC must be set in .env");
  }

  const [signer] = await ethers.getSigners();
  console.log("Signer :", signer.address);

  const arcPay = await ethers.getContractAt("ArcPay", arcPayAddress);
  const usdc = new ethers.Contract(usdcAddress, ERC20_ABI, signer);

  // Use the signer as both payer and merchant so one wallet covers the full flow
  const AMOUNT = ethers.parseUnits("1", 6); // 1 USDC
  const paymentId = ethers.keccak256(
    ethers.toUtf8Bytes("smoke-" + Date.now())
  );

  const balBefore = await usdc.balanceOf(signer.address);
  console.log("USDC before :", ethers.formatUnits(balBefore, 6));
  console.log("Payment ID  :", paymentId);

  // 1. Create
  console.log("\n[1/4] createPayment...");
  let tx = await arcPay.createPayment(paymentId, signer.address, AMOUNT);
  await tx.wait();
  console.log("      tx:", tx.hash);

  // 2. Approve
  console.log("[2/4] approve USDC...");
  tx = await usdc.approve(arcPayAddress, AMOUNT);
  await tx.wait();
  console.log("      tx:", tx.hash);

  // 3. Pay
  console.log("[3/4] pay...");
  tx = await arcPay.pay(paymentId);
  await tx.wait();
  console.log("      tx:", tx.hash);
  const balMid = await usdc.balanceOf(signer.address);
  console.log("      USDC in escrow — signer balance now:", ethers.formatUnits(balMid, 6));

  // 4. Release (merchant == signer in this smoke test)
  console.log("[4/4] release...");
  tx = await arcPay.release(paymentId);
  await tx.wait();
  console.log("      tx:", tx.hash);

  const balAfter = await usdc.balanceOf(signer.address);
  const feeRecipient = await arcPay.feeRecipient();
  const feeBps = await arcPay.feeBps();
  const feeRecipientBal = await usdc.balanceOf(feeRecipient);

  console.log("\n=== Results ===");
  console.log("Fee            :", ethers.formatUnits(feeBps), "bps →", ethers.formatUnits((AMOUNT * feeBps) / 10000n, 6), "USDC");
  console.log("Signer USDC    :", ethers.formatUnits(balAfter, 6), `(was ${ethers.formatUnits(balBefore, 6)})`);
  console.log("Fee recipient  :", ethers.formatUnits(feeRecipientBal, 6), "USDC");
  console.log("\nSmoke test passed ✓");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
