// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ArcPay {
    IERC20 public immutable usdc;
    address public feeRecipient;
    uint256 public feeBps;

    enum Status { Pending, Settled, Refunded }

    struct Payment {
        address payer;
        address merchant;
        uint256 amount;
        Status status;
    }

    mapping(bytes32 => Payment) public payments;

    event PaymentCreated(bytes32 indexed paymentId, address indexed merchant, uint256 amount);
    event PaymentPaid(bytes32 indexed paymentId, address indexed payer, uint256 netAmount, uint256 fee);
    event PaymentRefunded(bytes32 indexed paymentId, address indexed payer, uint256 amount);

    constructor(address _usdc, address _feeRecipient, uint256 _feeBps) {
        usdc = IERC20(_usdc);
        feeRecipient = _feeRecipient;
        feeBps = _feeBps;
    }

    function createPayment(bytes32 paymentId, address merchant, uint256 amount) external {
        require(payments[paymentId].merchant == address(0), "Payment exists");
        require(merchant != address(0), "Invalid merchant");
        require(amount > 0, "Amount must be > 0");

        payments[paymentId] = Payment({
            payer: address(0),
            merchant: merchant,
            amount: amount,
            status: Status.Pending
        });

        emit PaymentCreated(paymentId, merchant, amount);
    }

    // Atomic settle — pulls from payer, splits fee to feeRecipient, net goes straight to merchant.
    // No separate release step; funds never sit in escrow.
    function pay(bytes32 paymentId) external {
        Payment storage p = payments[paymentId];
        require(p.merchant != address(0), "Payment not found");
        require(p.status == Status.Pending, "Payment not pending");

        uint256 fee       = (p.amount * feeBps) / 10000;
        uint256 netAmount = p.amount - fee;

        p.payer  = msg.sender;
        p.status = Status.Settled;

        usdc.transferFrom(msg.sender, p.merchant, netAmount);
        if (fee > 0) usdc.transferFrom(msg.sender, feeRecipient, fee);

        emit PaymentPaid(paymentId, msg.sender, netAmount, fee);
    }

    // Refund is handled off-chain (merchant sends back manually) since funds
    // already settled to the merchant wallet. Kept for status tracking only.
    function markRefunded(bytes32 paymentId) external {
        Payment storage p = payments[paymentId];
        require(p.status == Status.Settled, "Not settled");
        require(msg.sender == p.merchant, "Not merchant");
        p.status = Status.Refunded;
        emit PaymentRefunded(paymentId, p.payer, p.amount);
    }
}
