import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { generateDigitalId, buildDigitalIdSubdocument } from '@/lib/digital-id'
import { anchorTripWithRetry } from '@/lib/blockchain-service'

export const runtime = 'nodejs'

function verifyToken(request: NextRequest): { userId: string; name?: string; email?: string } | null {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  const token = auth?.replace('Bearer ', '')
  if (!token) return null
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    return { userId: decoded.userId, name: decoded.name, email: decoded.email }
  } catch {
    return null
  }
}

function computeStatus(startDate: string, endDate: string): 'upcoming' | 'active' | 'past' {
  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (now < start) return 'upcoming'
  if (now > end) return 'past'
  return 'active'
}

// GET /api/trips  →  { trips: { active, upcoming, past } }
export async function GET(request: NextRequest) {
  try {
    const tokenData = verifyToken(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const client = await clientPromise
    const db = client.db('Tourist_App')
    const tripsCol = db.collection('trips')

    const rawTrips = await tripsCol
      .find({ userId: tokenData.userId })
      .sort({ createdAt: -1 })
      .toArray()

    // Re-compute live status and serialise _id
    const trips = rawTrips.map(t => ({
      ...t,
      _id: t._id.toString(),
      status: computeStatus(t.startDate, t.endDate),
    }))

    return NextResponse.json({
      trips: {
        active: trips.filter(t => t.status === 'active'),
        upcoming: trips.filter(t => t.status === 'upcoming'),
        past: trips.filter(t => t.status === 'past'),
      }
    })
  } catch (err) {
    console.error('GET /api/trips:', err)
    return NextResponse.json({ error: 'Failed to fetch trips' }, { status: 500 })
  }
}

// POST /api/trips  →  creates a new trip + auto-generates Digital ID
export async function POST(request: NextRequest) {
  try {
    const tokenData = verifyToken(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      title, destination, startDate, endDate, notes,
      travellerInfo, medicalInfo, days, attachments
    } = body

    if (!title || !destination || !startDate || !endDate) {
      return NextResponse.json({ error: 'title, destination, startDate and endDate are required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const trip: any = {
      userId: tokenData.userId,
      title,
      destination,
      startDate,
      endDate,
      status: computeStatus(startDate, endDate),
      notes: notes || '',
      travellerInfo: travellerInfo || {},
      medicalInfo: medicalInfo || {},
      days: days || [],
      attachments: attachments || [],
      createdAt: now,
      updatedAt: now,
    }

    const client = await clientPromise
    const db = client.db('Tourist_App')
    const result = await db.collection('trips').insertOne(trip)
    const tripId = result.insertedId.toString()

    // ─── Generate Digital ID ───────────────────────────────────────────
    // Fetch user profile for name/nationality to embed in QR payload
    let user: any = { _id: tokenData.userId, name: tokenData.name || 'Tourist' }
    try {
      const userDoc = await db.collection('users').findOne({ _id: new ObjectId(tokenData.userId) })
      if (userDoc) {
        user = { ...userDoc, _id: userDoc._id.toString() }
      }
    } catch (e) {
      console.warn('Could not fetch user profile for Digital ID:', e)
    }

    const digitalIdResult = await generateDigitalId(trip, user, tripId)

    // ─── Blockchain Anchor (non-blocking with retry) ───────────────────
    // Fire-and-forget: trip creation NEVER fails due to blockchain issues
    let blockchainResult = { txHash: null as string | null, explorerUrl: null as string | null, success: false }
    try {
      blockchainResult = await anchorTripWithRetry(
        digitalIdResult.tid,
        digitalIdResult.payloadHash,
        user.name || 'Tourist',
        startDate,
        endDate,
        destination
      )
    } catch (e) {
      console.error('Blockchain anchor completely failed (non-blocking):', e)
    }

    // ─── Save Digital ID subdocument to trip ───────────────────────────
    const digitalId = buildDigitalIdSubdocument(digitalIdResult, endDate, blockchainResult)

    await db.collection('trips').updateOne(
      { _id: result.insertedId },
      { $set: { digitalId, updatedAt: new Date().toISOString() } }
    )

    return NextResponse.json({
      trip: {
        ...trip,
        _id: tripId,
        digitalId,
      }
    }, { status: 201 })
  } catch (err) {
    console.error('POST /api/trips:', err)
    return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 })
  }
}
