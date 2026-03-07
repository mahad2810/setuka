import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export const runtime = 'nodejs'

interface LocationUpdate {
  userId: string
  coordinates: {
    lat: number
    lng: number
    accuracy?: number
  }
  timestamp: Date
  tripDetails?: {
    title?: string
    destination?: string
    startDate?: string
    endDate?: string
    description?: string
    status?: 'planning' | 'active' | 'completed'
  }
  dailyPlan?: {
    date: string
    destinations?: string[]
    activities: Array<{
      id?: string
      title?: string
      time?: string
      location?: string
      type?: "hotel" | "attraction" | "restaurant" | "transport" | "other"
      description?: string
      duration?: string
    }>
    notes?: string
  }
  batteryLevel?: number
  isEmergency?: boolean
}

// POST - Update user location
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, userId, coordinates, batteryLevel, isEmergency } = body
    
    let decodedUserId = userId
    
    // Support both JWT and session-based authentication
    if (!sessionId && !userId) {
      const authHeader = request.headers.get('authorization')
      const token = authHeader?.replace('Bearer ', '')

      if (!token) {
        return NextResponse.json({ error: 'No token or session provided' }, { status: 401 })
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
      decodedUserId = decoded.userId
    } else if (sessionId && userId) {
      // Session-based authentication - verify session exists
      const client = await clientPromise
      const db = client.db('Tourist_App')
      const sessions = db.collection('user_sessions')
      
      const session = await sessions.findOne({
        sessionId,
        userId: new ObjectId(userId),
        expiresAt: { $gt: new Date() }
      })
      
      if (!session) {
        return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
      }
      
      decodedUserId = userId
    } else {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
      return NextResponse.json({ error: 'Valid coordinates required' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('Tourist_App')
    const locations = db.collection('user_locations')
    const trips = db.collection('trips')

    // Automatically retrieve current active trip details
    let tripDetails = null
    let dailyPlan = null

    try {
      const activeTrip = await trips.findOne({
        userId: decodedUserId,
        status: 'active'
      })

      if (activeTrip) {
        tripDetails = {
          title: activeTrip.title,
          destination: activeTrip.destination,
          startDate: activeTrip.startDate,
          endDate: activeTrip.endDate,
          description: activeTrip.description
        }

        // Get today's activities from the trip
        const today = new Date().toISOString().split('T')[0]
        const todaysPlan = activeTrip.days?.find((day: any) => 
          day.date === today || new Date(day.date).toISOString().split('T')[0] === today
        )

        if (todaysPlan) {
          dailyPlan = {
            date: todaysPlan.date,
            destinations: todaysPlan.destinations || [],
            activities: todaysPlan.activities || []
          }
        }
      }
    } catch (error) {
      console.error('Error fetching trip details:', error)
      // Continue without trip details if there's an error
    }

    const locationUpdate: LocationUpdate = {
      userId: decodedUserId,
      coordinates: {
        lat: coordinates.lat,
        lng: coordinates.lng,
        accuracy: coordinates.accuracy
      },
      timestamp: new Date(),
      tripDetails: tripDetails || undefined,
      dailyPlan: dailyPlan || undefined,
      batteryLevel,
      isEmergency
    }

    const currentTime = new Date()
    const timeWindow = 30000 // 30 seconds

    // Use upsert to update existing location within time window or insert new one
    const result = await locations.updateOne(
      {
        userId: decodedUserId,
        ...(sessionId && { sessionId }),
        timestamp: {
          $gte: new Date(currentTime.getTime() - timeWindow),
          $lte: new Date(currentTime.getTime() + timeWindow)
        }
      },
      {
        $set: {
          coordinates: {
            lat: coordinates.lat,
            lng: coordinates.lng,
            accuracy: coordinates.accuracy
          },
          timestamp: currentTime,
          tripDetails: tripDetails || undefined,
          dailyPlan: dailyPlan || undefined,
          batteryLevel,
          isEmergency,
          lastUpdated: new Date(),
          source: sessionId ? 'session-tracking' : 'jwt-tracking'
        },
        $setOnInsert: {
          userId: decodedUserId,
          ...(sessionId && { sessionId }),
          capturedAt: new Date(),
          isActive: true
        }
      },
      { upsert: true }
    )

    // Keep only last 100 location records per user (cleanup old data)
    const userLocations = await locations
      .find({ userId: decodedUserId })
      .sort({ timestamp: -1 })
      .skip(100)
      .toArray()

    if (userLocations.length > 0) {
      const oldIds = userLocations.map(loc => loc._id)
      await locations.deleteMany({ _id: { $in: oldIds } })
    }

    return NextResponse.json({ 
      success: true, 
      locationId: result.upsertedId || result.matchedCount,
      matched: result.matchedCount,
      modified: result.modifiedCount,
      timestamp: locationUpdate.timestamp
    })

  } catch (error) {
    console.error('Location update error:', error)
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 })
  }
}

// GET - Retrieve user locations (for family tracking)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const shareToken = searchParams.get('shareToken')
    const limit = parseInt(searchParams.get('limit') || '10')

    let targetUserId = userId

    // If shareToken provided, decode it to get userId
    if (shareToken && !userId) {
      try {
        const decoded = jwt.verify(shareToken, process.env.JWT_SECRET!) as any
        targetUserId = decoded.userId
      } catch {
        return NextResponse.json({ error: 'Invalid share token' }, { status: 401 })
      }
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID or share token required' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db('Tourist_App')
    const locations = db.collection('user_locations')
    const users = db.collection('users')
    const trips = db.collection('trips')

    // Get user basic info
    const user = await users.findOne({ _id: new ObjectId(targetUserId) }, { 
      projection: { name: 1, digitalId: 1, _id: 1 } 
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get recent locations
    const recentLocations = await locations
      .find({ userId: targetUserId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()

    // Get latest location
    const latestLocation = recentLocations[0] || null

    // Fetch current active trip details directly from trips collection
    let tripDetails = null
    let dailyPlan = null

    try {
      const activeTrip = await trips.findOne({
        userId: new ObjectId(targetUserId),
        status: 'active'
      })

      if (activeTrip) {
        tripDetails = {
          title: activeTrip.title,
          destination: activeTrip.destination,
          startDate: activeTrip.startDate,
          endDate: activeTrip.endDate,
          description: activeTrip.description,
          status: activeTrip.status
        }

        // Get today's activities from the trip
        const today = new Date().toISOString().split('T')[0]
        const todaysPlan = activeTrip.days?.find((day: any) => 
          day.date === today || new Date(day.date).toISOString().split('T')[0] === today
        )

        if (todaysPlan) {
          dailyPlan = {
            date: todaysPlan.date,
            destinations: todaysPlan.destinations || [],
            activities: todaysPlan.activities || [],
            notes: todaysPlan.notes || ''
          }
        }
      }
    } catch (error) {
      console.error('Error fetching trip details for family tracking:', error)
      // Continue without trip details if there's an error
    }

    return NextResponse.json({
      user: {
        name: user.name,
        digitalId: user.digitalId,
        id: user._id
      },
      currentLocation: latestLocation ? {
        coordinates: latestLocation.coordinates,
        timestamp: latestLocation.timestamp,
        batteryLevel: latestLocation.batteryLevel,
        isEmergency: latestLocation.isEmergency
      } : null,
      tripDetails: tripDetails,
      dailyPlan: dailyPlan,
      locationHistory: recentLocations.slice(1).map(loc => ({
        coordinates: loc.coordinates,
        timestamp: loc.timestamp,
        isEmergency: loc.isEmergency
      }))
    })

  } catch (error) {
    console.error('Location retrieval error:', error)
    return NextResponse.json({ error: 'Failed to retrieve locations' }, { status: 500 })
  }
}