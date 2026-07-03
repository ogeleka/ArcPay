const { ethers } = require("ethers");
const crypto = require("crypto");
const { db } = require("./db");
const { deliver } = require("./webhook");

const ABI = [
  "event PaymentPaid(bytes32 indexed paymentId, address indexed payer, uint256 amount, uint256 fee)",
  "event PaymentRefunded(bytes32 indexed paymentId, address indexed payer, uint256 amount)",
];

const CONTRACT_ABI = [
  ...ABI,
  // Full Payment struct as declared in ArcPay.sol (7 fields) — must match exactly
  // so ethers decodes `status` from the right slot.
  "function payments(bytes32) view returns (address payer, address merchant, uint256 amount, uint256 netPaid, uint256 feeBpsSnapshot, uint64 deadline, uint8 status)",
];

// On-chain Status enum in ArcPay.sol: 0 = Pending, 1 = Settled, 2 = Refunded.
const ON_CHAIN_STATUS = { 1: "PaymentPaid", 2: "PaymentRefunded" };

const STATUS = {
  PaymentPaid:     "paid",
  PaymentRefunded: "refunded",
};

function persist(eventType, paymentId, payer, txHash, blockNumber) {
  const paidAtClause = eventType === "PaymentPaid" ? ", paid_at = datetime('now')" : "";
  db.prepare(
    `UPDATE payments SET status = ?, payer = COALESCE(?, payer), updated_at = datetime('now')${paidAtClause} WHERE id = ?`
  ).run(STATUS[eventType], payer ?? null, paymentId);

  try {
    db.prepare(
      `INSERT INTO transactions (id, payment_id, tx_hash, event_type, block_number) VALUES (?, ?, ?, ?, ?)`
    ).run(crypto.randomUUID(), paymentId, txHash, eventType, blockNumber);
  } catch (err) {
    if (!err.message.includes("UNIQUE constraint failed")) throw err;
  }

  console.log(`[listener] ${eventType} ${paymentId.slice(0, 10)}... tx=${txHash ? txHash.slice(0, 10) : "n/a"}...`);

  const row = db.prepare(
    `SELECT m.webhook_url, m.webhook_secret FROM payments p
     JOIN merchants m ON m.id = p.merchant_id WHERE p.id = ?`
  ).get(paymentId);

  if (row?.webhook_url && row?.webhook_secret) {
    const p = db.prepare(
      "SELECT amount, currency, amount_ngn, rate, status, payer, order_id FROM payments WHERE id = ?"
    ).get(paymentId);
    deliver(row.webhook_url, row.webhook_secret, {
      event:       `payment.${STATUS[eventType]}`,
      payment_id:  paymentId,
      order_id:    p.order_id ?? null,
      amount_usdc:  p.amount,
      amount_local: p.amount_ngn ?? null,   // whole units of the priced currency (AED, NGN, …)
      amount_ngn:   p.amount_ngn ?? null,   // deprecated alias of amount_local
      rate:         p.rate ?? null,
      currency:     p.currency || "USDC",
      status:       p.status,
      payer:        p.payer,
      tx_hash:      txHash,
      timestamp:    new Date().toISOString(),
    }).catch((err) => console.error("[webhook] delivery error:", err.message));
  }
}

function handleEvent(event) {
  if (!event.fragment || !STATUS[event.fragment.name]) return;
  const { paymentId, payer } = event.args;
  persist(event.fragment.name, paymentId, payer ?? null, event.transactionHash, event.blockNumber);
}

function makeProvider(rpc) {
  const network = new ethers.Network("arc-testnet", 5042002);
  const req = new ethers.FetchRequest(rpc);
  req.timeout = 30_000;
  return new ethers.JsonRpcProvider(req, network, { staticNetwork: network });
}

function startListener() {
  const rpc     = process.env.ARC_TESTNET_RPC;
  const address = process.env.ARCPAY_ADDRESS;
  if (!rpc || !address) {
    console.warn("[listener] ARC_TESTNET_RPC or ARCPAY_ADDRESS not set - skipping");
    return;
  }

  // Direct state checker
  // Polls contract.payments(id) for every DB-pending payment.
  // Catches events the log scanner missed due to RPC timeouts.
  async function checkPending() {
    const pending = db.prepare(
      `SELECT id FROM payments WHERE status = 'pending'
       AND (expires_at IS NULL OR expires_at > datetime('now'))`
    ).all();

    if (pending.length === 0) { setTimeout(checkPending, 10_000); return; }

    let provider;
    try {
      provider = makeProvider(rpc);
      const contract = new ethers.Contract(address, CONTRACT_ABI, provider);

      for (const { id } of pending) {
        try {
          const onChain = await contract.payments(id);
          const statusCode = Number(onChain.status);
          const eventType  = ON_CHAIN_STATUS[statusCode];
          if (eventType) {
            console.log(`[listener] catch-up: ${eventType} for ${id.slice(0, 10)}...`);
            persist(eventType, id, onChain.payer, null, null);
          }
        } catch (err) {
          // single payment check failed - skip it, try next cycle
        }
      }
    } catch (err) {
      console.error("[listener] checkPending error:", err.message);
    }

    setTimeout(checkPending, 10_000);
  }

  // Event log scanner
  // Scans block ranges for contract events. Secondary to the state checker
  // but provides tx_hash + block_number for the transaction record.
  async function tryStart() {
    let provider;
    try {
      provider = makeProvider(rpc);
      provider.on("error", (err) => console.error("[listener] provider error:", err.message));

      const contract     = new ethers.Contract(address, CONTRACT_ABI, provider);
      const currentBlock = await provider.getBlockNumber();
      // Look back 5 000 blocks to recover recent missed events without overloading the RPC
      let lastBlock         = Math.max(0, currentBlock - 5_000);
      let consecutiveErrors = 0;
      console.log(`[listener] watching ${address} from block ${lastBlock} (current ${currentBlock})`);

      async function poll() {
        try {
          const current = await provider.getBlockNumber();
          if (current > lastBlock) {
            for (let from = lastBlock + 1; from <= current; from += 500) {
              const to     = Math.min(from + 499, current);
              const events = await contract.queryFilter("*", from, to);
              for (const ev of events) handleEvent(ev);
            }
            lastBlock = current;
          }
          consecutiveErrors = 0;
        } catch (err) {
          consecutiveErrors++;
          if (consecutiveErrors >= 5) {
            console.warn("[listener] too many log errors - restarting");
            provider.removeAllListeners();
            return setTimeout(tryStart, 10_000);
          }
        }
        setTimeout(poll, consecutiveErrors > 0 ? 20_000 : 10_000);
      }

      poll();
    } catch (err) {
      console.error("[listener] startup failed, retrying in 15s:", err.message);
      if (provider) provider.removeAllListeners();
      setTimeout(tryStart, 15_000);
    }
  }

  checkPending();
  tryStart();
}

module.exports = { startListener };
