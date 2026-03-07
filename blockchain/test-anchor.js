const { ethers } = require('ethers');
const crypto = require('crypto');

const PRIVATE_KEY = '50023672ba87404043b48d969bff049fd4d6c93c4170661c5f1335703b6808f7';
const CONTRACT = '0x94E9B4A5F04B97801AD5230f4cf74bd75916Fe29';
const ALCHEMY_KEY = 'mP8v2J3V9FbNqkKoySaSU';
const RPC_URL = 'https://polygon-amoy.g.alchemy.com/v2/' + ALCHEMY_KEY;

const ABI = [
    'function registerTourist(string memory _touristId, string memory _name, string memory _kycType, string memory _kycNumber, uint256 _startDate, uint256 _endDate, string memory _emergencyContactName, string memory _emergencyContactPhone, string memory _emergencyContactEmail, string memory _itinerary) public',
    'function touristExists(string memory _touristId) public view returns (bool)',
    'function isValidTourist(string memory _touristId) public view returns (bool)',
    'function getTouristKYC(string memory _touristId) public view returns (string memory kycType, string memory kycNumber)',
    'function getTouristName(string memory _touristId) public view returns (string memory)',
];

async function main() {
    console.log('=== E2E Anchor Test (Fixed Gas) ===\n');

    var provider = new ethers.providers.JsonRpcProvider(RPC_URL, { name: 'amoy', chainId: 80002 });
    var wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    // Check gas price
    var gasPrice = await provider.getGasPrice();
    console.log('⛽ Network gas price:', ethers.utils.formatUnits(gasPrice, 'gwei'), 'gwei');

    // Use 1.5x the network gas price to ensure inclusion
    var adjustedGas = gasPrice.mul(150).div(100);
    console.log('⛽ Using gas price:', ethers.utils.formatUnits(adjustedGas, 'gwei'), 'gwei');

    var balance = await wallet.getBalance();
    console.log('💰 Balance:', ethers.utils.formatEther(balance), 'MATIC');

    var nonce = await provider.getTransactionCount(wallet.address, 'latest');
    var pendingNonce = await provider.getTransactionCount(wallet.address, 'pending');
    console.log('📊 Nonce (latest):', nonce, '| Nonce (pending):', pendingNonce);

    // If there's a stuck tx, replace it first
    if (pendingNonce > nonce) {
        console.log('\n⚠️  Found stuck pending tx(es). Replacing with self-transfer at nonce', nonce);
        var replaceTx = await wallet.sendTransaction({
            to: wallet.address,
            value: 0,
            nonce: nonce,
            gasPrice: adjustedGas,
            gasLimit: 21000,
        });
        console.log('   Replace tx:', replaceTx.hash);
        await replaceTx.wait(1);
        console.log('   ✅ Stuck tx replaced');
        nonce++;
    }

    // Generate fresh TID
    var timestamp = new Date().toISOString();
    var seed = 'test_user:test_trip:' + timestamp;
    var hash = crypto.createHash('sha256').update(seed).digest('hex');
    var p1 = parseInt(hash.substring(0, 10), 16).toString(36).toUpperCase().slice(0, 8).padEnd(8, '0');
    var p2 = parseInt(hash.substring(10, 18), 16).toString(36).toUpperCase().slice(0, 6).padEnd(6, '0');
    var tid = 'TID-' + p1 + '-' + p2;

    var payload = JSON.stringify({
        v: 1, tid: tid, name: 'Test Tourist', destination: 'Darjeeling',
        startDate: '2026-03-10', endDate: '2026-03-20',
    });
    var payloadHash = crypto.createHash('sha256').update(payload).digest('hex');

    console.log('\n📋 TID:', tid);
    console.log('🔐 Hash:', payloadHash.substring(0, 32) + '...');

    // Submit with explicit gas
    var contract = new ethers.Contract(CONTRACT, ABI, wallet);
    var startTs = Math.floor(new Date('2026-03-10').getTime() / 1000);
    var endTs = Math.floor(new Date('2026-03-20').getTime() / 1000);

    console.log('\n⏳ Submitting with gas:', ethers.utils.formatUnits(adjustedGas, 'gwei'), 'gwei...');
    var tx = await contract.registerTourist(
        tid, 'Test Tourist', 'TRIP_ANCHOR', payloadHash,
        startTs, endTs, 'Darjeeling', '', '', '',
        { gasPrice: adjustedGas, gasLimit: 500000 }
    );

    console.log('📤 Tx:', tx.hash);
    console.log('   https://amoy.polygonscan.com/tx/' + tx.hash);
    console.log('⏳ Waiting...');

    var receipt = await tx.wait(1);
    console.log('✅ Block:', receipt.blockNumber, '| Gas used:', receipt.gasUsed.toString());

    // Verify
    console.log('\n=== Verify ===');
    var exists = await contract.touristExists(tid);
    var kyc = await contract.getTouristKYC(tid);
    var valid = await contract.isValidTourist(tid);
    var name = await contract.getTouristName(tid);

    console.log('Exists:', exists);
    console.log('Name:', name);
    console.log('KYC Type:', kyc.kycType, '| Hash match:', kyc.kycNumber === payloadHash);
    console.log('Time valid:', valid);
    console.log('\n🎉 SUCCESS — blockchain anchor + verify working!');
}

main().catch(function (e) {
    console.error('❌ FAILED:', e.message);
});
