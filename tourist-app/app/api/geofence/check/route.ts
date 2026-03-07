import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import clientPromise from '@/lib/mongodb'

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

/** Haversine formula — returns distance in metres between two lat/lng points. */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * POST /api/geofence/check
 * Body: { lat: number, lng: number }
 * Returns: { insideZones: Array<zone + distanceMeters> }
 */
export async function POST(request: NextRequest) {
  const userId = verifyToken(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { lat, lng } = body

    if (lat == null || lng == null) {
      return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
    }

    const client = await clientPromise
    const zones = await client
      .db('Tourist_App')
      .collection('geofences')
      .find({ userId, active: true })
      .toArray()

    const insideZones = zones
      .map(zone => ({
        _id: zone._id.toString(),
        name: zone.name,
        type: zone.type,
        color: zone.color,
        radiusMeters: zone.radiusMeters,
        distanceMeters: Math.round(haversineDistance(lat, lng, zone.lat, zone.lng)),
      }))
      .filter(z => z.distanceMeters <= z.radiusMeters)

    return NextResponse.json({ insideZones })
  } catch (err) {
    console.error('POST /api/geofence/check:', err)
    return NextResponse.json({ error: 'Failed to check geofences' }, { status: 500 })
  }
}
