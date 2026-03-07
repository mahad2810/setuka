import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { hashPayload, verifyQRSignature } from '@/lib/digital-id'
import { verifyTrip, BLOCKCHAIN_INFO } from '@/lib/blockchain-service'

export const runtime = 'nodejs'

// GET /api/verify/:tid  →  PUBLIC (no auth required)
// This is what the QR code points to. Police, hotels, and hospitals hit this.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ tid: string }> }
) {
    try {
        const { tid } = await params

        if (!tid || !tid.startsWith('TID-')) {
            return NextResponse.json({
                verified: false,
                error: 'Invalid Tourist ID format',
            }, { status: 400 })
        }

        const client = await clientPromise
        const db = client.db('Tourist_App')

        // Lookup trip by TID
        const trip = await db.collection('trips').findOne({
            'digitalId.id': tid,
        })

        if (!trip || !trip.digitalId) {
            return NextResponse.json({
                verified: false,
                error: 'Tourist ID not found',
                tid,
            }, { status: 404 })
        }

        // ─── Tamper Detection ────────────────────────────────────────────────
        // Recompute the hash from the stored QR payload and compare
        const storedPayload = trip.digitalId.qrPayload
        const recomputedHash = hashPayload(storedPayload)
        const storedHash = trip.digitalId.payloadHash
        const tampered = recomputedHash !== storedHash

        // Also verify the HMAC signature on the QR payload
        const signatureValid = verifyQRSignature(storedPayload)

        // ─── Blockchain Verification ──────────────────────────────────────────
        let blockchainVerification: any = {
            anchored: trip.digitalId.blockchainSuccess || false,
            network: BLOCKCHAIN_INFO.network,
            chainId: BLOCKCHAIN_INFO.chainId,
            contractAddress: BLOCKCHAIN_INFO.contractAddress,
            txHash: trip.digitalId.blockchainTxHash,
            explorerUrl: trip.digitalId.blockchainExplorerUrl,
        }

        // Only call blockchain if it was anchored
        if (trip.digitalId.blockchainSuccess && trip.digitalId.blockchainTxHash) {
            try {
                const chainResult = await verifyTrip(tid, storedHash)
                blockchainVerification = {
                    ...blockchainVerification,
                    onChainVerified: chainResult.verified,
                    hashMatches: chainResult.hashMatches,
                    isActiveOnChain: chainResult.isActive,
                }
            } catch (e) {
                console.warn('Blockchain verification call failed (non-critical):', e)
                blockchainVerification.onChainVerified = null
                blockchainVerification.verifyError = 'Blockchain call failed — data integrity still confirmed via server-side hash'
            }
        }

        // ─── Status Computation ──────────────────────────────────────────────
        const now = new Date()
        const endDate = new Date(trip.endDate)
        const startDate = new Date(trip.startDate)
        const isRevoked = trip.digitalId.status === 'revoked'
        const isExpired = endDate < now
        const isUpcoming = startDate > now

        let status: 'active' | 'expired' | 'revoked' | 'upcoming' = 'active'
        if (isRevoked) status = 'revoked'
        else if (isExpired) status = 'expired'
        else if (isUpcoming) status = 'upcoming'

        // ─── Read from fullPayload (rich data) or fall back to compact QR fields ──
        const full = trip.digitalId.fullPayload || {}

        // ─── Response ────────────────────────────────────────────────────────
        // Only expose safe fields — no password, no full medical history, no userId
        return NextResponse.json({
            verified: !tampered && !isRevoked && signatureValid,
            tampered,
            signatureValid,
            status,

            // Tourist identity (from compact QR payload — abbreviated keys)
            name: storedPayload.name || '',
            nationality: storedPayload.nat || '',
            destination: storedPayload.dest || '',
            validPeriod: storedPayload.valid || '',  // "YYYY-MM-DD/YYYY-MM-DD"

            // Emergency data — the critical info for police/hospitals
            emergency: {
                bloodType: trip.medicalInfo?.bloodType || storedPayload.blood || '',
                allergies: trip.medicalInfo?.allergies || full.allergies || '',
                medications: trip.medicalInfo?.medications || full.medications || '',
                emergencyContactName: trip.travellerInfo?.emergencyContactName || full.emergencyName || '',
                emergencyContactPhone: trip.travellerInfo?.emergencyContactPhone || storedPayload.emgPhone || '',
                emergencyContactRelation: trip.travellerInfo?.emergencyContactRelation || full.emergencyRelation || '',
                insuranceProvider: trip.medicalInfo?.insuranceProvider || storedPayload.insurer || '',
                insuranceNumber: trip.medicalInfo?.insuranceNumber || storedPayload['ins#'] || '',
            },

            // Blockchain proof
            blockchain: blockchainVerification,

            // Metadata
            tid,
            issuedAt: trip.digitalId.issuedAt,
        })
    } catch (err) {
        console.error('GET /api/verify/[tid]:', err)
        return NextResponse.json({
            verified: false,
            error: 'Verification service error',
        }, { status: 500 })
    }
}
