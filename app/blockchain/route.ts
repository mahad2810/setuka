import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Contract ABI - just the registerTourist function we need
const TOURIST_CONTRACT_ABI = [
  {
    inputs: [
      { name: '_touristId', type: 'string' },
      { name: '_name', type: 'string' },
      { name: '_kycType', type: 'string' },
      { name: '_kycNumber', type: 'string' },
      { name: '_startDate', type: 'uint256' },
      { name: '_endDate', type: 'uint256' },
      { name: '_emergencyContactName', type: 'string' },
      { name: '_emergencyContactPhone', type: 'string' },
      { name: '_emergencyContactEmail', type: 'string' },
      { name: '_itinerary', type: 'string' }
    ],
    name: 'registerTourist',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

const CONTRACT_ADDRESS = '0x94E9B4A5F04B97801AD5230f4cf74bd75916Fe29' as const;

export async function POST(request: NextRequest) {
  try {
    const { touristData } = await request.json();
    console.log('🔗 Real blockchain registration with VIEM...');
    console.log('📋 Tourist data:', JSON.stringify(touristData, null, 2));

    // Create public client for reading blockchain data
    const publicClient = createPublicClient({
      chain: polygonAmoy,
      transport: http(`https://polygon-amoy.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
    });

    // Test connection
    console.log('📡 Testing Alchemy connection...');
    const blockNumber = await publicClient.getBlockNumber();
    console.log(`✅ Connected to Polygon Amoy! Current block: ${blockNumber}`);

    // Create account from private key
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('BLOCKCHAIN_PRIVATE_KEY not found in environment variables');
    }

    const account = privateKeyToAccount(`0x${privateKey}` as `0x${string}`);
    console.log('💳 Wallet address:', account.address);

    // Create wallet client for sending transactions
    const walletClient = createWalletClient({
      account,
      chain: polygonAmoy,
      transport: http(`https://polygon-amoy.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
    });

    // Check balance
    try {
      const balance = await publicClient.getBalance({ address: account.address });
      console.log('💰 Wallet balance:', formatEther(balance), 'MATIC');
      
      if (balance === BigInt(0)) {
        return NextResponse.json({
          success: false,
          error: 'Insufficient MATIC balance. Please add test tokens from https://faucet.polygon.technology/'
        }, { status: 400 });
      }
    } catch (balanceError: any) {
      console.warn('⚠️ Could not check balance, proceeding anyway:', balanceError.message);
    }

    // Prepare contract parameters
    const params = [
      touristData.touristId || '',
      touristData.name || '',
      touristData.kycType || '',
      touristData.kycNumber || '',
      BigInt(touristData.startDate || 0),
      BigInt(touristData.endDate || 0),
      touristData.emergencyContact?.name || '',
      touristData.emergencyContact?.phone || '',
      touristData.emergencyContact?.email || '',
      Array.isArray(touristData.itinerary) ? 
        touristData.itinerary.join('; ') : 
        (touristData.itinerary || '')
    ] as const;

    console.log('📝 Contract parameters:', params);

    // Execute transaction
    console.log('🚀 Submitting transaction...');
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: TOURIST_CONTRACT_ABI,
      functionName: 'registerTourist',
      args: params
    });

    console.log('⏳ Transaction submitted:', hash);
    console.log('🔗 Track at:', `https://amoy.polygonscan.com/tx/${hash}`);

    // Wait for confirmation
    console.log('⏳ Waiting for confirmation...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log('✅ Transaction confirmed!');
    console.log('📦 Block number:', receipt.blockNumber);
    console.log('⛽ Gas used:', receipt.gasUsed.toString());

    return NextResponse.json({
      success: true,
      txHash: hash,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: `https://amoy.polygonscan.com/tx/${hash}`,
      message: 'Tourist registered successfully on blockchain!'
    });

  } catch (error: any) {
    console.error('❌ Blockchain registration failed:', error);

    // Detailed error handling
    let errorMessage = error.message;
    let errorCode = 500;

    if (error.message.includes('insufficient funds') || error.message.includes('balance')) {
      errorMessage = 'Insufficient MATIC tokens. Get free tokens from: https://faucet.polygon.technology/';
      errorCode = 400;
    } else if (error.message.includes('execution reverted')) {
      errorMessage = 'Smart contract execution failed. The contract might have validation rules that failed.';
      errorCode = 400;
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: error.message,
      network: 'Polygon Amoy Testnet',
      contractAddress: CONTRACT_ADDRESS
    }, { status: errorCode });
  }
}