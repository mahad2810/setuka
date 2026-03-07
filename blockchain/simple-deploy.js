import hre from "hardhat";

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
    return;
  }

  console.log("\n" + "=".repeat(50));
  console.log("🔨 Compiling and deploying TouristID contract...");
  console.log("=".repeat(50));

  // Get the contract factory
  const TouristID = await hre.ethers.getContractFactory("TouristID");
  
  // Deploy the contract
  console.log("⚙️  Deploying contract...");
  const touristID = await TouristID.deploy();
  
  // Wait for deployment to be mined
  console.log("⏳ Waiting for deployment to be confirmed...");
  await touristID.waitForDeployment();
  
  const contractAddress = await touristID.getAddress();
  
  console.log("\n" + "=".repeat(50));
  console.log("🎉 DEPLOYMENT SUCCESSFUL!");
  console.log("=".repeat(50));
  console.log("📍 Contract Address:", contractAddress);
  console.log("🌐 Network: Mumbai Testnet");
  console.log("👤 Deployed by:", deployer.address);
  console.log("🔗 View on Explorer:");
  console.log(`   https://mumbai.polygonscan.com/address/${contractAddress}`);
  
  // Test basic contract functionality
  console.log("\n" + "=".repeat(50));
  console.log("🧪 TESTING DEPLOYMENT:");
  console.log("=".repeat(50));
  
  try {
    const totalTourists = await touristID.getTotalTourists();
    console.log("✅ Contract is working! Total tourists:", totalTourists.toString());
    
    const allIds = await touristID.getAllTouristIds();
    console.log("✅ Can fetch tourist IDs! Currently:", allIds.length, "tourists");
    
  } catch (error) {
    console.log("❌ Contract test failed:", error.message);
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("📋 NEXT STEPS:");
  console.log("=".repeat(50));
  console.log("1. Add this to your .env.local file:");
  console.log(`   TOURIST_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`   TOURIST_CONTRACT_NETWORK=mumbai`);
  console.log("");
  console.log("2. Update your blockchain.ts file with the contract address");
  console.log("3. Test registration and verification");
  console.log("4. Deploy verifier to IPFS for universal QR scanning");
  
  console.log("\n🎯 Your Tourist ID system is now LIVE on blockchain!");
  console.log("🔗 Contract Address:", contractAddress);
}

// Run the deployment
main()
  .then(() => {
    console.log("\n✅ Deployment completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });