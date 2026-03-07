import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export const runtime = 'nodejs'

// POST - Stop background location tracking for a session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, userId, coordinates } = body

    if (!sessionId || !userId) {
      return NextResponse.json({ 
        error: 'Missing sessionId or userId' 
      }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('Tourist_App')

    // Update user's tracking status
    const updateData: any = {
      backgroundTracking: false,
      trackingStoppedAt: new Date(),
      lastTrackingActivity: new Date(),
      activeTrackingSession: null
    }

    // Add final coordinates if provided
    if (coordinates && coordinates.lat && coordinates.lng) {
      updateData.lastLocation = {
        coordinates: {
          lat: coordinates.lat,
          lng: coordinates.lng,
          accuracy: coordinates.accuracy || null
        },
        timestamp: new Date()
      }
    }

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 })
    }

    // Log tracking stop event
    const eventLog: any = {
      userId: new ObjectId(userId),
      sessionId,
      event: 'tracking_stopped',
      timestamp: new Date(),
      metadata: {
        userAgent: request.headers.get('user-agent'),
        source: 'api'
      }
    }

    if (coordinates) {
      eventLog.stopLocation = coordinates
    }

    await db.collection('tracking_logs').insertOne(eventLog)

    // Store final location if provided
    if (coordinates && coordinates.lat && coordinates.lng) {
      await db.collection('user_locations').insertOne({
        userId: new ObjectId(userId),
        sessionId,
        coordinates: {
          lat: coordinates.lat,
          lng: coordinates.lng,
          accuracy: coordinates.accuracy || null
        },
        timestamp: new Date(),
        source: 'tracking_stop',
        isActive: false
      })
    }

    // Get tracking statistics for this session
    const locationStats = await db.collection('user_locations').aggregate([
      { $match: { 
          userId: new ObjectId(userId),
          sessionId: sessionId 
        } 
      },
      { 
        $group: { 
          _id: null, 
          totalPoints: { $sum: 1 },
          firstLocation: { $first: '$coordinates' },
          lastLocation: { $last: '$coordinates' },
          startTime: { $min: '$timestamp' },
          endTime: { $max: '$timestamp' }
        } 
      }
    ]).toArray()

    return NextResponse.json({ 
      success: true,
      message: 'Background tracking stopped',
      sessionId,
      userId,
      stoppedAt: new Date().toISOString(),
      finalLocation: coordinates || null,
      stats: locationStats.length > 0 ? locationStats[0] : null
    })

  } catch (error) {
    console.error('Error stopping location tracking:', error)
    return NextResponse.json({ 
      error: 'Failed to stop tracking',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}