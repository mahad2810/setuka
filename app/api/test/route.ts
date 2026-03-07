import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('Tourist_App')
    
    // Test the connection
    const result = await db.admin().ping()
    
    // Get collection stats
    const usersCount = await db.collection('users').countDocuments()
    
    return NextResponse.json({
      status: 'success',
      message: 'Database connection successful',
      ping: result,
      collections: {
        users: usersCount
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
