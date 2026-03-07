'use client'

import { useEffect } from 'react'

export default function PWAInstaller() {
  useEffect(() => {
    // Only register service worker in production or when PWA is explicitly enabled
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
          })
          console.log('Service Worker registered successfully:', registration)
          
          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New service worker installed, refresh to update')
                }
              })
            }
          })
        } catch (error) {
          console.log('Service Worker registration failed, but app will continue to work:', error)
        }
      }

      // Wait a bit before registering to not block initial page load
      setTimeout(registerSW, 1000)
    }
  }, [])

  return null
}
