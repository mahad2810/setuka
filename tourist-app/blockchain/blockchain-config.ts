// Blockchain configuration for Tourist ID verification
export const BLOCKCHAIN_CONFIG = {
  // Default network for QR codes - using Amoy testnet with deployed contract
  defaultNetwork: 'amoy' as const,
  
  // Contract addresses for different networks
  contractAddresses: {
    polygon: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    mumbai: '0x0000000000000000000000000000000000000000',   // Mumbai testnet (deprecated)
    amoy: '0x94E9B4A5F04B97801AD5230f4cf74bd75916Fe29',     // Amoy testnet - DEPLOYED!
    sepolia: '0x0000000000000000000000000000000000000000'  // Ethereum testnet
  },
  
  // Network RPC endpoints
  networkRpcs: {
    polygon: 'https://polygon-rpc.com',
    mumbai: 'https://rpc-mumbai.maticvigil.com',
    amoy: 'https://rpc-amoy.polygon.technology',
    sepolia: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'
  },
  
  // Block explorer URLs
  explorers: {
    polygon: 'https://polygonscan.com',
    mumbai: 'https://mumbai.polygonscan.com',
    amoy: 'https://amoy.polygonscan.com',
    sepolia: 'https://sepolia.etherscan.io'
  },
  
  // REAL CONTRACT DEPLOYED! No longer using mock
  useMockContract: false,
  mockContractAddress: '0x1234567890123456789012345678901234567890',
  
  // Universal verification app URL (could be your domain or IPFS)
  verificationAppUrl: 'https://verify-tourist-id.web3.app'
};

// Get the contract address for the current environment
export function getContractAddress(network: keyof typeof BLOCKCHAIN_CONFIG.contractAddresses = 'amoy'): string {
  if (BLOCKCHAIN_CONFIG.useMockContract) {
    return BLOCKCHAIN_CONFIG.mockContractAddress;
  }
  
  const address = BLOCKCHAIN_CONFIG.contractAddresses[network];
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    console.warn(`No contract address configured for network: ${network}`);
    return BLOCKCHAIN_CONFIG.mockContractAddress;
  }
  
  return address;
}

// Get the verification app URL with proper parameters
export function getVerificationAppUrl(touristId: string, network: string = BLOCKCHAIN_CONFIG.defaultNetwork): string {
  const contractAddress = getContractAddress(network as keyof typeof BLOCKCHAIN_CONFIG.contractAddresses);
  return `${BLOCKCHAIN_CONFIG.verificationAppUrl}/blockchain-verify?contract=${contractAddress}&id=${touristId}&network=${network}`;
}