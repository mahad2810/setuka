import { NextRequest, NextResponse } from 'next/server'

// Google Directions API endpoint for multi-route support
export async function POST(req: NextRequest) {
  try {
    const { coords, profile, alternatives = true } = await req.json()
    
    if (!Array.isArray(coords) || coords.length < 2) {
      return NextResponse.json({ error: 'Provide at least 2 coordinates' }, { status: 400 })
    }

    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!googleApiKey) {
      return NextResponse.json({ error: 'GOOGLE_MAPS_API_KEY is not configured' }, { status: 500 })
    }
    
    // Map travel modes
    const travelModeMap: Record<string, string> = {
      'driving': 'driving',
      'walking': 'walking',
      'cycling': 'bicycling',
      'transit': 'transit'
    }
    
    const travelMode = travelModeMap[profile || 'driving'] || 'driving'
    
    // Convert coordinates to Google format
    const origin = `${coords[0].lat},${coords[0].lng}`
    const destination = `${coords[coords.length - 1].lat},${coords[coords.length - 1].lng}`
    
    // Handle waypoints (intermediate points)
    let waypointsParam = ''
    if (coords.length > 2) {
      const waypoints = coords.slice(1, -1).map((c: any) => `${c.lat},${c.lng}`).join('|')
      waypointsParam = `&waypoints=${waypoints}`
    }
    
    // Build Google Directions API URL
    const baseUrl = 'https://maps.googleapis.com/maps/api/directions/json'
    const params = new URLSearchParams({
      origin,
      destination,
      mode: travelMode,
      alternatives: alternatives.toString(),
      key: googleApiKey
    })
    
    const url = `${baseUrl}?${params}${waypointsParam}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error('Google Directions API error:', response.status, response.statusText)
      console.log('Falling back to OSRM...')
      return osrmFallback(coords, profile)
    }
    
    const data = await response.json()
    
    if (data.status !== 'OK') {
      console.error('Google Directions API status:', data.status, data.error_message)
      
      // Handle specific Google Maps errors
      if (data.status === 'ZERO_RESULTS') {
        return NextResponse.json({ 
          routes: [],
          status: 'ZERO_RESULTS',
          source: 'google',
          message: 'No routes found between the specified locations'
        })
      }

      // Fallback to OSRM for any Google API error (billing, disabled, quota, etc.)
      console.log(`Google Directions API status: ${data.status} ${data.error_message} — falling back to OSRM`)
      return osrmFallback(coords, profile)
    }
    
    // Transform Google routes to Mapbox-compatible format
    const transformedRoutes = data.routes.map((route: any, index: number) => {
      const leg = route.legs[0] // For now, handle single leg routes
      
      // Convert Google's encoded polyline to coordinates
      const coordinates = decodePolyline(route.overview_polyline.points)
      
      return {
        routeIndex: index,
        distance: leg.distance.value, // meters
        duration: leg.duration.value, // seconds
        coordinates: coordinates, // [lng, lat] format for Mapbox
        steps: leg.steps.map((step: any) => ({
          instruction: step.html_instructions?.replace(/<[^>]*>/g, '') || 'Continue', // Strip HTML
          distance: step.distance.value,
          duration: step.duration.value,
          coordinates: decodePolyline(step.polyline.points)
        })),
        summary: route.summary || `Route ${index + 1}`,
        confidence: 0.95 // High confidence for Google routes
      }
    })
    
    return NextResponse.json({
      routes: transformedRoutes,
      status: 'success',
      source: 'google'
    })
    
  } catch (error) {
    console.error('Google Directions API error:', error)
    return NextResponse.json({ error: 'Failed to get directions from Google' }, { status: 500 })
  }
}

// ── OSRM fallback ─────────────────────────────────────────────────────────────
async function osrmFallback(coords: any[], profile: string): Promise<NextResponse> {
  try {
    const profileMap: Record<string, string> = {
      driving: 'driving',
      walking: 'foot',
      cycling: 'bike',
    }
    const osrmProfile = profileMap[profile || 'driving'] || 'driving'
    const waypoints = coords.map((c: any) => `${c.lng},${c.lat}`).join(';')
    const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${waypoints}?alternatives=true&steps=true&geometries=geojson&overview=full`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`OSRM ${res.status}`)
    const data = await res.json()
    if (data.code !== 'Ok') throw new Error(data.message || 'OSRM error')

    const routes = data.routes.map((route: any, index: number) => ({
      routeIndex: index,
      distance: Math.round(route.distance),
      duration: Math.round(route.duration),
      coordinates: route.geometry.coordinates,
      steps: route.legs.flatMap((leg: any) =>
        leg.steps.map((step: any) => ({
          instruction: step.maneuver?.instruction || 'Continue',
          distance: step.distance,
          duration: step.duration,
          coordinates: step.geometry?.coordinates || [],
        }))
      ),
      summary: `Route ${index + 1}`,
      confidence: 0.8,
    }))

    return NextResponse.json({ routes, status: 'success', source: 'osrm_fallback' })
  } catch (err) {
    console.error('OSRM fallback failed:', err)
    return NextResponse.json({ error: 'All routing services unavailable' }, { status: 503 })
  }
}

// ── Decode Google encoded polyline → [[lng, lat], ...] ────────────────────────
function decodePolyline(encoded: string): number[][] {
  const coordinates: number[][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let b: number
    let shift = 0
    let result = 0

    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1
    lat += deltaLat

    shift = 0
    result = 0

    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1
    lng += deltaLng

    coordinates.push([lng / 1e5, lat / 1e5]) // [longitude, latitude] for GeoJSON
  }

  return coordinates
}
