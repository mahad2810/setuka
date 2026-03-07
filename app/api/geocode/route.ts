import { NextRequest, NextResponse } from 'next/server'

type GeocodeRequest = {
  q: string
}

export async function POST(req: NextRequest) {
  try {
    const { q } = (await req.json()) as GeocodeRequest
    if (!q || typeof q !== 'string') {
      return NextResponse.json({ error: 'Missing `q` query' }, { status: 400 })
    }

    const key = process.env.OPENCAGE_API_KEY || '6c62e89a297a4da6ab74740be026e9e7'
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(q)}&key=${key}&limit=1`
    const res = await fetch(url)
    if (!res.ok) {
      return NextResponse.json({ error: 'Geocoding failed' }, { status: res.status })
    }
    const data = await res.json()
    const result = data?.results?.[0]
    if (!result) {
      return NextResponse.json({ error: 'No results' }, { status: 404 })
    }
    const { lat, lng } = result.geometry || {}
    return NextResponse.json({ lat, lng, formatted: result.formatted })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to geocode' }, { status: 500 })
  }
}
