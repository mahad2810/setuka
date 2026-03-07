import { NextRequest, NextResponse } from 'next/server'

// OSRM API endpoint for multi-route support
export async function POST(req: NextRequest) {
  try {
    const { coords, profile = 'driving', alternatives = true } = await req.json()
    
    if (!Array.isArray(coords) || coords.length < 2) {
      return NextResponse.json({ error: 'Provide at least 2 coordinates' }, { status: 400 })
    }

    // Map profiles to OSRM routing profiles
    const profileMap: Record<string, string> = {
      'driving': 'driving',
      'walking': 'foot',
      'cycling': 'bike',
      'bike': 'bike'
    }
    
    const osrmProfile = profileMap[profile] || 'driving'
    
    // Convert coordinates to OSRM format (lng,lat)
    const coordinates = coords.map((c: any) => `${c.lng},${c.lat}`).join(';')
    
    // Build OSRM API URL
    const baseUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}`
    const params = new URLSearchParams({
      alternatives: alternatives ? 'true' : 'false',
      steps: 'true',
      geometries: 'geojson',
      overview: 'full'
    })
    
    const url = `${baseUrl}/${coordinates}?${params}`
    
    console.log('OSRM API URL:', url)
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error('OSRM API error:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('OSRM API error response:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch directions from OSRM API' },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    if (data.code !== 'Ok') {
      console.error('OSRM API returned error:', data)
      return NextResponse.json(
        { error: data.message || 'OSRM API error' },
        { status: 400 }
      )
    }
    
    // Transform OSRM response to match expected format
    const routes = data.routes.map((route: any, index: number) => {
      // Calculate total distance and duration
      const distance = route.distance // meters
      const duration = route.duration // seconds
      
      // Extract coordinates from route geometry
      const coordinates = route.geometry.coordinates.map((coord: [number, number]) => [coord[0], coord[1]])
      
      // Get turn-by-turn directions from steps
      const steps = route.legs.flatMap((leg: any) => 
        leg.steps.map((step: any) => ({
          instruction: step.maneuver.instruction || generateInstruction(step.maneuver),
          distance: step.distance,
          duration: step.duration,
          coordinates: step.geometry.coordinates
        }))
      )
      
      return {
        routeIndex: index,
        distance: Math.round(distance),
        duration: Math.round(duration),
        coordinates,
        steps,
        summary: route.legs.map((leg: any) => leg.summary || '').join(' -> ') || `Route ${index + 1}`,
        // Additional OSRM specific data
        weight: route.weight,
        confidence: route.confidence || 0.8 // Default confidence for OSRM routes
      }
    })
    
    // If alternatives were requested but not available, try to generate alternative by adjusting coordinates slightly
    if (alternatives && routes.length === 1 && coords.length === 2) {
      try {
        // Create a slight detour route by adding a waypoint
        const start = coords[0]
        const end = coords[coords.length - 1]
        const midLat = (start.lat + end.lat) / 2
        const midLng = (start.lng + end.lng) / 2
        
        // Create waypoint with slight offset
        const waypoint = { 
          lat: midLat + 0.001, 
          lng: midLng + 0.002 
        }
        
        const altCoords = [start, waypoint, end]
        const altCoordinates = altCoords.map(c => `${c.lng},${c.lat}`).join(';')
        const altUrl = `${baseUrl}/${altCoordinates}?${params}`
        
        const altResponse = await fetch(altUrl)
        if (altResponse.ok) {
          const altData = await altResponse.json()
          if (altData.code === 'Ok' && altData.routes.length > 0) {
            const altRoute = altData.routes[0]
            routes.push({
              routeIndex: 1,
              distance: Math.round(altRoute.distance),
              duration: Math.round(altRoute.duration),
              coordinates: altRoute.geometry.coordinates.map((coord: [number, number]) => [coord[0], coord[1]]),
              steps: altRoute.legs.flatMap((leg: any) => 
                leg.steps.map((step: any) => ({
                  instruction: step.maneuver.instruction || generateInstruction(step.maneuver),
                  distance: step.distance,
                  duration: step.duration,
                  coordinates: step.geometry.coordinates
                }))
              ),
              summary: `Alternative Route`,
              weight: altRoute.weight,
              confidence: 0.7 // Lower confidence for generated alternative
            })
          }
        }
      } catch (error) {
        console.log('Could not generate alternative route:', error)
      }
    }
    
    return NextResponse.json({
      routes,
      status: 'success',
      source: 'osrm'
    })
    
  } catch (error) {
    console.error('OSRM API handler error:', error)
    return NextResponse.json(
      { error: 'Internal server error processing directions' },
      { status: 500 }
    )
  }
}

// Helper function to generate basic instructions from OSRM maneuver data
function generateInstruction(maneuver: any): string {
  const type = maneuver.type
  const direction = maneuver.modifier
  
  const typeMap: Record<string, string> = {
    'depart': 'Head',
    'turn': 'Turn',
    'new name': 'Continue onto',
    'continue': 'Continue',
    'arrive': 'Arrive at destination',
    'merge': 'Merge',
    'ramp': 'Take ramp',
    'roundabout': 'Enter roundabout',
    'exit roundabout': 'Exit roundabout',
    'fork': 'Take fork',
    'end of road': 'At end of road'
  }
  
  const directionMap: Record<string, string> = {
    'straight': 'straight',
    'slight right': 'slightly right',
    'right': 'right',
    'sharp right': 'sharply right',
    'slight left': 'slightly left',
    'left': 'left',
    'sharp left': 'sharply left',
    'uturn': 'and make a U-turn'
  }
  
  const action = typeMap[type] || 'Continue'
  const dir = direction ? directionMap[direction] || direction : ''
  
  return `${action}${dir ? ' ' + dir : ''}`
}