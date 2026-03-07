import { NextRequest, NextResponse } from 'next/server'

// OpenRouteService API endpoint with country avoidance support
export async function POST(req: NextRequest) {
  try {
    const { coords, profile = 'driving', alternatives = true, avoidCountries = [] } = await req.json()
    
    if (!Array.isArray(coords) || coords.length < 2) {
      return NextResponse.json({ error: 'Provide at least 2 coordinates' }, { status: 400 })
    }

    // OpenRouteService API key - you'll need to get this from openrouteservice.org
    const apiKey = process.env.OPENROUTESERVICE_API_KEY || '5b3ce3597851110001cf62489a7b74d44a094020ad3a65399e3f71fc'
    
    // Map profiles to OpenRouteService routing profiles
    const profileMap: Record<string, string> = {
      'driving': 'driving-car',
      'walking': 'foot-walking',
      'cycling': 'cycling-regular',
      'bike': 'cycling-regular'
    }
    
    const orsProfile = profileMap[profile] || 'driving-car'
    
    // Convert coordinates to OpenRouteService format [[lng, lat], [lng, lat]]
    const coordinates = coords.map((c: any) => [c.lng, c.lat])
    
    // Build request body for OpenRouteService
    const requestBody: any = {
      coordinates,
      radiuses: coords.map(() => -1), // -1 means use default radius
      instructions: true,
      geometry: true,
      alternative_routes: alternatives ? {
        target_count: 3,
        weight_factor: 1.4,
        share_factor: 0.6
      } : undefined
    }

    // Add country avoidance - Bangladesh ISO code is 50
    const countriesToAvoid = ['050', ...avoidCountries] // 050 is Bangladesh ISO code
    if (countriesToAvoid.length > 0) {
      requestBody.options = {
        avoid_countries: countriesToAvoid.map(code => parseInt(code))
      }
    }
    
    // Build OpenRouteService API URL
    const baseUrl = `https://api.openrouteservice.org/v2/directions/${orsProfile}`
    
    console.log('OpenRouteService API URL:', baseUrl)
    console.log('Request body:', JSON.stringify(requestBody, null, 2))
    
    try {
      // Add timeout and better error handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout
      
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        console.error('OpenRouteService API error:', response.status, response.statusText)
        const errorText = await response.text()
        console.error('OpenRouteService API error response:', errorText)
        
        // If OpenRouteService fails, fallback to OSRM
        console.log('OpenRouteService failed, falling back to OSRM...')
        return await fallbackToOSRM(coords, profile, alternatives)
      }
      
      const data = await response.json()
      
      if (data.error) {
        console.error('OpenRouteService API returned error:', data.error)
        console.log('Falling back to OSRM...')
        return await fallbackToOSRM(coords, profile, alternatives)
      }

      // Transform OpenRouteService response to match expected format
      const routes = data.routes?.map((route: any, index: number) => {
        // Extract coordinates from route geometry
        const coordinates = route.geometry.coordinates.map((coord: [number, number]) => [coord[0], coord[1]])
        
        // Get turn-by-turn directions from segments
        const steps = route.segments?.flatMap((segment: any) => 
          segment.steps?.map((step: any) => ({
            instruction: step.instruction,
            distance: step.distance,
            duration: step.duration,
            coordinates: step.way_points ? step.way_points.map((wp: number) => coordinates[wp]) : []
          })) || []
        ) || []
        
        return {
          routeIndex: index,
          distance: Math.round(route.summary.distance), // meters
          duration: Math.round(route.summary.duration), // seconds
          coordinates,
          steps,
          summary: route.summary.segments?.map((seg: any) => seg.name || '').join(' -> ') || `Route ${index + 1}`,
          // Additional OpenRouteService specific data
          ascent: route.summary.ascent || 0,
          descent: route.summary.descent || 0,
          confidence: 0.9 // High confidence for OpenRouteService routes
        }
      }) || []

      // If no routes found (possibly due to country restrictions), try OSRM as fallback
      if (routes.length === 0) {
        console.log('No routes found with country restrictions, falling back to OSRM...')
        return await fallbackToOSRM(coords, profile, alternatives)
      }
      
      return NextResponse.json({
        routes,
        status: 'success',
        source: 'openrouteservice',
        avoided_countries: countriesToAvoid,
        message: 'Routes calculated avoiding specified countries'
      })
      
    } catch (error: any) {
      console.error('OpenRouteService fetch error:', error.message)
      
      // If it's a timeout or network error, fallback to OSRM
      if (error.name === 'AbortError' || error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.message.includes('fetch failed')) {
        console.log('OpenRouteService timeout/network error, falling back to OSRM...')
        return await fallbackToOSRM(coords, profile, alternatives)
      }
      
      throw error
    }
    
  } catch (error) {
    console.error('OpenRouteService API handler error:', error)
    return NextResponse.json(
      { error: 'Internal server error processing directions' },
      { status: 500 }
    )
  }
}

// Fallback function to use OSRM when OpenRouteService fails
async function fallbackToOSRM(coords: any[], profile: string, alternatives: boolean) {
  try {
    const osrmProfile = profile === 'driving' ? 'driving' : profile === 'walking' ? 'foot' : 'bike'
    const coordinates = coords.map((c: any) => `${c.lng},${c.lat}`).join(';')
    const baseUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}`
    const params = new URLSearchParams({
      alternatives: alternatives ? 'true' : 'false',
      steps: 'true',
      geometries: 'geojson',
      overview: 'full'
    })
    
    const url = `${baseUrl}/${coordinates}?${params}`
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000) // 8 second timeout
    })
    
    if (!response.ok) {
      throw new Error('OSRM fallback also failed')
    }
    
    const data = await response.json()
    
    if (data.code !== 'Ok') {
      throw new Error(data.message || 'OSRM API error')
    }
    
    const routes = data.routes.map((route: any, index: number) => {
      const coordinates = route.geometry.coordinates.map((coord: [number, number]) => [coord[0], coord[1]])
      const steps = route.legs.flatMap((leg: any) => 
        leg.steps.map((step: any) => ({
          instruction: step.maneuver.instruction || 'Continue',
          distance: step.distance,
          duration: step.duration,
          coordinates: step.geometry.coordinates
        }))
      )
      
      return {
        routeIndex: index,
        distance: Math.round(route.distance),
        duration: Math.round(route.duration),
        coordinates,
        steps,
        summary: `Route ${index + 1} (via OSRM fallback)`,
        weight: route.weight,
        confidence: 0.7 // Lower confidence for fallback
      }
    })
    
    return NextResponse.json({
      routes,
      status: 'success',
      source: 'osrm_fallback',
      message: 'Routes calculated using OSRM fallback (country restrictions not applied)'
    })
    
  } catch (error) {
    console.error('OSRM fallback error:', error)
    return NextResponse.json({
      routes: [],
      status: 'no_route',
      message: 'No routes available. Both OpenRouteService and OSRM failed.',
      source: 'failed'
    })
  }
}