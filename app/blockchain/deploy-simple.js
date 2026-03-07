const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying TouristID to Mumbai...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await deployer.getBalance();
  console.log("Account balance:", hre.ethers.utils.formatEther(balance), "MATIC");
  
  if (balance.lt(hre.ethers.utils.parseEther("0.01"))) {
    console.log("⚠️  Warning: Low balance. Get test MATIC from:");
    console.log("🔗 https://faucet.polygon.technology/");
  }

  const TouristID = await hre.ethers.getContractFactory("TouristID");
  console.log("Deploying contract...");
  const contract = await TouristID.deploy();
  
  console.log("Waiting for deployment...");
  await contract.deployed();

  console.log("✅ TouristID deployed to:", contract.address);
  console.log("🔗 View on Mumbai PolygonScan:");
  console.log(`https://mumbai.polygonscan.com/address/${contract.address}`);
  
  console.log("\n📝 Add this to your .env.local:");
  console.log(`TOURIST_CONTRACT_ADDRESS=${contract.address}`);
  console.log(`TOURIST_CONTRACT_NETWORK=mumbai`);
  
  // Test basic functionality
  console.log("\n🧪 Testing contract...");
  const totalTourists = await contract.getTotalTourists();
  console.log("✅ Contract working! Total tourists:", totalTourists.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});