const { ethers } = require('ethers');

// Credentials from Env.local
const PRIVATE_KEY = '50023672ba87404043b48d969bff049fd4d6c93c4170661c5f1335703b6808f7';
const CONTRACT = '0x94E9B4A5F04B97801AD5230f4cf74bd75916Fe29';
const ALCHEMY_KEY = 'mP8v2J3V9FbNqkKoySaSU';

const rpcs = [
    { url: 'https://rpc-amoy.polygon.technology', label: 'Polygon Public RPC' },
    { url: 'https://polygon-amoy.g.alchemy.com/v2/' + ALCHEMY_KEY, label: 'Alchemy RPC' },
];

const abi = [
    'function getTotalTourists() view returns (uint256)',
    'function getAllTouristIds() view returns (string[])',
    'function getTouristName(string) view returns (string)',
    'function isValidTourist(string) view returns (bool)',
    'function getTouristKYC(string) view returns (string kycType, string kycNumber)',
    'function touristExists(string) view returns (bool)',
];

async function testRPC(url, label) {
    try {
        const provider = new ethers.providers.JsonRpcProvider(url, { name: 'amoy', chainId: 80002 });
        const block = await Promise.race([
            provider.getBlockNumber(),
            new Promise(function (_, rej) { setTimeout(function () { rej(new Error('Timeout 8s')); }, 8000); })
        ]);
        console.log('✅', label, '| Block:', block);
        return provider;
    } catch (err) {
        console.log('❌', label, '|', String(err.message).substring(0, 80));
        return null;
    }
}

async function main() {
    console.log('=== RPC Connectivity Test ===\n');

    var provider = null;
    for (var i = 0; i < rpcs.length; i++) {
        var result = await testRPC(rpcs[i].url, rpcs[i].label);
        if (result && !provider) provider = result;
    }

    if (!provider) {
        console.log('\n❌ No RPC endpoint reachable');
        return;
    }

    console.log('\n=== Contract Test ===');
    var code = await provider.getCode(CONTRACT);
    console.log('📦 Contract code size:', code.length, 'chars');
    console.log('   Is deployed:', code !== '0x');

    if (code === '0x') {
        console.log('❌ No contract at this address!');
        return;
    }

    var contract = new ethers.Contract(CONTRACT, abi, provider);

    var total = await contract.getTotalTourists();
    console.log('👥 Total tourists on-chain:', total.toString());

    if (total.toNumber() > 0) {
        var ids = await contract.getAllTouristIds();
        console.log('\n📋 Registered Tourist IDs:');
        var limit = Math.min(ids.length, 5);
        for (var j = 0; j < limit; j++) {
            try {
                var name = await contract.getTouristName(ids[j]);
                var valid = await contract.isValidTourist(ids[j]);
                var kyc = await contract.getTouristKYC(ids[j]);
                console.log('   ID:', ids[j]);
                console.log('      Name:', name, '| Valid:', valid);
                console.log('      KYC Type:', kyc.kycType, '| KYC Num:', String(kyc.kycNumber).substring(0, 30) + '...');
            } catch (e) {
                console.log('   ID:', ids[j], '| Error:', String(e.message).substring(0, 50));
            }
        }
    }

    console.log('\n=== Wallet Test ===');
    var wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log('🔑 Wallet address:', wallet.address);
    var balance = await wallet.getBalance();
    console.log('💰 Balance:', ethers.utils.formatEther(balance), 'MATIC');
    var hasGas = balance.gt(ethers.utils.parseEther('0.001'));
    console.log('⛽ Has enough gas:', hasGas);

    console.log('\n=== SUMMARY ===');
    console.log('RPC:        ✅ Connected');
    console.log('Contract:   ' + (code !== '0x' ? '✅ Deployed' : '❌ Not deployed'));
    console.log('Wallet:     ' + (hasGas ? '✅ Funded' : '❌ Need testnet MATIC'));
    console.log('Tourists:   ' + total.toString() + ' registered');
}

main().catch(function (e) { console.error('Fatal:', e.message); });
