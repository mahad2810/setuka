require('dotenv').config({ path: '.env.local' });
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    amoy: {
      url: 'https://rpc-amoy.polygon.technology',
      chainId: 80002,
      accounts: process.env.BLOCKCHAIN_PRIVATE_KEY ? [process.env.BLOCKCHAIN_PRIVATE_KEY] : [],
      timeout: 20000,
    },
    mumbai: {
      url: 'https://endpoints.omniatech.io/v1/matic/mumbai/public',
      chainId: 80001,
      accounts: process.env.BLOCKCHAIN_PRIVATE_KEY ? [process.env.BLOCKCHAIN_PRIVATE_KEY] : [],
      timeout: 20000,
    },
  },
};