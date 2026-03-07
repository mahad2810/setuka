import { ethers } from 'ethers'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AnchorResult {
    success: boolean
    txHash: string | null
    explorerUrl: string | null
    error?: string
}

export interface VerifyResult {
    verified: boolean
    hashMatches: boolean
    isActive: boolean
    onChainHash: string | null
    network: string
    chainId: number
    explorerUrl: string | null
    error?: string
}

// ─── Contract ABI (minimal — only functions we call) ────────────────────────

const CONTRACT_ABI = [
    // Write
    'function registerTourist(string memory _touristId, string memory _name, string memory _kycType, string memory _kycNumber, uint256 _startDate, uint256 _endDate, string memory _emergencyContactName, string memory _emergencyContactPhone, string memory _emergencyContactEmail, string memory _itinerary) public',
    'function deactivateTourist(string memory _touristId) public',
    // Read
    'function touristExists(string memory _touristId) public view returns (bool)',
    'function isValidTourist(string memory _touristId) public view returns (bool)',
    'function getTouristName(string memory _touristId) public view returns (string memory)',
    'function getTouristKYC(string memory _touristId) public view returns (string memory kycType, string memory kycNumber)',
    'function getTotalTourists() public view returns (uint256)',
]

// ─── Config (from env with fallbacks) ───────────────────────────────────────

const CONTRACT_ADDRESS = process.env.TOURIST_CONTRACT_ADDRESS || '0x94E9B4A5F04B97801AD5230f4cf74bd75916Fe29'
const CHAIN_ID = 80002
const NETWORK_NAME = 'Polygon Amoy Testnet'
const EXPLORER_BASE = 'https://amoy.polygonscan.com'

function getRpcUrl(): string {
    // Prefer Alchemy (more reliable), fall back to public RPC
    const alchemyKey = process.env.ALCHEMY_API_KEY
    if (alchemyKey) {
        return `https://polygon-amoy.g.alchemy.com/v2/${alchemyKey}`
    }
    return 'https://rpc-amoy.polygon.technology'
}

// ─── Provider + Contract Factory ────────────────────────────────────────────

function getProvider() {
    return new ethers.providers.JsonRpcProvider(getRpcUrl(), {
        name: 'amoy',
        chainId: CHAIN_ID,
    })
}

function getReadContract() {
    const provider = getProvider()
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
}

function getWriteContract() {
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY
    if (!privateKey) {
        throw new Error('BLOCKCHAIN_PRIVATE_KEY not set in environment')
    }
    const provider = getProvider()
    const wallet = new ethers.Wallet(privateKey, provider)
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet)
}

// ─── Anchor Trip ────────────────────────────────────────────────────────────

/**
 * Anchors a TID on the blockchain by calling registerTourist.
 *
 * Field mapping:
 *   _touristId              → TID string (e.g. "TID-MF02FVTV-IAL6UK")
 *   _name                   → tourist name
 *   _kycType                → "TRIP_ANCHOR" (constant marker)
 *   _kycNumber              → SHA-256 payload hash (the tamper-detection anchor)
 *   _startDate / _endDate   → trip period (unix timestamps)
 *   _emergencyContactName   → destination (repurposed)
 *   other fields             → empty (no PII on-chain)
 *
 * CRITICAL: This function is non-blocking. Trip creation NEVER fails due to blockchain.
 */
export async function anchorTrip(
    tid: string,
    payloadHash: string,
    touristName: string,
    startDate: string,
    endDate: string,
    destination: string
): Promise<AnchorResult> {
    try {
        const contract = getWriteContract()
        const provider = getProvider()

        const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000)
        const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000)

        // Get current gas price and add 50% buffer for reliable inclusion
        const networkGasPrice = await provider.getGasPrice()
        const gasPrice = networkGasPrice.mul(150).div(100)

        console.log(`🔗 Anchoring TID on blockchain: ${tid}`)
        console.log(`   Hash: ${payloadHash}`)
        console.log(`   Contract: ${CONTRACT_ADDRESS}`)
        console.log(`   RPC: ${getRpcUrl().replace(/\/v2\/.*/, '/v2/***')}`)
        console.log(`   Gas: ${Number(gasPrice) / 1e9} gwei`)

        const tx = await contract.registerTourist(
            tid,               // _touristId
            touristName,       // _name
            'TRIP_ANCHOR',     // _kycType (marker for Digital ID anchors)
            payloadHash,       // _kycNumber (SHA-256 hash!)
            startTimestamp,    // _startDate
            endTimestamp,      // _endDate
            destination,       // _emergencyContactName (repurposed)
            '',                // _emergencyContactPhone (empty)
            '',                // _emergencyContactEmail (empty)
            '',                // _itinerary (empty)
            { gasPrice, gasLimit: 500000 }  // Explicit gas to avoid stuck txs
        )

        console.log(`⏳ Transaction submitted: ${tx.hash}`)

        // Wait for 1 confirmation
        const receipt = await tx.wait(1)
        console.log(`✅ Anchored in block ${receipt.blockNumber}`)

        return {
            success: true,
            txHash: tx.hash,
            explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}`,
        }

    } catch (error: any) {
        console.error('❌ Blockchain anchor failed:', error.message)
        return {
            success: false,
            txHash: null,
            explorerUrl: null,
            error: error.message,
        }
    }
}

// ─── Verify Trip ────────────────────────────────────────────────────────────

/**
 * Verifies a TID against the blockchain:
 *   1. touristExists(tid)   → is it on-chain?
 *   2. getTouristKYC(tid)   → reads kycType + kycNumber (our hash)
 *   3. isValidTourist(tid)  → time-bounded validity check
 *   4. Compare on-chain hash with expected hash from MongoDB
 */
export async function verifyTrip(
    tid: string,
    expectedHash: string
): Promise<VerifyResult> {
    try {
        const contract = getReadContract()

        // Step 1: Check existence
        let exists = false
        try {
            exists = await contract.touristExists(tid)
        } catch (e) {
            console.warn('touristExists call failed:', e)
        }

        if (!exists) {
            return {
                verified: false,
                hashMatches: false,
                isActive: false,
                onChainHash: null,
                network: NETWORK_NAME,
                chainId: CHAIN_ID,
                explorerUrl: null,
                error: 'TID not found on blockchain',
            }
        }

        // Step 2: Read the stored hash via getTouristKYC
        let onChainHash: string | null = null
        try {
            const kyc = await contract.getTouristKYC(tid)
            onChainHash = kyc.kycNumber  // This is our SHA-256 payload hash
            console.log(`🔍 On-chain KYC: type=${kyc.kycType}, hash=${onChainHash?.substring(0, 16)}...`)
        } catch (e: any) {
            console.warn('getTouristKYC call failed:', e.message)
        }

        // Step 3: Check time-bounded validity
        let isActive = false
        try {
            isActive = await contract.isValidTourist(tid)
        } catch (e) {
            console.warn('isValidTourist call failed:', e)
        }

        // Step 4: Compare hashes
        const hashMatches = onChainHash !== null && onChainHash === expectedHash

        return {
            verified: hashMatches && isActive,
            hashMatches,
            isActive,
            onChainHash,
            network: NETWORK_NAME,
            chainId: CHAIN_ID,
            explorerUrl: `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`,
        }

    } catch (error: any) {
        console.error('❌ Blockchain verify failed:', error.message)
        return {
            verified: false,
            hashMatches: false,
            isActive: false,
            onChainHash: null,
            network: NETWORK_NAME,
            chainId: CHAIN_ID,
            explorerUrl: null,
            error: error.message,
        }
    }
}

// ─── Deactivate (Revoke on-chain) ───────────────────────────────────────────

/**
 * Deactivates a tourist ID on the blockchain (only callable by original registrar).
 */
export async function deactivateTouristOnChain(tid: string): Promise<AnchorResult> {
    try {
        const contract = getWriteContract()
        const tx = await contract.deactivateTourist(tid)
        const receipt = await tx.wait(1)
        return {
            success: true,
            txHash: tx.hash,
            explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}`,
        }
    } catch (error: any) {
        console.error('❌ Blockchain deactivate failed:', error.message)
        return {
            success: false,
            txHash: null,
            explorerUrl: null,
            error: error.message,
        }
    }
}

// ─── Retry Utility ──────────────────────────────────────────────────────────

export async function anchorTripWithRetry(
    tid: string,
    payloadHash: string,
    touristName: string,
    startDate: string,
    endDate: string,
    destination: string,
    retryDelayMs: number = 5000
): Promise<AnchorResult> {
    const firstAttempt = await anchorTrip(tid, payloadHash, touristName, startDate, endDate, destination)
    if (firstAttempt.success) return firstAttempt

    console.log(`🔄 Retrying blockchain anchor in ${retryDelayMs}ms...`)
    await new Promise(resolve => setTimeout(resolve, retryDelayMs))

    return anchorTrip(tid, payloadHash, touristName, startDate, endDate, destination)
}

// ─── Exports ────────────────────────────────────────────────────────────────

export const BLOCKCHAIN_INFO = {
    contractAddress: CONTRACT_ADDRESS,
    network: NETWORK_NAME,
    chainId: CHAIN_ID,
    explorerBase: EXPLORER_BASE,
}
