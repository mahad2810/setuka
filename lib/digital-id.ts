import { createHash, createHmac } from 'crypto'
import QRCode from 'qrcode'

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Compact QR payload — matches the user's spec exactly.
 * Abbreviated keys keep it under ~800 bytes for reliable QR scanning.
 * Contains enough emergency data for offline first responders.
 */
export interface TripQRPayload {
    tid: string            // TID-XXXXXXXX-XXXXXX
    v: string              // schema version ("1")
    name: string           // tourist full name
    nat: string            // nationality code (e.g. "IN")
    dest: string           // destination
    valid: string          // "YYYY-MM-DD/YYYY-MM-DD"
    blood: string          // blood type
    emgPhone: string       // emergency contact phone
    insurer: string        // insurance provider
    'ins#': string         // insurance policy number
    verify: string         // https://setuka.app/verify/TID-XXXX
    sig: string            // HMAC signature fingerprint
}

/**
 * Full payload stored in MongoDB (includes fields not in the compact QR).
 */
export interface FullDigitalIdPayload extends TripQRPayload {
    passport: string
    allergies: string
    medications: string
    emergencyName: string
    emergencyRelation: string
    issuedAt: string       // ISO 8601
}

export interface DigitalIdResult {
    tid: string
    qrPayload: TripQRPayload
    fullPayload: FullDigitalIdPayload
    payloadHash: string        // SHA-256 hex
    qrImageBase64: string      // data:image/png;base64,...
}

export interface DigitalIdSubdocument {
    id: string                 // TID-XXXXXXXX-XXXXXX
    issuedAt: string           // ISO 8601
    expiresAt: string          // same as trip endDate
    qrPayload: TripQRPayload  // compact payload (in QR)
    fullPayload: FullDigitalIdPayload  // full payload (in MongoDB)
    qrImageBase64: string
    payloadHash: string
    blockchainTxHash: string | null
    blockchainExplorerUrl: string | null
    blockchainAnchoredAt: string | null
    blockchainSuccess: boolean
    status: 'active' | 'expired' | 'revoked'
}

// ─── TID Generator ──────────────────────────────────────────────────────────

/**
 * Generates a TID in the format: TID-XXXXXXXX-XXXXXX
 * Deterministic from userId + tripId + timestamp.
 */
export function generateTID(userId: string, tripId: string, timestamp: string): string {
    const seed = `${userId}:${tripId}:${timestamp}`
    const hash = createHash('sha256').update(seed).digest('hex')

    const part1 = parseInt(hash.substring(0, 10), 16).toString(36).toUpperCase().slice(0, 8)
    const part2 = parseInt(hash.substring(10, 18), 16).toString(36).toUpperCase().slice(0, 6)

    return `TID-${part1.padEnd(8, '0')}-${part2.padEnd(6, '0')}`
}

// ─── Signature Generator ────────────────────────────────────────────────────

/**
 * Creates a short HMAC-SHA256 signature fingerprint.
 * Uses JWT_SECRET as the signing key.
 * This lets offline verifiers detect basic tampering of the QR data.
 */
function generateSignature(data: string): string {
    const secret = process.env.JWT_SECRET || 'setuka-default-key'
    return createHmac('sha256', secret).update(data).digest('hex').slice(0, 12)
}

// ─── QR Payload Builder ─────────────────────────────────────────────────────

/**
 * Builds the compact QR payload (abbreviated keys, <800 bytes).
 * This is what gets encoded directly in the QR code.
 * Contains enough emergency data for offline first responders.
 */
export function buildQRPayload(
    trip: any,
    user: any,
    tid: string
): TripQRPayload {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    const startDate = trip?.startDate ? trip.startDate.split('T')[0] : ''
    const endDate = trip?.endDate ? trip.endDate.split('T')[0] : ''

    const payload: Omit<TripQRPayload, 'sig'> = {
        tid,
        v: '1',
        name: user?.name || 'Unknown',
        nat: trip?.travellerInfo?.nationality || user?.nationality || '',
        dest: trip?.destination || '',
        valid: `${startDate}/${endDate}`,
        blood: trip?.medicalInfo?.bloodType || '',
        emgPhone: trip?.travellerInfo?.emergencyContactPhone || '',
        insurer: trip?.medicalInfo?.insuranceProvider || '',
        'ins#': trip?.medicalInfo?.insuranceNumber || '',
        verify: `${baseUrl}/verify/${tid}`,
    }

    // Generate signature from the payload content (excluding sig itself)
    const sig = generateSignature(JSON.stringify(payload))

    return { ...payload, sig }
}

/**
 * Builds the full payload (stored in MongoDB, served by API — not in QR).
 * Contains additional fields like passport, allergies, medications.
 */
export function buildFullPayload(
    trip: any,
    user: any,
    qrPayload: TripQRPayload
): FullDigitalIdPayload {
    return {
        ...qrPayload,
        passport: trip?.travellerInfo?.passportNumber || user?.passportNumber || '',
        allergies: trip?.medicalInfo?.allergies || '',
        medications: trip?.medicalInfo?.medications || '',
        emergencyName: trip?.travellerInfo?.emergencyContactName || '',
        emergencyRelation: trip?.travellerInfo?.emergencyContactRelation || '',
        issuedAt: new Date().toISOString(),
    }
}

// ─── SHA-256 Hasher ─────────────────────────────────────────────────────────

/**
 * Computes SHA-256 hex hash of the QR payload.
 * This is what gets anchored on the blockchain — never raw PII.
 */
export function hashPayload(payload: TripQRPayload): string {
    const canonical = JSON.stringify(payload)
    return createHash('sha256').update(canonical).digest('hex')
}

// ─── QR Code Generator ─────────────────────────────────────────────────────

/**
 * Generates a QR code as a base64 PNG data URL.
 * Encodes the FULL compact payload JSON for offline use.
 * First responders can decode the QR without internet and see:
 * name, blood type, emergency phone, insurance, nationality.
 */
export async function generateQRImage(payload: TripQRPayload): Promise<string> {
    // Encode the full compact JSON — not just the URL
    // This enables offline mode for first responders
    const qrContent = JSON.stringify(payload)

    const dataUrl = await QRCode.toDataURL(qrContent, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 300,
        color: {
            dark: '#1a3a2a',   // Setuka brand dark green
            light: '#ffffff',
        },
    })

    return dataUrl
}

// ─── Main Orchestrator ──────────────────────────────────────────────────────

/**
 * Generates all Digital ID outputs in one call:
 * 1. TID string
 * 2. Compact QR payload (for QR code — offline capable)
 * 3. Full payload (for MongoDB — served via API)
 * 4. SHA-256 hash (for blockchain anchoring)
 * 5. QR code as base64 PNG
 */
export async function generateDigitalId(
    trip: any,
    user: any,
    tripId: string
): Promise<DigitalIdResult> {
    const timestamp = new Date().toISOString()
    const tid = generateTID(user?._id?.toString() || user?.userId || '', tripId, timestamp)
    const qrPayload = buildQRPayload(trip, user, tid)
    const fullPayload = buildFullPayload(trip, user, qrPayload)
    const payloadHash = hashPayload(qrPayload)
    const qrImageBase64 = await generateQRImage(qrPayload)

    return {
        tid,
        qrPayload,
        fullPayload,
        payloadHash,
        qrImageBase64,
    }
}

// ─── MongoDB Subdocument Builder ────────────────────────────────────────────

/**
 * Builds the complete digitalId subdocument for MongoDB storage.
 */
export function buildDigitalIdSubdocument(
    result: DigitalIdResult,
    tripEndDate: string,
    blockchain: {
        txHash: string | null
        explorerUrl: string | null
        success: boolean
    }
): DigitalIdSubdocument {
    const now = new Date()
    const expiry = new Date(tripEndDate)
    const status = expiry < now ? 'expired' : 'active'

    return {
        id: result.tid,
        issuedAt: result.fullPayload.issuedAt,
        expiresAt: tripEndDate,
        qrPayload: result.qrPayload,
        fullPayload: result.fullPayload,
        qrImageBase64: result.qrImageBase64,
        payloadHash: result.payloadHash,
        blockchainTxHash: blockchain.txHash,
        blockchainExplorerUrl: blockchain.explorerUrl,
        blockchainAnchoredAt: blockchain.success ? new Date().toISOString() : null,
        blockchainSuccess: blockchain.success,
        status,
    }
}

/**
 * Compute the current dynamic status of a Digital ID.
 */
export function computeDigitalIdStatus(
    digitalId: DigitalIdSubdocument
): 'active' | 'expired' | 'revoked' {
    if (digitalId.status === 'revoked') return 'revoked'
    const now = new Date()
    const expiry = new Date(digitalId.expiresAt)
    return expiry < now ? 'expired' : 'active'
}

/**
 * Verify a QR signature offline.
 * Returns true if the sig field matches the HMAC of the payload.
 */
export function verifyQRSignature(payload: TripQRPayload): boolean {
    const { sig, ...rest } = payload
    const expected = generateSignature(JSON.stringify(rest))
    return sig === expected
}
