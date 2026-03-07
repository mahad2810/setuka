import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import clientPromise from '@/lib/mongodb'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('Tourist_App')
    const users = db.collection('users')

    // Find user by email
    const user = await users.findOne({ email })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        userId: user._id.toString(), 
        email: user.email,
        name: user.name,
        digitalId: user.digitalId
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
