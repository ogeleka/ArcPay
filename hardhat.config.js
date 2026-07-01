require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    arcTestnet: {
      url: process.env.ARC_TESTNET_RPC || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  // Arcscan runs Blockscout, which exposes an Etherscan-compatible verify API.
  // Blockscout ignores the API key, so any non-empty string works.
  etherscan: {
    apiKey: { arcTestnet: "arcscan" },
    customChains: [
      {
        network: "arcTestnet",
        chainId: 5042002,
        urls: {
          apiURL: "https://testnet.arcscan.app/api",
          browserURL: "https://testnet.arcscan.app",
        },
      },
    ],
  },
};
