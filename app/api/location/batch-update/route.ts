import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export const runtime = 'nodejs'

interface LocationData {
  latitude: number
  longitude: number
  accuracy?: number
  altitude?: number
  altitudeAccuracy?: number
  heading?: number
  speed?: number
  timestamp: number
}

// POST - Batch update locations from background tracking
export async function POST(request: NextRequest) {
  try {
    const { sessionId, userId, locations } = await request.json()

    if (!sessionId || !userId || !Array.isArray(locations)) {
      return NextResponse.json({ 
        error: 'Missing required fields: sessionId, userId, locations' 
      }, { status: 400 })
    }

    if (locations.length === 0) {
      return NextResponse.json({ message: 'No locations to process' })
    }

    const client = await clientPromise
    const db = client.db('Tourist_App')
    const locationsCollection = db.collection('user_locations')

    // Prepare bulk operations for upsert (update if exists, insert if not)
    const bulkOps = locations.map(location => {
      const timestamp = new Date(location.timestamp || Date.now())
      return {
        updateOne: {
          filter: {
            userId: new ObjectId(userId),
            sessionId,
            timestamp: {
              $gte: new Date(timestamp.getTime() - 30000), // 30 second window
              $lte: new Date(timestamp.getTime() + 30000)
            }
          },
          update: {
            $set: {
              coordinates: {
                lat: location.latitude,
                lng: location.longitude,
                accuracy: location.accuracy
              },
              altitude: location.altitude,
              altitudeAccuracy: location.altitudeAccuracy,
              heading: location.heading,
              speed: location.speed,
              timestamp: timestamp,
              lastUpdated: new Date(),
              source: 'background-tracking',
              batteryOptimized: true,
              isActive: true
            },
            $setOnInsert: {
              userId: new ObjectId(userId),
              sessionId,
              capturedAt: new Date()
            }
          },
          upsert: true
        }
      }
    })

    // Execute bulk operations (append/update existing data)
    const result = await locationsCollection.bulkWrite(bulkOps)

    // Update user's last known location
    const latestLocation = locations[locations.length - 1]
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          lastKnownLocation: {
            lat: latestLocation.latitude,
            lng: latestLocation.longitude,
            accuracy: latestLocation.accuracy,
            timestamp: new Date(latestLocation.timestamp || Date.now())
          },
          lastLocationUpdate: new Date(),
          activeSession: sessionId
        }
      }
    )

    // Clean up old location data (keep only last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    await locationsCollection.deleteMany({
      userId: new ObjectId(userId),
      timestamp: { $lt: sevenDaysAgo }
    })

    return NextResponse.json({ 
      success: true, 
      inserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
      matched: result.matchedCount || 0,
      total: locations.length,
      message: `Successfully processed ${locations.length} locations (${result.upsertedCount || 0} new, ${result.modifiedCount || 0} updated)`
    })

  } catch (error) {
    console.error('Error in batch location update:', error)
    return NextResponse.json({ 
      error: 'Failed to update locations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET - Retrieve user's location history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '100')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!userId) {
      return NextResponse.json({ 
        error: 'Missing userId' 
      }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('Tourist_App')
    const locationsCollection = db.collection('user_locations')

    // Build query
    const query: any = {
      userId: new ObjectId(userId)
    }

    if (sessionId) {
      query.sessionId = sessionId
    }

    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) query.timestamp.$gte = new Date(startDate)
      if (endDate) query.timestamp.$lte = new Date(endDate)
    }

    // Fetch locations
    const locations = await locationsCollection
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()

    // Get summary statistics
    const stats = await locationsCollection.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalLocations: { $sum: 1 },
          firstLocation: { $min: '$timestamp' },
          lastLocation: { $max: '$timestamp' },
          avgAccuracy: { $avg: '$coordinates.accuracy' }
        }
      }
    ]).toArray()

    return NextResponse.json({
      success: true,
      locations,
      stats: stats[0] || { totalLocations: 0 },
      count: locations.length,
      userId
    })

  } catch (error) {
    console.error('Error fetching location history:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch locations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}