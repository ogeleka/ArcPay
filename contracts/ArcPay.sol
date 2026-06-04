// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract ArcPay is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public feeRecipient;
    uint256 public feeBps;

    uint256 public constant MAX_FEE_BPS = 1000; // 10% hard ceiling

    enum Status { Pending, Settled, Refunded }

    struct Payment {
        address payer;
        address merchant;
        uint256 amount;          // gross USDC base units (6 dp)
        uint256 netPaid;         // what the merchant received (set on pay)
        uint256 feeBpsSnapshot;  // fee rate locked at creation — immune to later setFeeBps
        uint64  deadline;        // unix timestamp; 0 = no expiry
        Status  status;
    }

    mapping(bytes32 => Payment) public payments;

    event PaymentCreated(bytes32 indexed paymentId, address indexed merchant, uint256 amount);
    event PaymentPaid(bytes32 indexed paymentId, address indexed payer, uint256 netAmount, uint256 fee);
    event PaymentRefunded(bytes32 indexed paymentId, address indexed payer, uint256 netPaid);
    event FeeUpdated(uint256 feeBps, address feeRecipient);

    constructor(address _usdc, address _feeRecipient, uint256 _feeBps)
        Ownable(msg.sender)
    {
        require(_usdc.code.length > 0,        "USDC not a contract"); // item 4
        require(_feeRecipient != address(0),  "Invalid feeRecipient");
        require(_feeBps <= MAX_FEE_BPS,       "Fee too high");
        usdc         = IERC20(_usdc);
        feeRecipient = _feeRecipient;
        feeBps       = _feeBps;
    }

    // Only the backend (owner) can register payments — closes front-run theft vector.
    // paymentId is generated off-chain by the backend, e.g.
    //   keccak256(abi.encode(merchant, amount, orderId/nonce))  — must be unique.
    function createPayment(
        bytes32 paymentId,
        address merchant,
        uint256 amount,
        uint64  deadline
    ) external onlyOwner whenNotPaused {
        require(payments[paymentId].merchant == address(0), "Payment exists");
        require(merchant != address(0), "Invalid merchant");
        require(amount > 0, "Amount must be > 0");
        require(deadline == 0 || deadline > block.timestamp, "Deadline in past"); // item 2

        payments[paymentId] = Payment({
            payer:          address(0),
            merchant:       merchant,
            amount:         amount,
            netPaid:        0,
            feeBpsSnapshot: feeBps, // item 1 — lock the fee for this invoice
            deadline:       deadline,
            status:         Status.Pending
        });

        emit PaymentCreated(paymentId, merchant, amount);
    }

    // Atomic settle — net goes straight to merchant, fee to protocol, no escrow.
    function pay(bytes32 paymentId) external nonReentrant whenNotPaused {
        Payment storage p = payments[paymentId];
        require(p.merchant != address(0), "Payment not found");
        require(p.status == Status.Pending, "Payment not pending");
        require(p.deadline == 0 || block.timestamp <= p.deadline, "Payment expired");

        uint256 amount    = p.amount;
        uint256 fee       = (amount * p.feeBpsSnapshot) / 10000; // item 1 — use snapshot
        uint256 netAmount = amount - fee;

        // effects before interactions (CEI)
        p.payer   = msg.sender;
        p.netPaid = netAmount;
        p.status  = Status.Settled;

        // interactions
        usdc.safeTransferFrom(msg.sender, p.merchant, netAmount);
        if (fee > 0) usdc.safeTransferFrom(msg.sender, feeRecipient, fee);

        emit PaymentPaid(paymentId, msg.sender, netAmount, fee);
    }

    // Real refund — merchant approves the contract first, then it pulls netPaid back
    // to the payer. Status set BEFORE the transfer (CEI) to block reentrancy.
    function refund(bytes32 paymentId) external nonReentrant {
        Payment storage p = payments[paymentId];
        require(p.status == Status.Settled, "Not settled");
        require(msg.sender == p.merchant,   "Not merchant");

        uint256 net = p.netPaid;
        p.status = Status.Refunded; // effect before interaction — keep this order

        usdc.safeTransferFrom(msg.sender, p.payer, net);
        emit PaymentRefunded(paymentId, p.payer, net);
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid feeRecipient");
        feeRecipient = _feeRecipient;
        emit FeeUpdated(feeBps, _feeRecipient);
    }

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "Fee too high");
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps, feeRecipient);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}