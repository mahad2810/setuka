import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export const runtime = 'nodejs'

// POST - Refresh user session for extended tracking
export async function POST(request: NextRequest) {
  try {
    const { sessionId, userId } = await request.json()

    if (!sessionId || !userId) {
      return NextResponse.json({ 
        error: 'Missing sessionId or userId' 
      }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('tourist_safety')

    // Verify user exists and session is valid
    const user = await db.collection('users').findOne({
      _id: new ObjectId(userId)
    })

    if (!user) {
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 })
    }

    // Update user's last activity
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          lastActivity: new Date(),
          sessionRefreshedAt: new Date()
        }
      }
    )

    // Log session refresh event
    await db.collection('tracking_logs').insertOne({
      userId: new ObjectId(userId),
      sessionId,
      event: 'session_refreshed',
      timestamp: new Date(),
      metadata: {
        userAgent: request.headers.get('user-agent'),
        backgroundTracking: user.backgroundTracking || false
      }
    })

    return NextResponse.json({ 
      success: true,
      message: 'Session refreshed successfully',
      sessionId,
      refreshedAt: new Date().toISOString(),
      backgroundTracking: user.backgroundTracking || false
    })

  } catch (error) {
    console.error('Error refreshing session:', error)
    return NextResponse.json({ 
      error: 'Failed to refresh session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}