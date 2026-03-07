'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSession } from '@/lib/session-context'
import { useLocation } from '@/lib/location-context'
import { 
  MapPin, 
  Smartphone, 
  Shield, 
  Battery, 
  Clock, 
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

interface TrackingStats {
  totalLocations: number
  lastUpdate: string | null
  accuracy: number | null
  batteryOptimized: boolean
  dataUsage: string
}

export default function BackgroundTrackingManager() {
  const { session, enableBackgroundTracking, disableBackgroundTracking } = useSession()
  const { 
    locationState, 
    startLocationTracking, 
    stopLocationTracking,
    getCurrentPosition,
    requestLocationPermission 
  } = useLocation()

  const [isOnline, setIsOnline] = useState(true)
  const [trackingStats, setTrackingStats] = useState<TrackingStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown')

  // Check online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Check location permission status
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' })
        .then(permission => {
          setPermissionStatus(permission.state)
          permission.onchange = () => setPermissionStatus(permission.state)
        })
        .catch(() => setPermissionStatus('unknown'))
    }
  }, [])

  // Load tracking statistics
  useEffect(() => {
    if (session && locationState.isTracking) {
      loadTrackingStats()
      const interval = setInterval(loadTrackingStats, 30000) // Update every 30 seconds
      return () => clearInterval(interval)
    }
  }, [session, locationState.isTracking])

  // Continuous location tracking interval
  useEffect(() => {
    if (locationState.isTracking && session) {
      const locationBuffer: Array<{
        latitude: number
        longitude: number
        accuracy: number
        timestamp: number
      }> = []

      const locationInterval = setInterval(async () => {
        try {
          const coords = await getCurrentPosition()
          
          const locationData = {
            latitude: coords.lat,
            longitude: coords.lng,
            accuracy: locationState.accuracy || 0,
            timestamp: Date.now()
          }

          // Add to buffer
          locationBuffer.push(locationData)

          // Send location to service worker for background processing
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'LOCATION_UPDATE',
              sessionId: session.sessionId,
              userId: session.userId,
              locationData: locationData
            })
          }

          // Batch update to server every 3 locations or when buffer gets full
          if (locationBuffer.length >= 3) {
            const response = await fetch('/api/location/batch-update', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                sessionId: session.sessionId,
                userId: session.userId,
                locations: [...locationBuffer]
              })
            })

            if (response.ok) {
              locationBuffer.length = 0 // Clear buffer after successful batch
            } else {
              console.warn('Failed to batch update locations to server')
            }
          }

        } catch (error) {
          console.error('Error in location tracking interval:', error)
        }
      }, 30000) // Update location every 30 seconds

      // Also set up a fallback batch update every 2 minutes
      const batchInterval = setInterval(async () => {
        if (locationBuffer.length > 0) {
          try {
            const response = await fetch('/api/location/batch-update', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                sessionId: session.sessionId,
                userId: session.userId,
                locations: [...locationBuffer]
              })
            })

            if (response.ok) {
              locationBuffer.length = 0 // Clear buffer after successful batch
            }
          } catch (error) {
            console.error('Error in batch location update:', error)
          }
        }
      }, 120000) // Batch update every 2 minutes

      return () => {
        clearInterval(locationInterval)
        clearInterval(batchInterval)
        
        // Send any remaining locations in buffer before cleanup
        if (locationBuffer.length > 0) {
          fetch('/api/location/batch-update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sessionId: session.sessionId,
              userId: session.userId,
              locations: [...locationBuffer]
            })
          }).catch(error => console.error('Error sending final batch:', error))
        }
      }
    }
  }, [locationState.isTracking, session, getCurrentPosition, locationState.accuracy])

  const loadTrackingStats = async () => {
    if (!session) return

    try {
      const response = await fetch(`/api/location/batch-update?sessionId=${session.sessionId}&userId=${session.userId}&limit=1`)
      if (response.ok) {
        const data = await response.json()
        setTrackingStats({
          totalLocations: data.stats?.totalLocations || 0,
          lastUpdate: data.stats?.lastLocation || null,
          accuracy: data.stats?.avgAccuracy || null,
          batteryOptimized: true,
          dataUsage: '~2MB/day'
        })
      }
    } catch (error) {
      console.error('Error loading tracking stats:', error)
    }
  }

  const handleToggleTracking = async () => {
    if (!session) return

    setIsLoading(true)
    setError(null)

    try {
      if (locationState.isTracking) {
        await stopLocationTracking()
      } else {
        // Request permission first
        const hasPermission = await requestLocationPermission()
        if (!hasPermission) {
          throw new Error('Location permission is required for background tracking')
        }

        await startLocationTracking()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle tracking')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestLocation = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const coords = await getCurrentPosition()
      setError(null)
      // Show success message or update UI
      console.log('Location test successful:', coords)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get location')
    } finally {
      setIsLoading(false)
    }
  }

  const getTrackingStatusColor = () => {
    if (locationState.trackingError) return 'destructive'
    if (locationState.isTracking) return 'default'
    return 'secondary'
  }

  const getTrackingStatusText = () => {
    if (locationState.trackingError) return 'Error'
    if (locationState.isTracking && locationState.backgroundTracking) return 'Active (Background)'
    if (locationState.isTracking) return 'Active'
    return 'Inactive'
  }

  const isPWAInstalled = session?.installationState === 'installed'
  const canUseBackgroundTracking = isPWAInstalled && permissionStatus === 'granted'

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <CardTitle>Background Location Tracking</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={getTrackingStatusColor()}>
              {getTrackingStatusText()}
            </Badge>
            {!isOnline && <WifiOff className="h-4 w-4 text-muted-foreground" />}
            {isOnline && <Wifi className="h-4 w-4 text-green-500" />}
          </div>
        </div>
        <CardDescription>
          Continuous location monitoring for enhanced safety and emergency response
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* PWA Installation Status */}
        {!isPWAInstalled && (
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertDescription>
              Install this app on your device for full background tracking capabilities.
              Background tracking works best when the app is installed as a PWA.
            </AlertDescription>
          </Alert>
        )}

        {/* Permission Status */}
        {permissionStatus !== 'granted' && (
          <Alert variant={permissionStatus === 'denied' ? 'destructive' : 'default'}>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              {permissionStatus === 'denied' 
                ? 'Location permission denied. Please enable location access in your browser settings.'
                : 'Location permission required for background tracking.'
              }
            </AlertDescription>
          </Alert>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Tracking Control */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              locationState.isTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
            }`} />
            <div>
              <p className="font-medium">Live Location Tracking</p>
              <p className="text-sm text-muted-foreground">
                {canUseBackgroundTracking 
                  ? 'Tracks your location even when the app is closed'
                  : 'Tracks your location while the app is active'
                }
              </p>
            </div>
          </div>
          <Switch
            checked={locationState.isTracking}
            onCheckedChange={handleToggleTracking}
            disabled={isLoading || !session || permissionStatus === 'denied'}
          />
        </div>

        {/* Tracking Statistics */}
        {trackingStats && locationState.isTracking && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 border rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">
                {trackingStats.totalLocations}
              </div>
              <div className="text-xs text-muted-foreground">Total Points</div>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">
                {trackingStats.accuracy ? `${Math.round(trackingStats.accuracy)}m` : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Avg Accuracy</div>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-600">
                <Battery className="h-5 w-5 inline" />
              </div>
              <div className="text-xs text-muted-foreground">Optimized</div>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600">
                {trackingStats.dataUsage}
              </div>
              <div className="text-xs text-muted-foreground">Data Usage</div>
            </div>
          </div>
        )}

        {/* Last Update */}
        {locationState.lastUpdate && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Last update: {locationState.lastUpdate.toLocaleTimeString()}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button
            onClick={handleTestLocation}
            variant="outline"
            size="sm"
            disabled={isLoading || permissionStatus === 'denied'}
            className="flex-1"
          >
            {isLoading ? 'Testing...' : 'Test Location'}
          </Button>
          {locationState.isTracking && (
            <Button
              onClick={loadTrackingStats}
              variant="outline"
              size="sm"
              disabled={isLoading}
              className="flex-1"
            >
              Refresh Stats
            </Button>
          )}
        </div>

        {/* Features List */}
        <div className="space-y-2 text-sm">
          <h4 className="font-medium">Features:</h4>
          <div className="grid grid-cols-1 gap-1 text-muted-foreground">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>Real-time location updates</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>Offline location storage</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>Battery optimized tracking</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className={`h-3 w-3 ${canUseBackgroundTracking ? 'text-green-500' : 'text-gray-400'}`} />
              <span>Background tracking {!canUseBackgroundTracking && '(requires PWA)'}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}