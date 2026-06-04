const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time }   = require("@nomicfoundation/hardhat-network-helpers");

describe("ArcPay", function () {
  let arcPay, usdc;
  let owner, merchant, payer, feeRecipient, other;

  const FEE_BPS        = 50n;        // 0.5%
  const PAYMENT_AMOUNT = 1_000_000n; // 1 USDC (6 dp)
  const PAYMENT_ID     = ethers.keccak256(ethers.toUtf8Bytes("order-001"));
  const NO_DEADLINE    = 0n;

  function deadline(secondsFromNow) {
    return BigInt(Math.floor(Date.now() / 1000) + secondsFromNow);
  }

  beforeEach(async function () {
    [owner, merchant, payer, feeRecipient, other] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    const ArcPay = await ethers.getContractFactory("ArcPay");
    arcPay = await ArcPay.deploy(await usdc.getAddress(), feeRecipient.address, FEE_BPS);

    await usdc.mint(payer.address,     10_000_000n);
    await usdc.mint(merchant.address,  10_000_000n); // merchant needs funds to refund
  });

  // ── Deploy ──────────────────────────────────────────────────────────────────

  it("deploys with correct config", async function () {
    expect(await arcPay.usdc()).to.equal(await usdc.getAddress());
    expect(await arcPay.feeRecipient()).to.equal(feeRecipient.address);
    expect(await arcPay.feeBps()).to.equal(FEE_BPS);
    expect(await arcPay.owner()).to.equal(owner.address);
  });

  it("reverts deploy if fee exceeds MAX_FEE_BPS", async function () {
    const ArcPay = await ethers.getContractFactory("ArcPay");
    await expect(ArcPay.deploy(await usdc.getAddress(), feeRecipient.address, 1001n))
      .to.be.revertedWith("Fee too high");
  });

  it("reverts deploy with zero addresses", async function () {
    const ArcPay = await ethers.getContractFactory("ArcPay");
    await expect(ArcPay.deploy(ethers.ZeroAddress, feeRecipient.address, FEE_BPS))
      .to.be.revertedWith("Invalid USDC");
    await expect(ArcPay.deploy(await usdc.getAddress(), ethers.ZeroAddress, FEE_BPS))
      .to.be.revertedWith("Invalid feeRecipient");
  });

  // ── createPayment ───────────────────────────────────────────────────────────

  it("createPayment emits PaymentCreated (owner)", async function () {
    await expect(arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT, NO_DEADLINE))
      .to.emit(arcPay, "PaymentCreated")
      .withArgs(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT);
  });

  it("createPayment reverts for non-owner", async function () {
    await expect(
      arcPay.connect(other).createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT, NO_DEADLINE)
    ).to.be.revertedWithCustomError(arcPay, "OwnableUnauthorizedAccount");
  });

  it("createPayment reverts on duplicate ID", async function () {
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT, NO_DEADLINE);
    await expect(arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT, NO_DEADLINE))
      .to.be.revertedWith("Payment exists");
  });

  it("createPayment reverts when paused", async function () {
    await arcPay.pause();
    await expect(arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT, NO_DEADLINE))
      .to.be.revertedWithCustomError(arcPay, "EnforcedPause");
  });

  // ── pay ─────────────────────────────────────────────────────────────────────

  it("pay settles atomically — net to merchant, fee to feeRecipient", async function () {
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT, NO_DEADLINE);
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
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT, NO_DEADLINE);
    await usdc.connect(payer).approve(await arcPay.getAddress(), PAYMENT_AMOUNT);

    const fee       = (PAYMENT_AMOUNT * FEE_BPS) / 10000n;
    const netAmount = PAYMENT_AMOUNT - fee;

    await expect(arcPay.connect(payer).pay(PAYMENT_ID))
      .to.emit(arcPay, "PaymentPaid")
      .withArgs(PAYMENT_ID, payer.address, netAmount, fee);
  });

  it("pay with feeBps = 0 sends full amount to merchant", async function () {
    await arcPay.setFeeBps(0n);
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT, NO_DEADLINE);
    await usdc.connect(payer).approve(await arcPay.getAddress(), PAYMENT_AMOUNT);

    await expect(arcPay.connect(payer).pay(PAYMENT_ID))
      .to.changeTokenBalances(usdc, [payer, merchant], [-PAYMENT_AMOUNT, PAYMENT_AMOUNT]);
  });

  it("pay reverts on unknown payment", async function () {
    const unknownId = ethers.keccak256(ethers.toUtf8Bytes("unknown"));
    await expect(arcPay.connect(payer).pay(unknownId))
      .to.be.revertedWith("Payment not found");
  });

  it("pay reverts on double payment", async function () {
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT, NO_DEADLINE);
    await usdc.connect(payer).approve(await arcPay.getAddress(), PAYMENT_AMOUNT * 2n);
    await arcPay.connect(payer).pay(PAYMENT_ID);
    await expect(arcPay.connect(payer).pay(PAYMENT_ID))
      .to.be.revertedWith("Payment not pending");
  });

  it("pay reverts if payer has no approval", async function () {
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT, NO_DEADLINE);
    await expect(arcPay.connect(payer).pay(PAYMENT_ID))
      .to.be.reverted;
  });

  it("pay reverts when paused", async function () {
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT, NO_DEADLINE);
    await usdc.connect(payer).approve(await arcPay.getAddress(), PAYMENT_AMOUNT);
    await arcPay.pause();
    await expect(arcPay.connect(payer).pay(PAYMENT_ID))
      .to.be.revertedWithCustomError(arcPay, "EnforcedPause");
  });

  it("pay reverts after deadline", async function () {
    const dl = deadline(60); // 60 seconds from now
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT, dl);
    await usdc.connect(payer).approve(await arcPay.getAddress(), PAYMENT_AMOUNT);

    await time.increase(61);

    await expect(arcPay.connect(payer).pay(PAYMENT_ID))
      .to.be.revertedWith("Payment expired");
  });

  it("pay succeeds before deadline", async function () {
    const dl = deadline(900);
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT, dl);
    await usdc.connect(payer).approve(await arcPay.getAddress(), PAYMENT_AMOUNT);
    await expect(arcPay.connect(payer).pay(PAYMENT_ID)).to.not.be.reverted;
  });

  // ── refund ──────────────────────────────────────────────────────────────────

  it("refund moves netPaid from merchant back to payer", async function () {
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT, NO_DEADLINE);
    await usdc.connect(payer).approve(await arcPay.getAddress(), PAYMENT_AMOUNT);
    await arcPay.connect(payer).pay(PAYMENT_ID);

    const fee       = (PAYMENT_AMOUNT * FEE_BPS) / 10000n;
    const netAmount = PAYMENT_AMOUNT - fee;

    // merchant approves contract to pull netPaid back
    await usdc.connect(merchant).approve(await arcPay.getAddress(), netAmount);

    await expect(arcPay.connect(merchant).refund(PAYMENT_ID))
      .to.changeTokenBalances(
        usdc,
        [merchant, payer],
        [-netAmount, netAmount]
      );
  });

  it("refund emits PaymentRefunded with netPaid", async function () {
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT, NO_DEADLINE);
    await usdc.connect(payer).approve(await arcPay.getAddress(), PAYMENT_AMOUNT);
    await arcPay.connect(payer).pay(PAYMENT_ID);

    const fee       = (PAYMENT_AMOUNT * FEE_BPS) / 10000n;
    const netAmount = PAYMENT_AMOUNT - fee;

    await usdc.connect(merchant).approve(await arcPay.getAddress(), netAmount);

    await expect(arcPay.connect(merchant).refund(PAYMENT_ID))
      .to.emit(arcPay, "PaymentRefunded")
      .withArgs(PAYMENT_ID, payer.address, netAmount);
  });

  it("refund reverts if caller is not merchant", async function () {
    await arcPay.createPayment(PAYMENT_ID, merchant.address, PAYMENT_AMOUNT, NO_DEADLINE);
    await usdc.connect(payer).approve(await arcPay.getAddress(), PAYMENT_AMOUNT);
    await arcPay.connect(payer).pay(PAYMENT_ID);

    await expect(arcPay.connect(other).refund(PAYMENT_ID))
      .to.be.revertedWith("Not merchant");
  });

  // ── Admin ───────────────────────────────────────────────────────────────────

  it("setFeeBps updates fee and emits FeeUpdated", async function () {
    await expect(arcPay.setFeeBps(100n))
      .to.emit(arcPay, "FeeUpdated")
      .withArgs(100n, feeRecipient.address);
    expect(await arcPay.feeBps()).to.equal(100n);
  });

  it("setFeeBps reverts above MAX_FEE_BPS", async function () {
    await expect(arcPay.setFeeBps(1001n)).to.be.revertedWith("Fee too high");
  });

  it("setFeeBps reverts for non-owner", async function () {
    await expect(arcPay.connect(other).setFeeBps(100n))
      .to.be.revertedWithCustomError(arcPay, "OwnableUnauthorizedAccount");
  });

  it("setFeeRecipient updates address and emits FeeUpdated", async function () {
    await expect(arcPay.setFeeRecipient(other.address))
      .to.emit(arcPay, "FeeUpdated")
      .withArgs(FEE_BPS, other.address);
    expect(await arcPay.feeRecipient()).to.equal(other.address);
  });

  it("setFeeRecipient reverts for non-owner", async function () {
    await expect(arcPay.connect(other).setFeeRecipient(other.address))
      .to.be.revertedWithCustomError(arcPay, "OwnableUnauthorizedAccount");
  });

  it("pause / unpause work correctly", async function () {
    await arcPay.pause();
    expect(await arcPay.paused()).to.be.true;
    await arcPay.unpause();
    expect(await arcPay.paused()).to.be.false;
  });

  it("pause reverts for non-owner", async function () {
    await expect(arcPay.connect(other).pause())
      .to.be.revertedWithCustomError(arcPay, "OwnableUnauthorizedAccount");
  });
});
