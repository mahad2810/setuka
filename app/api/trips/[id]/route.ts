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

// GET /api/trips/:id
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const userId = verifyToken(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const client = await clientPromise
    const db = client.db('Tourist_App')
    const trip = await db.collection('trips').findOne({
      _id: new ObjectId(id),
      userId,
    })

    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    return NextResponse.json({ trip: { ...trip, _id: trip._id.toString() } })
  } catch (err) {
    console.error('GET /api/trips/[id]:', err)
    return NextResponse.json({ error: 'Failed to fetch trip' }, { status: 500 })
  }
}

// PUT /api/trips/:id  →  full or partial update
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const userId = verifyToken(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const update = { ...body, updatedAt: new Date().toISOString() }
    delete update._id // never overwrite _id

    const client = await clientPromise
    const db = client.db('Tourist_App')
    const result = await db.collection('trips').findOneAndUpdate(
      { _id: new ObjectId(id), userId },
      { $set: update },
      { returnDocument: 'after' }
    )

    if (!result) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    return NextResponse.json({ trip: { ...result, _id: result._id.toString() } })
  } catch (err) {
    console.error('PUT /api/trips/[id]:', err)
    return NextResponse.json({ error: 'Failed to update trip' }, { status: 500 })
  }
}

// DELETE /api/trips/:id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const userId = verifyToken(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const client = await clientPromise
    const db = client.db('Tourist_App')
    const result = await db.collection('trips').deleteOne({
      _id: new ObjectId(id),
      userId,
    })

    if (result.deletedCount === 0) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/trips/[id]:', err)
    return NextResponse.json({ error: 'Failed to delete trip' }, { status: 500 })
  }
}
