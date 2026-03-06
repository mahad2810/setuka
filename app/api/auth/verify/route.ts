import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      )
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any

    const client = await clientPromise
    const db = client.db('Tourist_App')
    const users = db.collection('users')

    // Find user by ID
    const user = await users.findOne({ _id: new ObjectId(decoded.userId) })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json({
      user: userWithoutPassword,
      valid: true
    })

  } catch (error: any) {
    console.error('Token verification error:', error)
    
    if (error.name === 'TokenExpiredError') {
      return NextResponse.json(
        { error: 'Token expired', code: 'TOKEN_EXPIRED' },
        { status: 401 }
      )
    } else if (error.name === 'JsonWebTokenError') {
      return NextResponse.json(
        { error: 'Invalid token', code: 'INVALID_TOKEN' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: 'Token verification failed' },
      { status: 401 }
    )
  }
}
