import { NextRequest, NextResponse } from 'next/server'

// Input: { coords: Array<{ lng:number, lat:number }>, profile?: 'driving'|'walking'|'cycling' }
export async function POST(req: NextRequest) {
  try {
    const { coords, profile } = await req.json()
    if (!Array.isArray(coords) || coords.length < 2) {
      return NextResponse.json({ error: 'Provide at least 2 coordinates' }, { status: 400 })
    }
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoibWFoYWQxNjA0IiwiYSI6ImNtY3A2OWlpaTAydXQybHIyYjJvejhqemQifQ.2y3ZmPe5lRXfqns5zlG7hA'
    const prof = profile || 'driving'

    // Build a Directions Matrix: request consecutive pairs to get legs
    const waypoints = coords.map((c: any) => `${c.lng},${c.lat}`).join(';')
    const url = `https://api.mapbox.com/directions/v5/mapbox/${prof}/${waypoints}?alternatives=true&geometries=geojson&overview=full&steps=false&access_token=${mapboxToken}`
    const res = await fetch(url)
    if (!res.ok) {
      return NextResponse.json({ error: 'Directions failed' }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to get directions' }, { status: 500 })
  }
}
