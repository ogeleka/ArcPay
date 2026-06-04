/** Minimal ABIs — only the functions the frontend calls */

export const ARCPAY_ABI = [
  {
    name: "createPayment",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "paymentId", type: "bytes32" },
      { name: "merchant",  type: "address" },
      { name: "amount",    type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "pay",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "paymentId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "payments",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "paymentId", type: "bytes32" }],
    outputs: [
      { name: "payer",    type: "address" },
      { name: "merchant", type: "address" },
      { name: "amount",   type: "uint256" },
      { name: "status",   type: "uint8"   },
    ],
  },
] as const;

export const USDC_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;
