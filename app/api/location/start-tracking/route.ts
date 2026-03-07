import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export const runtime = 'nodejs'

// GET - Test endpoint to verify route is accessible
export async function GET(request: NextRequest) {
  console.log('GET /api/location/start-tracking - Test route called')
  return NextResponse.json({ 
    message: 'Start tracking endpoint is accessible',
    timestamp: new Date().toISOString()
  })
}

// POST - Start background location tracking for a session
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/location/start-tracking - Route called')
    
    const body = await request.json()
    const { sessionId, userId, coordinates } = body
    console.log('Received data:', { sessionId, userId, coordinates })

    if (!sessionId || !userId) {
      console.log('Missing sessionId or userId')
      return NextResponse.json({ 
        error: 'Missing sessionId or userId' 
      }, { status: 400 })
    }

    console.log('Connecting to MongoDB...')
    const client = await clientPromise
    const db = client.db('Tourist_App')
    console.log('MongoDB connected successfully')

    // Update user's tracking status
    console.log('Updating user tracking status...')
    const updateData: any = {
      backgroundTracking: true,
      activeTrackingSession: sessionId,
      trackingStartedAt: new Date(),
      lastTrackingActivity: new Date()
    }

    // Add current coordinates if provided
    if (coordinates && coordinates.lat && coordinates.lng) {
      updateData.currentLocation = {
        coordinates: {
          lat: coordinates.lat,
          lng: coordinates.lng,
          accuracy: coordinates.accuracy || null
        },
        timestamp: new Date()
      }
      console.log('Added current location to update:', updateData.currentLocation)
    }

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    )
    console.log('Update result:', result)

    if (result.matchedCount === 0) {
      console.log('User not found')
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 })
    }

    // Log tracking start event with coordinates
    console.log('Logging tracking start event...')
    const eventLog: any = {
      userId: new ObjectId(userId),
      sessionId,
      event: 'tracking_started',
      timestamp: new Date(),
      metadata: {
        userAgent: request.headers.get('user-agent'),
        source: 'api'
      }
    }

    if (coordinates) {
      eventLog.startLocation = coordinates
    }

    await db.collection('tracking_logs').insertOne(eventLog)
    console.log('Event logged successfully')

    // Store initial location if provided
    if (coordinates && coordinates.lat && coordinates.lng) {
      console.log('Storing initial location in user_locations...')
      await db.collection('user_locations').insertOne({
        userId: new ObjectId(userId),
        sessionId,
        coordinates: {
          lat: coordinates.lat,
          lng: coordinates.lng,
          accuracy: coordinates.accuracy || null
        },
        timestamp: new Date(),
        source: 'tracking_start',
        isActive: true
      })
      console.log('Initial location stored in user_locations')
    }

    console.log('Returning success response')
    return NextResponse.json({ 
      success: true,
      message: 'Background tracking started',
      sessionId,
      userId,
      startedAt: new Date().toISOString(),
      initialLocation: coordinates || null
    })

  } catch (error) {
    console.error('Error starting location tracking:', error)
    return NextResponse.json({ 
      error: 'Failed to start tracking',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}