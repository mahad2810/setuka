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

// GET /api/geofence/:id
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = verifyToken(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const client = await clientPromise
    const zone = await client
      .db('Tourist_App')
      .collection('geofences')
      .findOne({ _id: new ObjectId(id), userId })

    if (!zone) return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
    return NextResponse.json({ zone: { ...zone, _id: zone._id.toString() } })
  } catch (err) {
    console.error('GET /api/geofence/[id]:', err)
    return NextResponse.json({ error: 'Failed to fetch zone' }, { status: 500 })
  }
}

// PUT /api/geofence/:id → partial or full update
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = verifyToken(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const update = { ...body, updatedAt: new Date().toISOString() }
    delete update._id

    const client = await clientPromise
    const result = await client
      .db('Tourist_App')
      .collection('geofences')
      .findOneAndUpdate(
        { _id: new ObjectId(id), userId },
        { $set: update },
        { returnDocument: 'after' }
      )

    if (!result) return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
    return NextResponse.json({ zone: { ...result, _id: result._id.toString() } })
  } catch (err) {
    console.error('PUT /api/geofence/[id]:', err)
    return NextResponse.json({ error: 'Failed to update zone' }, { status: 500 })
  }
}

// DELETE /api/geofence/:id → soft-delete (active: false)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = verifyToken(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const client = await clientPromise
    const result = await client
      .db('Tourist_App')
      .collection('geofences')
      .updateOne(
        { _id: new ObjectId(id), userId },
        { $set: { active: false, updatedAt: new Date().toISOString() } }
      )

    if (result.matchedCount === 0) return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/geofence/[id]:', err)
    return NextResponse.json({ error: 'Failed to delete zone' }, { status: 500 })
  }
}
