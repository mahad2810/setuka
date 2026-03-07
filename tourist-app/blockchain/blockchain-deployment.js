// Simple blockchain deployment instructions and configuration
// This approach works with any wallet and blockchain

/**
 * STEP 1: Deploy using Remix IDE (https://remix.ethereum.org)
 * 
 * 1. Copy the TouristID.sol contract to Remix
 * 2. Compile with Solidity 0.8.19
 * 3. Connect your MetaMask wallet to Polygon Mumbai testnet
 * 4. Deploy the contract
 * 5. Copy the deployed contract address
 * 6. Update the addresses below
 */

// DEPLOYED CONTRACT ADDRESSES
const DEPLOYED_CONTRACTS = {
  mumbai: '0x0000000000000000000000000000000000000000', // UPDATE AFTER DEPLOYMENT
  polygon: '0x0000000000000000000000000000000000000000', // UPDATE AFTER DEPLOYMENT
};

// NETWORK CONFIGURATIONS
export const BLOCKCHAIN_NETWORKS = {
  mumbai: {
    name: 'Polygon Mumbai Testnet',
    rpc: 'https://rpc-mumbai.maticvigil.com',
    chainId: 80001,
    explorer: 'https://mumbai.polygonscan.com',
    currency: 'MATIC',
    testnet: true
  },
  polygon: {
    name: 'Polygon Mainnet',
    rpc: 'https://polygon-rpc.com',
    chainId: 137,
    explorer: 'https://polygonscan.com',
    currency: 'MATIC',
    testnet: false
  }
};

// CONTRACT ABI for frontend interaction
export const TOURIST_CONTRACT_ABI = [
  "function registerTourist(string memory _touristId, string memory _name, string memory _kycType, string memory _kycNumber, uint256 _startDate, uint256 _endDate, string memory _emergencyContactName, string memory _emergencyContactPhone, string memory _emergencyContactEmail, string memory _itinerary) public",
  "function getTouristInfo(string memory _touristId) public view returns (string memory touristId, string memory name, string memory kycType, string memory kycNumber, uint256 startDate, uint256 endDate, string memory emergencyContactName, string memory emergencyContactPhone, string memory emergencyContactEmail, string memory itinerary, bool isActive, bool isCurrentlyValid, uint256 registrationTime)",
  "function isValidTourist(string memory _touristId) public view returns (bool)",
  "function touristExists(string memory _touristId) public view returns (bool)",
  "function getTouristDataForQR(string memory _touristId) public view returns (string memory)",
  "function deactivateTourist(string memory _touristId) public",
  "function getAllTouristIds() public view returns (string[] memory)",
  "function getTotalTourists() public view returns (uint256)"
];

// Helper function to get contract address
export function getContractAddress(network = 'mumbai') {
  const address = DEPLOYED_CONTRACTS[network];
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    console.warn(`Contract not deployed on ${network} yet`);
    return null;
  }
  return address;
}

// Helper function to get network config
export function getNetworkConfig(network = 'mumbai') {
  return BLOCKCHAIN_NETWORKS[network];
}

// Update this function after deploying contracts
export function updateContractAddress(network, address) {
  DEPLOYED_CONTRACTS[network] = address;
  console.log(`✅ Updated ${network} contract address: ${address}`);
}

// Instructions for manual deployment
export const DEPLOYMENT_INSTRUCTIONS = `
🚀 BLOCKCHAIN DEPLOYMENT INSTRUCTIONS

OPTION 1: Using Remix IDE (Recommended for beginners)
1. Go to https://remix.ethereum.org
2. Create new file: TouristID.sol
3. Copy the contract code from contracts/TouristID.sol
4. Compile with Solidity 0.8.19
5. Connect MetaMask to Polygon Mumbai testnet
6. Deploy the contract
7. Copy the deployed address and update blockchain-deployment.js

OPTION 2: Using MetaMask + Block Explorer
1. Get test MATIC from https://faucet.polygon.technology
2. Use the contract deployment interface on PolygonScan
3. Deploy with the TouristID contract code

OPTION 3: Using Hardhat (Advanced)
1. Configure MetaMask private key in .env.local
2. Run: npx hardhat run scripts/deploy.js --network mumbai

After deployment, update the contract addresses in:
- src/lib/blockchain-deployment.js
- public/decentralized-verifier.html
`;

export default {
  DEPLOYED_CONTRACTS,
  BLOCKCHAIN_NETWORKS,
  TOURIST_CONTRACT_ABI,
  getContractAddress,
  getNetworkConfig,
  updateContractAddress,
  DEPLOYMENT_INSTRUCTIONS
};