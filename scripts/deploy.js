const { ethers } = require("hardhat");

async function main() {
  const usdcAddress = process.env.ARC_USDC;
  const feeRecipient = process.env.FEE_RECIPIENT;
  const feeBps = process.env.FEE_BPS || "50";

  if (!usdcAddress || !feeRecipient) {
    throw new Error("ARC_USDC and FEE_RECIPIENT must be set in .env");
  }

  console.log("Deploying ArcPay...");
  const ArcPay = await ethers.getContractFactory("ArcPay");
  const arcPay = await ArcPay.deploy(usdcAddress, feeRecipient, feeBps);
  await arcPay.waitForDeployment();

  console.log(`ArcPay deployed to: ${await arcPay.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
