import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { computeDigitalIdStatus } from '@/lib/digital-id'

export const runtime = 'nodejs'

function verifyToken(request: NextRequest): string | null {
    const auth = request.headers.get('authorization') || request.headers.get('Authorization')
    const token = auth?.replace('Bearer ', '')
    if (!token) return null
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
        return decoded.userId
    } catch {
        return null
    }
}

// GET /api/trips/:id/digital-id  →  authenticated, returns full card data
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const userId = verifyToken(request)
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const client = await clientPromise
        const db = client.db('Tourist_App')

        // Fetch the trip — scoped to requesting user
        const trip = await db.collection('trips').findOne({
            _id: new ObjectId(id),
            userId,
        })

        if (!trip) {
            return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
        }

        if (!trip.digitalId) {
            return NextResponse.json({ error: 'Digital ID not generated for this trip' }, { status: 404 })
        }

        // Fetch user profile for display fields
        let user: any = { name: 'Tourist' }
        try {
            const userDoc = await db.collection('users').findOne({ _id: new ObjectId(userId) })
            if (userDoc) {
                user = { ...userDoc, _id: userDoc._id.toString(), password: undefined }
            }
        } catch (e) {
            console.warn('Could not fetch user for digital-id:', e)
        }

        // Compute live status (catches expired IDs dynamically)
        const liveStatus = computeDigitalIdStatus(trip.digitalId)

        // Build comprehensive response for the ID card UI
        return NextResponse.json({
            digitalId: {
                ...trip.digitalId,
                status: liveStatus,
            },
            identity: {
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                nationality: trip.travellerInfo?.nationality || user.nationality || '',
                passportNumber: trip.travellerInfo?.passportNumber || user.passportNumber || '',
            },
            trip: {
                _id: trip._id.toString(),
                title: trip.title,
                destination: trip.destination,
                startDate: trip.startDate,
                endDate: trip.endDate,
                status: (() => {
                    const now = new Date()
                    const start = new Date(trip.startDate)
                    const end = new Date(trip.endDate)
                    if (now < start) return 'upcoming'
                    if (now > end) return 'past'
                    return 'active'
                })(),
            },
            emergency: {
                bloodType: trip.medicalInfo?.bloodType || '',
                conditions: trip.medicalInfo?.conditions || '',
                medications: trip.medicalInfo?.medications || '',
                allergies: trip.medicalInfo?.allergies || '',
                doctorName: trip.medicalInfo?.doctorName || '',
                doctorContact: trip.medicalInfo?.doctorContact || '',
                insuranceProvider: trip.medicalInfo?.insuranceProvider || '',
                insuranceNumber: trip.medicalInfo?.insuranceNumber || '',
                emergencyContactName: trip.travellerInfo?.emergencyContactName || '',
                emergencyContactPhone: trip.travellerInfo?.emergencyContactPhone || '',
                emergencyContactRelation: trip.travellerInfo?.emergencyContactRelation || '',
            },
        })
    } catch (err) {
        console.error('GET /api/trips/[id]/digital-id:', err)
        return NextResponse.json({ error: 'Failed to fetch digital ID' }, { status: 500 })
    }
}

// DELETE /api/trips/:id/digital-id  →  revokes the Digital ID
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const userId = verifyToken(request)
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const client = await clientPromise
        const db = client.db('Tourist_App')

        const result = await db.collection('trips').findOneAndUpdate(
            { _id: new ObjectId(id), userId },
            {
                $set: {
                    'digitalId.status': 'revoked',
                    updatedAt: new Date().toISOString(),
                },
            },
            { returnDocument: 'after' }
        )

        if (!result) {
            return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            message: 'Digital ID revoked successfully',
            tid: result.digitalId?.id,
        })
    } catch (err) {
        console.error('DELETE /api/trips/[id]/digital-id:', err)
        return NextResponse.json({ error: 'Failed to revoke digital ID' }, { status: 500 })
    }
}
