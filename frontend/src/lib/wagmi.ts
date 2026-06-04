import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arcTestnet } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "ArcPay",
  // Get a free project ID at https://cloud.walletconnect.com
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "arcpay-dev",
  chains: [arcTestnet],
  ssr: false,
});
