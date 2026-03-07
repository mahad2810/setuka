import { NextRequest } from 'next/server'

const SCORE_API_URL = process.env.SCORE_API_URL || 'https://safetyscore-regression.onrender.com'

/**
 * GET /api/score?lat=<lat>&lon=<lon>
 * Thin proxy to the SafetyScore regression API so the base URL
 * stays server-side and clients don't need CORS handling.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  if (!lat || !lon) {
    return Response.json({ error: 'lat and lon query parameters are required' }, { status: 400 })
  }

  try {
    const upstream = await fetch(
      `${SCORE_API_URL}/score?lat=${lat}&lon=${lon}`,
      { cache: 'no-store' }
    )
    const data = await upstream.json()
    return Response.json(data, { status: upstream.status })
  } catch (err) {
    console.error('SafetyScore proxy error:', err)
    return Response.json({ error: 'Failed to reach SafetyScore API' }, { status: 502 })
  }
}
