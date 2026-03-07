const CACHE_NAME = 'setuka-v1';
const LOCATION_CACHE = 'location-tracking-v1';
const API_BASE_URL = self.location.origin;

// Files to cache for offline functionality
const CACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/SetUva-logo.png',
  '/icon-192.png',
  '/icon-512.png'
];

// Background sync tags
const LOCATION_SYNC_TAG = 'location-sync';
const PERIODIC_LOCATION_TAG = 'periodic-location-sync';

// Location tracking variables
let locationWatchId = null;
let trackingEnabled = false;
let currentSession = null;
let locationQueue = [];

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app shell');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== LOCATION_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(() => {
        // Return offline page for navigation requests
        if (event.request.destination === 'document') {
          return caches.match('/offline.html');
        }
      })
  );
});

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'START_LOCATION_TRACKING':
      startLocationTracking(data);
      break;
    case 'STOP_LOCATION_TRACKING':
      stopLocationTracking();
      break;
    case 'UPDATE_SESSION':
      currentSession = data;
      break;
    case 'GET_TRACKING_STATUS':
      event.ports[0].postMessage({ trackingEnabled });
      break;
  }
});

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === LOCATION_SYNC_TAG) {
    event.waitUntil(syncPendingLocations());
  } else if (event.tag === PERIODIC_LOCATION_TAG) {
    event.waitUntil(performPeriodicLocationUpdate());
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('Periodic background sync triggered:', event.tag);
  
  if (event.tag === 'location-tracking') {
    event.waitUntil(performPeriodicLocationUpdate());
  }
});

// Start location tracking
async function startLocationTracking(sessionData) {
  console.log('Starting location tracking in service worker');
  
  currentSession = sessionData;
  trackingEnabled = true;
  
  // Start periodic location updates
  startPeriodicLocationUpdates();
  
  // Register for periodic background sync if supported
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    try {
      await self.registration.sync.register(PERIODIC_LOCATION_TAG);
    } catch (error) {
      console.log('Background sync not supported:', error);
    }
  }
  
  // Register for periodic background sync
  if ('periodicSync' in self.registration) {
    try {
      await self.registration.periodicSync.register('location-tracking', {
        minInterval: 5 * 60 * 1000, // 5 minutes minimum interval
      });
    } catch (error) {
      console.log('Periodic sync not supported:', error);
    }
  }
}

// Stop location tracking
function stopLocationTracking() {
  console.log('Stopping location tracking in service worker');
  
  trackingEnabled = false;
  
  if (locationWatchId) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }
  
  // Clear any pending syncs
  self.registration.sync.getTags().then(tags => {
    tags.forEach(tag => {
      if (tag.includes('location')) {
        // Note: Can't actually unregister sync tags, they expire naturally
      }
    });
  });
}

// Start periodic location updates
function startPeriodicLocationUpdates() {
  // Use a combination of geolocation API and intervals
  const updateInterval = 30000; // 30 seconds
  
  const performLocationUpdate = () => {
    if (!trackingEnabled || !currentSession) return;
    
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString(),
            sessionId: currentSession.sessionId,
            userId: currentSession.userId
          };
          
          handleLocationUpdate(locationData);
        },
        (error) => {
          console.error('Geolocation error:', error);
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000 // Accept cached position up to 1 minute old
        }
      );
    }
  };
  
  // Initial update
  performLocationUpdate();
  
  // Set up periodic updates
  setInterval(performLocationUpdate, updateInterval);
}

// Handle location update
async function handleLocationUpdate(locationData) {
  console.log('Handling location update:', locationData);
  
  try {
    // Try to send immediately
    const success = await sendLocationToServer(locationData);
    
    if (!success) {
      // Store for later sync
      await storeLocationForSync(locationData);
      
      // Register for background sync
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        await self.registration.sync.register(LOCATION_SYNC_TAG);
      }
    }
  } catch (error) {
    console.error('Error handling location update:', error);
    await storeLocationForSync(locationData);
  }
}

// Send location to server
async function sendLocationToServer(locationData) {
  try {
    if (!currentSession?.token) {
      console.warn('No session token available');
      return false;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.token}`
      },
      body: JSON.stringify({
        coordinates: {
          lat: locationData.lat,
          lng: locationData.lng,
          accuracy: locationData.accuracy
        },
        isEmergency: false,
        trackingSource: 'background'
      })
    });
    
    if (response.ok) {
      console.log('Location sent successfully');
      return true;
    } else {
      console.error('Failed to send location:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Network error sending location:', error);
    return false;
  }
}

// Store location for background sync
async function storeLocationForSync(locationData) {
  try {
    const cache = await caches.open(LOCATION_CACHE);
    const key = `location-${Date.now()}-${Math.random()}`;
    
    await cache.put(key, new Response(JSON.stringify(locationData), {
      headers: { 'Content-Type': 'application/json' }
    }));
    
    console.log('Location stored for sync:', key);
  } catch (error) {
    console.error('Error storing location:', error);
  }
}

// Sync pending locations
async function syncPendingLocations() {
  try {
    const cache = await caches.open(LOCATION_CACHE);
    const keys = await cache.keys();
    
    console.log(`Syncing ${keys.length} pending locations`);
    
    for (const request of keys) {
      try {
        const response = await cache.match(request);
        const locationData = await response.json();
        
        const success = await sendLocationToServer(locationData);
        
        if (success) {
          await cache.delete(request);
          console.log('Synced and removed location:', request.url);
        }
      } catch (error) {
        console.error('Error syncing location:', error);
      }
    }
  } catch (error) {
    console.error('Error in syncPendingLocations:', error);
  }
}

// Perform periodic location update
async function performPeriodicLocationUpdate() {
  if (!trackingEnabled || !currentSession) {
    return;
  }
  
  console.log('Performing periodic location update');
  
  // Get current location and store it
  if ('geolocation' in navigator) {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString(),
            sessionId: currentSession.sessionId,
            userId: currentSession.userId
          };
          
          await handleLocationUpdate(locationData);
          resolve();
        },
        (error) => {
          console.error('Periodic location update error:', error);
          resolve();
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 120000
        }
      );
    });
  }
}

// Handle app coming to foreground
self.addEventListener('focus', () => {
  if (trackingEnabled && currentSession) {
    console.log('App focused, syncing pending locations');
    syncPendingLocations();
  }
});

console.log('Setuka Service Worker loaded with location tracking support');