const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("🚀 Starting TouristID Contract Deployment...\n");

  // Get the contract factory and signer
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "MATIC");
  
  if (balance < hre.ethers.parseEther("0.01")) {
    console.log("⚠️  Warning: Low balance. Make sure you have enough MATIC for deployment.");
    console.log("🔗 Get free MATIC from: https://faucet.polygon.technology/");
  }

  console.log("\n" + "=".repeat(50));
  console.log("🔨 Compiling and deploying TouristID contract...");
  console.log("=".repeat(50));

  // Get the contract factory
  const TouristID = await hre.ethers.getContractFactory("TouristID");
  
  // Deploy the contract (no constructor arguments needed)
  console.log("⚙️  Deploying contract...");
  const touristID = await TouristID.deploy();
  
  // Wait for deployment to be mined
  console.log("⏳ Waiting for deployment to be confirmed...");
  await touristID.waitForDeployment();
  
  const contractAddress = await touristID.getAddress();
  
  // Get network information
  const network = await hre.ethers.provider.getNetwork();
  console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);
  
  // Update the decentralized verifier HTML with the contract address
  updateVerifierContract(touristID.address, network.name);
  
  // Update the blockchain configuration
  updateBlockchainConfig(touristID.address, network.name);
  
  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n📋 Next steps:");
  console.log("1. Update your QR codes to use the new contract");
  console.log("2. Test the verification with the deployed contract");
  console.log("3. The verifier HTML now works with real blockchain data");
  
  return {
    contractAddress: touristID.address,
    transactionHash: touristID.deployTransaction.hash,
    network: network.name,
    chainId: network.chainId
  };
}

async function updateVerifierContract(contractAddress, networkName) {
  try {
    const verifierPath = path.join(__dirname, '../public/decentralized-verifier.html');
    let verifierContent = fs.readFileSync(verifierPath, 'utf8');
    
    // Map network names to our internal names
    const networkMap = {
      'maticmum': 'mumbai',
      'matic': 'polygon',
      'homestead': 'ethereum',
      'unknown': 'mumbai' // fallback
    };
    
    const mappedNetwork = networkMap[networkName] || 'mumbai';
    
    // Update the contract address in the HTML
    const addressPattern = new RegExp(`${mappedNetwork}: '0x0000000000000000000000000000000000000000'`);
    verifierContent = verifierContent.replace(addressPattern, `${mappedNetwork}: '${contractAddress}'`);
    
    fs.writeFileSync(verifierPath, verifierContent);
    console.log(`📝 Updated verifier HTML with contract address for ${mappedNetwork}`);
  } catch (error) {
    console.error("❌ Error updating verifier HTML:", error.message);
  }
}

async function updateBlockchainConfig(contractAddress, networkName) {
  try {
    const configPath = path.join(__dirname, '../src/lib/blockchain-config.ts');
    let configContent = fs.readFileSync(configPath, 'utf8');
    
    // Map network names
    const networkMap = {
      'maticmum': 'mumbai',
      'matic': 'polygon',
      'homestead': 'ethereum',
      'unknown': 'mumbai' // fallback
    };
    
    const mappedNetwork = networkMap[networkName] || 'mumbai';
    
    // Update the contract address
    const addressPattern = new RegExp(`${mappedNetwork}: '0x0000000000000000000000000000000000000000'`);
    configContent = configContent.replace(addressPattern, `${mappedNetwork}: '${contractAddress}'`);
    
    // Also disable mock mode
    configContent = configContent.replace('useMockContract: true', 'useMockContract: false');
    
    fs.writeFileSync(configPath, configContent);
    console.log(`📝 Updated blockchain config with real contract address for ${mappedNetwork}`);
  } catch (error) {
    console.error("❌ Error updating blockchain config:", error.message);
  }
}

// Error handling
main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});

module.exports = { main };