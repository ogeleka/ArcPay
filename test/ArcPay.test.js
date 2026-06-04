const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ArcPay", function () {
  let arcPay, usdc;
  let merchant, payer, feeRecipient, other;
  const FEE_BPS = 50n; // 0.5%
  const PAYMENT_AMOUNT = 1_000_000n; // 1 USDC (6 decimals)
  const PAYMENT_ID = ethers.keccak256(ethers.toUtf8Bytes("order-001"));

  beforeEach(async function () {
    [, merchant, payer, feeRecipient, other] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    const ArcPay = await ethers.getContractFactory("ArcPay");
    arcPay = await ArcPay.deploy(await usdc.getAddress(), feeRecipient.address, FEE_BPS);

    await usdc.mint(payer.address, 10_000_000n); // 10 USDC
  });

  it("deploys with correct config", async function () {
    expect(await arcPay.usdc()).to.equal(await usdc.getAddress());
    expect(await arcPay.feeRecipient()).to.equal(feeRecipient.address);
    expect(await arcPay.feeBps()).to.equal(FEE_BPS);
  });

  it("createPayment emits PaymentCreated", async function () {
    await expect(arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT))
      .to.emit(arcPay, "PaymentCreated")
      .withArgs(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT);
  });

  it("createPayment reverts on duplicate ID", async function () {
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT);
    await expect(arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT))
      .to.be.revertedWith("Payment exists");
  });

  it("pay settles atomically — net to merchant, fee to feeRecipient", async function () {
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT);
    await usdc.connect(payer).approve(await arcPay.getAddress(), PAYMENT_AMOUNT);

    const fee       = (PAYMENT_AMOUNT * FEE_BPS) / 10000n;
    const netAmount = PAYMENT_AMOUNT - fee;

    await expect(arcPay.connect(payer).pay(PAYMENT_ID))
      .to.changeTokenBalances(
        usdc,
        [payer, merchant, feeRecipient],
        [-PAYMENT_AMOUNT, netAmount, fee]
      );
  });

  it("pay emits PaymentPaid with net amount and fee", async function () {
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT);
    await usdc.connect(payer).approve(await arcPay.getAddress(), PAYMENT_AMOUNT);

    const fee       = (PAYMENT_AMOUNT * FEE_BPS) / 10000n;
    const netAmount = PAYMENT_AMOUNT - fee;

    await expect(arcPay.connect(payer).pay(PAYMENT_ID))
      .to.emit(arcPay, "PaymentPaid")
      .withArgs(PAYMENT_ID, payer.address, netAmount, fee);
  });

  it("pay reverts on unknown payment", async function () {
    const unknownId = ethers.keccak256(ethers.toUtf8Bytes("unknown"));
    await expect(arcPay.connect(payer).pay(unknownId))
      .to.be.revertedWith("Payment not found");
  });

  it("pay reverts on double payment", async function () {
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT);
    await usdc.connect(payer).approve(await arcPay.getAddress(), PAYMENT_AMOUNT * 2n);
    await arcPay.connect(payer).pay(PAYMENT_ID);
    await expect(arcPay.connect(payer).pay(PAYMENT_ID))
      .to.be.revertedWith("Payment not pending");
  });

  it("markRefunded sets status and emits event", async function () {
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT);
    await usdc.connect(payer).approve(await arcPay.getAddress(), PAYMENT_AMOUNT);
    await arcPay.connect(payer).pay(PAYMENT_ID);

    await expect(arcPay.connect(merchant).markRefunded(PAYMENT_ID))
      .to.emit(arcPay, "PaymentRefunded")
      .withArgs(PAYMENT_ID, payer.address, PAYMENT_AMOUNT);
  });

  it("markRefunded reverts if caller is not merchant", async function () {
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT);
    await usdc.connect(payer).approve(await arcPay.getAddress(), PAYMENT_AMOUNT);
    await arcPay.connect(payer).pay(PAYMENT_ID);

    await expect(arcPay.connect(other).markRefunded(PAYMENT_ID))
      .to.be.revertedWith("Not merchant");
  });
});
