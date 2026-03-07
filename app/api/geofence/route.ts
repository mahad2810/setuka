import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

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

// GET /api/geofence → all active zones for the current user
export async function GET(request: NextRequest) {
  const userId = verifyToken(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const client = await clientPromise
    const zones = await client
      .db('Tourist_App')
      .collection('geofences')
      .find({ userId, active: true })
      .sort({ createdAt: -1 })
      .toArray()

    return NextResponse.json({ zones: zones.map(z => ({ ...z, _id: z._id.toString() })) })
  } catch (err) {
    console.error('GET /api/geofence:', err)
    return NextResponse.json({ error: 'Failed to fetch geofence zones' }, { status: 500 })
  }
}

// POST /api/geofence → create a new zone
export async function POST(request: NextRequest) {
  const userId = verifyToken(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { name, lat, lng, radiusMeters, type, color } = body

    if (!name || lat == null || lng == null || !radiusMeters) {
      return NextResponse.json(
        { error: 'name, lat, lng and radiusMeters are required' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const zone = {
      userId,
      name: String(name).trim(),
      lat: Number(lat),
      lng: Number(lng),
      radiusMeters: Number(radiusMeters),
      type: (type as string) || 'custom',   // 'danger' | 'safe' | 'custom'
      color: (color as string) || '#f59e0b',
      active: true,
      createdAt: now,
      updatedAt: now,
    }

    const client = await clientPromise
    const result = await client.db('Tourist_App').collection('geofences').insertOne(zone)

    return NextResponse.json(
      { zone: { ...zone, _id: result.insertedId.toString() } },
      { status: 201 }
    )
  } catch (err) {
    console.error('POST /api/geofence:', err)
    return NextResponse.json({ error: 'Failed to create geofence zone' }, { status: 500 })
  }
}
