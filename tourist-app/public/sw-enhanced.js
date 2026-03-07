// Enhanced Service Worker with Background Location Tracking
// This combines Workbox functionality with custom background location tracking

// Import Workbox if available
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

// Import background location service
importScripts('/sw-background-location.js');

// Configure Workbox
if (workbox) {
  console.log('Workbox loaded successfully');
  
  // Set up caching strategies
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'document',
    new workbox.strategies.NetworkFirst({
      cacheName: 'documents',
      networkTimeoutSeconds: 3,
    })
  );

  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'script' || request.destination === 'style',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'static-resources',
    })
  );

  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'images',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  // Cache API routes with network first strategy
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'api-cache',
      networkTimeoutSeconds: 5,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 5 * 60, // 5 minutes
        }),
      ],
    })
  );

} else {
  console.log('Workbox not loaded, using fallback caching');
}

// Custom SW version and configuration
const SW_VERSION = '2.1.0';
const CACHE_NAME = `tourist-safety-v${SW_VERSION}`;
const SESSION_STORAGE_KEY = 'tourist_session_v2';

// Background location tracking state
let backgroundLocationWorker = null;
let isTrackingActive = false;
let trackingSession = null;

// Get session data from IndexedDB or localStorage fallback
async function getSessionData() {
  try {
    // Try to get from IndexedDB first (more reliable for SW)
    return new Promise((resolve) => {
      const request = indexedDB.open('tourist-safety-db', 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['sessions'], 'readonly');
        const store = transaction.objectStore('sessions');
        const getRequest = store.get('current-session');
        
        getRequest.onsuccess = () => {
          resolve(getRequest.result?.data || null);
        };
        
        getRequest.onerror = () => {
          resolve(null);
        };
      };
      
      request.onerror = () => {
        resolve(null);
      };
    });
  } catch (error) {
    console.error('Error getting session data:', error);
    return null;
  }
}

// Store session data to IndexedDB
async function storeSessionData(sessionData) {
  try {
    return new Promise((resolve) => {
      const request = indexedDB.open('tourist-safety-db', 1);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['sessions'], 'readwrite');
        const store = transaction.objectStore('sessions');
        
        store.put({
          id: 'current-session',
          data: sessionData,
          timestamp: Date.now()
        });
        
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
      };
    });
  } catch (error) {
    console.error('Error storing session data:', error);
    return false;
  }
}

// Handle background sync
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'location-sync') {
    event.waitUntil(handleLocationSync());
  }
});

// Handle periodic background sync for location tracking
self.addEventListener('periodicsync', (event) => {
  console.log('Periodic sync triggered:', event.tag);
  
  if (event.tag === 'location-tracking') {
    event.waitUntil(handlePeriodicLocationTracking());
  }
});

// Handle location sync
async function handleLocationSync() {
  try {
    const sessionData = await getSessionData();
    
    if (sessionData && sessionData.backgroundTracking && sessionData.isAuthenticated) {
      // Trigger location update
      if ('geolocation' in navigator) {
        const position = await getCurrentPosition();
        
        // Send to server
        await fetch('/api/location/batch-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionData.sessionId,
            userId: sessionData.userId,
            locations: [{
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: Date.now()
            }]
          })
        });
      }
    }
  } catch (error) {
    console.error('Error in location sync:', error);
  }
}

// Handle periodic location tracking
async function handlePeriodicLocationTracking() {
  try {
    const sessionData = await getSessionData();
    
    if (sessionData && sessionData.backgroundTracking && sessionData.isAuthenticated) {
      // Check if tracking should continue
      const sessionExpired = Date.now() > sessionData.expiresAt;
      if (sessionExpired) {
        await stopBackgroundTracking();
        return;
      }

      // Get and send location
      if ('geolocation' in navigator) {
        const position = await getCurrentPosition();
        
        await fetch('/api/location/batch-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionData.sessionId,
            userId: sessionData.userId,
            locations: [{
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              speed: position.coords.speed,
              heading: position.coords.heading,
              timestamp: Date.now()
            }]
          })
        });
        
        console.log('Periodic location update sent');
      }
    }
  } catch (error) {
    console.error('Error in periodic location tracking:', error);
  }
}

// Get current position
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  });
}

// Start background tracking
async function startBackgroundTracking(sessionData) {
  try {
    isTrackingActive = true;
    trackingSession = sessionData;
    
    // Store session for background access
    await storeSessionData(sessionData);
    
    // Register periodic sync if supported
    if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
      try {
        await self.registration.periodicSync.register('location-tracking', {
          minInterval: 30 * 1000 // 30 seconds minimum
        });
        console.log('Periodic background sync registered for location tracking');
      } catch (error) {
        console.log('Periodic background sync not supported:', error);
      }
    }
    
    // Fallback to regular background sync
    await self.registration.sync.register('location-sync');
    
    console.log('Background location tracking started');
    return true;
  } catch (error) {
    console.error('Error starting background tracking:', error);
    return false;
  }
}

// Stop background tracking
async function stopBackgroundTracking() {
  try {
    isTrackingActive = false;
    trackingSession = null;
    
    // Unregister periodic sync
    if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
      try {
        await self.registration.periodicSync.unregister('location-tracking');
      } catch (error) {
        console.log('Error unregistering periodic sync:', error);
      }
    }
    
    console.log('Background location tracking stopped');
    return true;
  } catch (error) {
    console.error('Error stopping background tracking:', error);
    return false;
  }
}

// Handle messages from main thread
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'START_BACKGROUND_TRACKING':
      const started = await startBackgroundTracking(data);
      event.ports[0]?.postMessage({ success: started });
      break;
      
    case 'STOP_BACKGROUND_TRACKING':
      const stopped = await stopBackgroundTracking();
      event.ports[0]?.postMessage({ success: stopped });
      break;
      
    case 'GET_TRACKING_STATUS':
      event.ports[0]?.postMessage({
        isActive: isTrackingActive,
        session: trackingSession?.sessionId || null
      });
      break;
      
    case 'UPDATE_SESSION':
      await storeSessionData(data);
      break;
      
    default:
      console.log('Unknown message type:', type);
  }
});

// Handle install event
self.addEventListener('install', (event) => {
  console.log(`Service worker ${SW_VERSION} installing...`);
  self.skipWaiting();
});

// Handle activate event
self.addEventListener('activate', (event) => {
  console.log(`Service worker ${SW_VERSION} activated`);
  
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );
      
      // Take control of all clients
      await self.clients.claim();
      
      console.log('Service worker cleanup completed');
    })()
  );
});

// Handle fetch events with enhanced caching
self.addEventListener('fetch', (event) => {
  // Skip non-HTTP requests
  if (!event.request.url.startsWith('http')) return;
  
  // Let Workbox handle caching if available
  if (workbox) return;
  
  // Fallback caching strategy
  event.respondWith(
    (async () => {
      try {
        // Try network first
        const networkResponse = await fetch(event.request);
        
        // Cache successful responses
        if (networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (error) {
        // Fall back to cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          const offlineResponse = await caches.match('/offline.html');
          return offlineResponse || new Response('Offline', { status: 503 });
        }
        
        throw error;
      }
    })()
  );
});

console.log(`Tourist Safety Service Worker ${SW_VERSION} loaded with background location tracking`)