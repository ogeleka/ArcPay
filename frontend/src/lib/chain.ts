import { defineChain } from "viem";

/**
 * Arc testnet - all chain-specific constants live here.
 * Import from this file anywhere you need chain config.
 */
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,          // USDC is the native gas token on Arc
  },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
});

/** USDC system contract - the ERC-20 address on Arc */
export const USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000" as const;

/** Deployed ArcPay contract address - set VITE_ARCPAY_ADDRESS in your .env */
export const ARCPAY_ADDRESS = (
  import.meta.env.VITE_ARCPAY_ADDRESS ?? ""
) as `0x${string}`;
