import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

type SosRequestBody = {
  message?: string
  user?: { name?: string; email?: string }
  location?: { lat: number; lng: number; accuracy?: number }
  contacts?: Array<{ name?: string; phone: string }>
  callPolice?: boolean
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 3
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string) {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 }
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }
  entry.count += 1
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count }
}

function getEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

async function sendSms(to: string, body: string) {
  const accountSid = getEnv('TWILIO_ACCOUNT_SID')
  const authToken = getEnv('TWILIO_AUTH_TOKEN')
  const from = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const params = new URLSearchParams({ To: to, Body: body })
  if (messagingServiceSid) {
    params.append('MessagingServiceSid', messagingServiceSid)
  } else if (from) {
    params.append('From', from)
  } else {
    throw new Error('No TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER/TWILIO_FROM_NUMBER configured')
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Twilio SMS failed (${res.status}): ${text}`)
  }
  return res.json()
}

async function placeCall(to: string, message: string) {
  const accountSid = getEnv('TWILIO_ACCOUNT_SID')
  const authToken = getEnv('TWILIO_AUTH_TOKEN')
  const from = process.env.TWILIO_FROM_NUMBER || getEnv('TWILIO_PHONE_NUMBER')

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`
  const twiml = `<Response><Say voice="Alice">${message}</Say></Response>`
  const params = new URLSearchParams({ From: from, To: to, Twiml: twiml })
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Twilio Call failed (${res.status}): ${text}`)
  }
  return res.json()
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || (request as any).ip || 'unknown'
    const rate = checkRateLimit(ip)
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429, headers: { 'Retry-After': Math.ceil((rate.resetAt! - Date.now()) / 1000).toString() } })
    }

    const body = (await request.json()) as SosRequestBody
    const {
      message = 'Emergency! Please assist immediately.',
      user,
      location,
      // contacts ignored to enforce static destination
      callPolice = true,
    } = body || {}

    // Validate environment presence early; if not configured, return a helpful error
    const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID))
    if (!hasTwilio) {
      return NextResponse.json({ error: 'Twilio not configured on server', missing: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'TWILIO_PHONE_NUMBER', 'TWILIO_MESSAGING_SERVICE_SID'].filter(k => !process.env[k as keyof NodeJS.ProcessEnv]) }, { status: 500 })
    }

    // Compose alert text
    const parts: string[] = []
    parts.push('[Setuka] EMERGENCY ALERT')
    if (user?.name) parts.push(`User: ${user.name}`)
    if (location) parts.push(`Location: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`)
    parts.push(message)
    const smsBody = parts.join(' | ')

    // Destination number: static only
    const destNumber = (process.env.DEST_EMERGENCY_NUMBER || '+918582892588').trim()
    const smsTargets = /^\+\d{7,15}$/.test(destNumber) ? [destNumber] : []

    const smsResults: Array<{ to: string; status: 'sent' | 'failed'; error?: string }> = []
    await Promise.all(smsTargets.map(async (to) => {
      try {
        await sendSms(to, smsBody)
        smsResults.push({ to, status: 'sent' })
      } catch (e: any) {
        smsResults.push({ to, status: 'failed', error: e?.message || 'Unknown error' })
      }
    }))

    // Place a call to police if configured
    let callResult: { to?: string; status: 'skipped' | 'placed' | 'failed'; error?: string } = { status: 'skipped' }
    const policeNumber = (process.env.POLICE_EMERGENCY_NUMBER || process.env.DEST_EMERGENCY_NUMBER || '+918582892588').trim()
    if (callPolice && /^\+\d{7,15}$/.test(policeNumber)) {
      try {
        const callMsg = `Emergency assistance requested${user?.name ? ' for ' + user.name : ''}. ${location ? `Location latitude ${location.lat.toFixed(4)}, longitude ${location.lng.toFixed(4)}.` : ''} Please dispatch help immediately.`
        await placeCall(policeNumber, callMsg)
        callResult = { to: policeNumber, status: 'placed' }
      } catch (e: any) {
        callResult = { to: policeNumber, status: 'failed', error: e?.message || 'Unknown error' }
      }
    }

    return NextResponse.json({ ok: true, sms: smsResults, call: callResult })
  } catch (error: any) {
    console.error('SOS API error:', error)
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}
