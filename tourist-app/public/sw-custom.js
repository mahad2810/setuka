// Simple offline fallback
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return

  // Skip Chrome extensions and other non-http requests
  if (!event.request.url.startsWith('http')) return

  event.respondWith(
    fetch(event.request)
      .catch(() => {
        // If network fails, try to serve from cache
        return caches.match(event.request)
          .then(response => {
            if (response) {
              return response
            }
            
            // If not in cache and it's an HTML request, serve offline page
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/offline.html')
            }
          })
      })
  )

  // Cache important assets
  if (event.request.destination === 'image' || 
      event.request.destination === 'script' || 
      event.request.destination === 'style') {
    event.respondWith(
      caches.open('static-assets').then(cache => {
        return cache.match(event.request).then(response => {
          return response || fetch(event.request).then(fetchResponse => {
            cache.put(event.request, fetchResponse.clone())
            return fetchResponse
          })
        })
      })
    )
  }
})

self.addEventListener('install', event => {
  console.log('Service Worker installed')
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  console.log('Service Worker activated')
  event.waitUntil(self.clients.claim())
})
