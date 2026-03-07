// Background Location Tracking Service Worker
// This handles continuous location tracking even when the app is closed

const LOCATION_TRACKING_CONFIG = {
  TRACKING_INTERVAL: 30000, // 30 seconds
  HIGH_ACCURACY_TIMEOUT: 10000, // 10 seconds
  BATCH_SIZE: 10, // Send locations in batches
  RETRY_ATTEMPTS: 3,
  STORAGE_KEY: 'pending_locations',
  SESSION_KEY: 'tourist_session_v2'
}

let trackingInterval = null
let currentSession = null
let pendingLocations = []
let isTracking = false

// Get session data from storage
function getSessionData() {
  try {
    const sessionData = self.clients ? 
      self.localStorage?.getItem?.(LOCATION_TRACKING_CONFIG.SESSION_KEY) :
      null
    return sessionData ? JSON.parse(sessionData) : null
  } catch (error) {
    console.error('Error getting session data:', error)
    return null
  }
}

// Store location data temporarily
function storeLocationData(location) {
  try {
    pendingLocations.push({
      ...location,
      timestamp: Date.now(),
      sessionId: currentSession?.sessionId,
      userId: currentSession?.userId
    })

    // Keep only recent locations to prevent memory issues
    if (pendingLocations.length > 100) {
      pendingLocations = pendingLocations.slice(-50)
    }

    // Try to send immediately if we have enough locations
    if (pendingLocations.length >= LOCATION_TRACKING_CONFIG.BATCH_SIZE) {
      sendLocationBatch()
    }
  } catch (error) {
    console.error('Error storing location data:', error)
  }
}

// Send location batch to server
async function sendLocationBatch() {
  if (pendingLocations.length === 0 || !currentSession) return

  const locationsToSend = [...pendingLocations]
  pendingLocations = []

  try {
    const response = await fetch('/api/location/batch-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: currentSession.sessionId,
        userId: currentSession.userId,
        locations: locationsToSend
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    console.log(`Successfully sent ${locationsToSend.length} locations`)
  } catch (error) {
    console.error('Error sending location batch:', error)
    // Put locations back for retry
    pendingLocations = [...locationsToSend, ...pendingLocations]
  }
}

// Get current position with high accuracy
// Note: Service workers don't have access to navigator.geolocation
// Location data should be sent from the main thread via postMessage
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    // Service workers cannot access geolocation directly
    // Instead, we'll request location from the main thread
    reject(new Error('Service worker cannot access geolocation directly. Location should be provided by main thread.'))
  })
}

// Start location tracking
function startLocationTracking(session) {
  if (isTracking) {
    console.log('Location tracking already active')
    return
  }

  currentSession = session
  isTracking = true

  console.log('Background location tracking ready for session:', session.sessionId)
  console.log('Service worker will receive location data from main thread')

  // Send any pending locations every 2 minutes
  setInterval(() => {
    if (pendingLocations.length > 0) {
      sendLocationBatch()
    }
  }, 120000)
}

// Stop location tracking
function stopLocationTracking() {
  console.log('Stopping background location tracking')
  
  if (trackingInterval) {
    clearInterval(trackingInterval)
    trackingInterval = null
  }

  // Send any remaining locations
  if (pendingLocations.length > 0) {
    sendLocationBatch()
  }

  isTracking = false
  currentSession = null
}

// Handle messages from main thread
self.addEventListener('message', async (event) => {
  const { type, sessionId, userId } = event.data

  switch (type) {
    case 'START_LOCATION_TRACKING':
      if (sessionId && userId) {
        const session = { sessionId, userId }
        await startLocationTracking(session)
        
        // Send confirmation back to main thread
        if (event.ports[0]) {
          event.ports[0].postMessage({ type: 'TRACKING_STARTED', sessionId })
        }
      }
      break

    case 'STOP_LOCATION_TRACKING':
      stopLocationTracking()
      
      // Send confirmation back to main thread
      if (event.ports[0]) {
        event.ports[0].postMessage({ type: 'TRACKING_STOPPED', sessionId })
      }
      break

    case 'LOCATION_UPDATE':
      // Receive location data from main thread
      if (isTracking && currentSession && event.data.locationData) {
        const { locationData } = event.data
        console.log('Received location update from main thread:', locationData)
        storeLocationData(locationData)
        
        // Send pending locations if we have enough
        if (pendingLocations.length >= 5) {
          sendLocationBatch()
        }
      }
      break

    case 'GET_TRACKING_STATUS':
      if (event.ports[0]) {
        event.ports[0].postMessage({
          type: 'TRACKING_STATUS',
          isTracking,
          sessionId: currentSession?.sessionId,
          pendingLocations: pendingLocations.length
        })
      }
      break

    default:
      console.log('Unknown message type:', type)
  }
})

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('Background location service worker activated')
  
  // Clean up any old caches or data if needed
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log('Service worker claimed all clients')
    })
  )
})

// Handle background sync for offline location data
self.addEventListener('sync', (event) => {
  if (event.tag === 'location-sync') {
    console.log('Background sync triggered for location data')
    event.waitUntil(sendLocationBatch())
  }
})

// Handle periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'location-tracking') {
    event.waitUntil(
      (async () => {
        // Check if we should still be tracking
        const session = getSessionData()
        if (session && session.backgroundTracking && session.isAuthenticated) {
          if (!isTracking) {
            await startLocationTracking(session)
          }
          
          // Capture current location
          try {
            const location = await getCurrentPosition()
            storeLocationData(location)
            await sendLocationBatch()
          } catch (error) {
            console.error('Error in periodic sync:', error)
          }
        } else {
          stopLocationTracking()
        }
      })()
    )
  }
})

// Handle fetch events (for offline functionality)
self.addEventListener('fetch', (event) => {
  // Only handle API requests
  if (event.request.url.includes('/api/location/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // If fetch fails, queue the request for later
        console.log('API request failed, will retry later')
        return new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      })
    )
  }
})

console.log('Background location tracking service worker loaded')