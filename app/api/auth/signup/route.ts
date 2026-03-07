import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import clientPromise from '@/lib/mongodb'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password, phone, nationality, passportNumber } = body

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('Tourist_App')
    const users = db.collection('users')

    // Check if user already exists
    const existingUser = await users.findOne({ email })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 409 }
      )
    }

    // Hash password
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)



    // Create user object
    const newUser = {
      name,
      email,
      password: hashedPassword,
      phone: phone || '',
      nationality: nationality || '',
      passportNumber: passportNumber || '',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Insert user into database
    const result = await users.insertOne(newUser)

    if (!result.insertedId) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Create JWT token
    const token = jwt.sign(
      {
        userId: result.insertedId.toString(),
        email: newUser.email,
        name: newUser.name
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = newUser

    return NextResponse.json({
      message: 'User created successfully',
      token,
      user: {
        ...userWithoutPassword,
        _id: result.insertedId
      }
    })

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
