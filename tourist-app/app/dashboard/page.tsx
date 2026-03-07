"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import 'mapbox-gl/dist/mapbox-gl.css'
import mapboxgl, { Map as MapboxMap, Marker } from 'mapbox-gl'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { Shield, Bell, User, Settings, TrendingUp, MapPin, Heart, Star, Menu, LogOut, AlertTriangle, Car, Siren, Info, CheckCircle2 } from "lucide-react"
import { QuickActions } from "@/components/quick-actions"
import { EmergencySOS } from "@/components/emergency-sos"
import { EmergencyContacts } from "@/components/emergency-contacts"
import { ProfileScreen } from "@/components/profile-screen"
import { NotificationsScreen } from "@/components/notifications-screen"
import { LiveAlertPopup } from "@/components/live-alert-popup"
import { MobileNav, type DashboardTab } from "@/components/mobile-nav"
import { InteractiveMap } from "@/components/interactive-map"
import OfflineIndicator from "@/components/offline-indicator"
import { GeofenceManager } from "@/components/geofence-manager"
import { useGeofence, type GeofenceEvent } from "@/hooks/use-geofence"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/session-context"
import { LocationProvider, useLocation } from "@/lib/location-context"

type UserType = {
  name: string
  email: string
  phone?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip markdown bold/italic markers so raw API text renders cleanly. */
function stripMd(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold**
    .replace(/\*([^*]+)\*/g,   '$1')    // *italic*
    .replace(/__([^_]+)__/g,   '$1')    // __bold__
    .replace(/_([^_]+)_/g,     '$1')    // _italic_
    .trim()
}

function metricColor(val: number, invert = false) {
  const good = invert ? val >= 7 : val <= 3
  const med  = invert ? val >= 4 : val <= 6
  return {
    card:  good ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : med ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    icon:  good ? 'text-green-600 dark:text-green-400'
                : med ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400',
    title: good ? 'text-green-800 dark:text-green-200'
                : med ? 'text-amber-800 dark:text-amber-200'
                      : 'text-red-800 dark:text-red-200',
    sub:   good ? 'text-green-600/70 dark:text-green-400/70'
                : med ? 'text-amber-600/70 dark:text-amber-400/70'
                      : 'text-red-600/70 dark:text-red-400/70',
    bar:   good ? 'bg-green-500' : med ? 'bg-amber-500' : 'bg-red-500',
  }
}

interface SafetyAnalysisCardProps {
  safetyData: {
    score: number
    crime: number | null
    accident: number | null
    road: number | null
    label?: string
    nearestPlace?: string
    confidence?: string
    region?: string
    outsideCoverage?: boolean
    analysis: string
    riskLevel: 'low' | 'medium' | 'high'
    recommendations: string[]
  } | null
  isCalculating?: boolean
}

function SafetyAnalysisCard({ safetyData, isCalculating }: SafetyAnalysisCardProps) {
  if (!safetyData) {
    return (
      <Card className="card-elevated p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Safety Analysis
        </h3>
        <div className="text-center py-6 text-muted-foreground text-sm space-y-2">
          {isCalculating ? (
            <>
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Calculating safety for your location…</p>
            </>
          ) : (
            <>
              <Shield className="w-8 h-8 mx-auto text-muted-foreground/50" />
              <p>No safety data yet.</p>
            </>
          )}
        </div>
      </Card>
    )
  }

  const score  = safetyData.score
  const isGood = score >= 70
  const isMed  = score >= 40

  const scoreColor = {
    card:  isGood ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : isMed ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
                           : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    title: isGood ? 'text-green-800 dark:text-green-200'
                  : isMed ? 'text-amber-800 dark:text-amber-200'
                           : 'text-red-800 dark:text-red-200',
    badge: isGood ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300'
                  : isMed ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300'
                           : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300',
    bar:   isGood ? 'bg-green-500' : isMed ? 'bg-amber-500' : 'bg-red-500',
  }

  const metrics: { key: 'crime' | 'accident' | 'road'; label: string; invert: boolean; icon: React.ReactNode }[] = [
    { key: 'crime',    label: 'Crime',    invert: false, icon: <AlertTriangle className="w-4 h-4 mx-auto mb-1" /> },
    { key: 'accident', label: 'Accident', invert: false, icon: <Siren         className="w-4 h-4 mx-auto mb-1" /> },
    { key: 'road',     label: 'Road',     invert: true,  icon: <Car            className="w-4 h-4 mx-auto mb-1" /> },
  ]

  return (
    <Card className="card-elevated p-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        Safety Analysis
        {isCalculating && (
          <span className="ml-auto text-xs text-muted-foreground animate-pulse">Updating…</span>
        )}
      </h3>

      <div className="space-y-3">
        {/* Outside coverage notice */}
        {safetyData.outsideCoverage && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-xs">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Outside covered regions (Kolkata / Darjeeling). Scores are estimated defaults.</span>
          </div>
        )}

        {/* Overall score */}
        <div className={`p-3 rounded-lg border ${scoreColor.card}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-sm font-semibold ${scoreColor.title}`}>
              {safetyData.label ?? (isGood ? 'Safe' : isMed ? 'Moderate' : 'High Risk')}
            </span>
            <Badge className={scoreColor.badge}>{Math.round(score)} / 100</Badge>
          </div>
          <div className="w-full bg-muted/50 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${scoreColor.bar}`}
              style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
            />
          </div>
          {safetyData.nearestPlace && (
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              Near {safetyData.nearestPlace}
              {safetyData.region      ? ` · ${safetyData.region}` : ''}
              {safetyData.confidence  ? ` · ${safetyData.confidence} confidence` : ''}
            </p>
          )}
        </div>

        {/* Crime / Accident / Road grid */}
        <div className="grid grid-cols-3 gap-2">
          {metrics.map(({ key, label, invert, icon }) => {
            const val = safetyData[key]
            if (val === null || val === undefined) {
              return (
                <div key={key} className="p-2 rounded-lg bg-muted/30 border border-muted text-center">
                  <div className="text-muted-foreground">{icon}</div>
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">N/A</p>
                </div>
              )
            }
            const c   = metricColor(val, invert)
            const pct = invert
              ? Math.round((val / 10) * 100)
              : Math.round((val / 10) * 100)
            return (
              <div key={key} className={`p-2 rounded-lg border text-center ${c.card}`}>
                <div className={c.icon}>{icon}</div>
                <p className={`text-xs font-semibold ${c.title}`}>{label}</p>
                <p className={`text-xs ${c.sub}`}>{val.toFixed(1)} / 10</p>
                <div className="w-full bg-muted/40 rounded-full h-1 mt-1">
                  <div className={`h-1 rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* AI Analysis */}
        {safetyData.analysis && (
          <div className="p-3 rounded-lg bg-muted/30 border border-muted/60 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Analysis</p>
            <p className="text-xs leading-relaxed">{stripMd(safetyData.analysis)}</p>
          </div>
        )}

        {/* Recommendations */}
        {safetyData.recommendations?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recommendations</p>
            {safetyData.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{stripMd(rec)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

function DashboardContent() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useSession()
  const { currentLocation, safetyData, setSafetyData, setIsCalculatingSafety, isCalculatingSafety } = useLocation()
  const mapRef = useRef<MapboxMap | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const userMarkerRef = useRef<Marker | null>(null)
  const [currentScreen, setCurrentScreen] = useState<
    "dashboard" | "emergency" | "contacts" | "profile" | "notifications"
  >("dashboard")
  const [currentAlert, setCurrentAlert] = useState<any>(null)
  const [unreadNotifications, setUnreadNotifications] = useState(3)
  const [tab, setTab] = useState<DashboardTab>("overview")

  // ── Geofencing ───────────────────────────────────────────────────────────
  const handleGeofenceEvent = useCallback((event: GeofenceEvent) => {
    const { zone, eventType } = event
    const isEnter = eventType === 'entered'
    setCurrentAlert({
      id: `geofence-${zone._id}-${Date.now()}`,
      type: isEnter
        ? zone.type === 'danger' ? 'danger-zone' : 'safe-zone'
        : 'route-change',
      title: isEnter
        ? zone.type === 'danger' ? `⚠️ Entering ${zone.name}` : `✅ Entering ${zone.name}`
        : `📍 Leaving ${zone.name}`,
      message: isEnter
        ? zone.type === 'danger'
          ? `You have entered a danger zone: ${zone.name}. Stay alert and consider moving to a safer area.`
          : zone.type === 'safe'
          ? `You are now inside a safe zone: ${zone.name}. You can relax — this area is monitored.`
          : `You have entered the zone: ${zone.name}.`
        : `You have left: ${zone.name}.`,
      location: zone.name,
      actionButtons: zone.type === 'danger' && isEnter
        ? [
            { label: 'Get Safe Route', action: 'alternative-route', variant: 'default' as const },
            { label: 'Emergency SOS',  action: 'emergency',          variant: 'destructive' as const },
            { label: 'Dismiss',        action: 'dismiss',             variant: 'outline' as const },
          ]
        : undefined,
    })
    setUnreadNotifications(n => n + 1)
  }, [])

  const { zones: geofenceZones, checkLocation } = useGeofence({ onEvent: handleGeofenceEvent })

  // Set Mapbox access token
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoibWFoYWQxNjA0IiwiYSI6ImNtY3A2OWlpaTAydXQybHIyYjJvejhqemQifQ.2y3ZmPe5lRXfqns5zlG7hA'

  // Derive safety score and location status from context
  const safetyScore = safetyData?.score || 85
  const locationStatus = safetyData?.riskLevel === 'low' ? 'Safe Zone' : 
                        safetyData?.riskLevel === 'medium' ? 'Moderate Risk' : 
                        safetyData?.riskLevel === 'high' ? 'High Risk Area' : 'Safe Zone'

  // Geofence check on every location update
  useEffect(() => {
    if (!currentLocation || geofenceZones.length === 0) return
    checkLocation(currentLocation.lat, currentLocation.lng)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation])

  // Calculate safety for dashboard — only when location changes by >80 m
  const lastDashSafetyCoords = useRef<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    if (!currentLocation) return
    const prev = lastDashSafetyCoords.current
    if (prev) {
      const dLat = (currentLocation.lat - prev.lat) * 111000
      const dLng = (currentLocation.lng - prev.lng) * 111000 * Math.cos(currentLocation.lat * Math.PI / 180)
      if (Math.sqrt(dLat * dLat + dLng * dLng) < 80) return
    }
    lastDashSafetyCoords.current = currentLocation

    const calculateSafety = async () => {
      setIsCalculatingSafety(true)
      try {
        const response = await fetch('/api/safety/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coordinates: currentLocation })
        })
        if (response.ok) {
          const data = await response.json()
          if (data.location) setSafetyData(data.location)
        }
      } catch (error) {
        console.error('Failed to calculate safety for dashboard:', error)
      } finally {
        setIsCalculatingSafety(false)
      }
    }
    calculateSafety()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation])

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth')
    }
  }, [isAuthenticated, router])

  // Initialize Mapbox map only for overview tab
  useEffect(() => {
    if (tab !== "overview" || !mapContainerRef.current || mapRef.current) return

    // Ensure access token is set
    if (!mapboxgl.accessToken) {
      console.error('Mapbox access token is missing')
      return
    }

    try {
      const map = new MapboxMap({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: currentLocation ? [currentLocation.lng, currentLocation.lat] : [77.2090, 28.6139], // Default to Delhi
        zoom: currentLocation ? 14 : 10,
        pitch: 0,
        bearing: 0,
        attributionControl: false
      })

      mapRef.current = map

      map.on('load', () => {
        console.log('Map loaded successfully')
        // Add user location marker when map loads
        if (currentLocation && !userMarkerRef.current) {
          const userMarker = new Marker({
            color: '#ef4444', // red color
            scale: 0.8
          })
            .setLngLat([currentLocation.lng, currentLocation.lat])
            .addTo(map)
          
          userMarkerRef.current = userMarker
        }
      })

      map.on('error', (e) => {
        console.error('Map error:', e)
      })

    } catch (error) {
      console.error('Failed to initialize map:', error)
    }

    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove()
        userMarkerRef.current = null
      }
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [tab, currentLocation])

  // Update map when location changes
  useEffect(() => {
    if (!mapRef.current || !currentLocation) return

    // Update or create user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([currentLocation.lng, currentLocation.lat])
    } else {
      const userMarker = new Marker({
        color: '#ef4444', // red color
        scale: 0.8
      })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .addTo(mapRef.current)
      
      userMarkerRef.current = userMarker
    }

    // Center map on user location
    mapRef.current.easeTo({
      center: [currentLocation.lng, currentLocation.lat],
      zoom: 14,
      duration: 1000
    })
  }, [currentLocation])

  // Demo live alerts disabled
  // useEffect(() => {
  //   // Simulate live alerts
  //   const alertTimer = setTimeout(() => {
  //     if (currentScreen === "dashboard") {
  //       setCurrentAlert({
  //         id: "live-1",
  //         type: "danger-zone",
  //         title: "Entering High-Risk Area",
  //         message:
  //           "You are approaching an area with increased safety concerns. Would you like to find an alternative route?",
  //         location: "Old Delhi Market Area",
  //         actionButtons: [
  //           { label: "Find Alternative", action: "alternative-route", variant: "default" },
  //           { label: "Continue Anyway", action: "continue", variant: "outline" },
  //           { label: "Emergency Help", action: "emergency", variant: "destructive" },
  //         ],
  //       })
  //     }
  //   }, 10000) // Show alert after 10 seconds on dashboard

  //   return () => clearTimeout(alertTimer)
  // }, [currentScreen])

  const handleAlertAction = (action: string) => {
    console.log(`Alert action: ${action}`)
    if (action === "emergency") {
      setCurrentScreen("emergency")
    }
    setCurrentAlert(null)
  }

  const handleNotificationClick = () => {
    setCurrentScreen("notifications")
    setUnreadNotifications(0)
  }

  const handleLogout = () => {
    logout()
    router.push('/landing')
  }

  const handlePanicPress = () => setCurrentScreen("emergency")
  const handleTrackTrip = () => console.log("Trip tracking activated")
  const handlePoliceUnits = () => console.log("Showing nearby police units")
  const handleProfile = () => setCurrentScreen("profile")

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Shield className="w-8 h-8 text-emerald-500" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (currentScreen === "emergency") {
    return <EmergencySOS user={user} onBack={() => setCurrentScreen("dashboard")} />
  }

  if (currentScreen === "contacts") {
    return <EmergencyContacts onBack={() => setCurrentScreen("dashboard")} />
  }

  if (currentScreen === "profile") {
    return <ProfileScreen user={user} onBack={() => setCurrentScreen("dashboard")} onLogout={handleLogout} />
  }

  if (currentScreen === "notifications") {
    return <NotificationsScreen onBack={() => setCurrentScreen("dashboard")} />
  }

  return (
    <div className="min-h-screen bg-background elderly-friendly">
      {/* Sticky Navigation Bar with Branding */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="mx-auto max-w-md px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white dark:bg-white rounded-lg flex items-center justify-center overflow-hidden">
                <Image
                  src="/SetUva-logo.png"
                  alt="Setuka Logo"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="text-lg font-bold text-primary">Setuka</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNotificationClick}
                className="relative h-10 w-10"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifications > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
                    <span className="text-xs text-destructive-foreground font-bold">
                      {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </span>
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pt-4 pb-24 space-y-4 sm:space-y-6 overflow-y-auto">
        {/* User Welcome Card */}
        <Card className="card-elevated card-aligned p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 border-2 border-primary/20 dark:border-primary/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold truncate">{user?.name || "Tourist"}</h2>
                <p className="text-sm text-muted-foreground truncate">ID: {user?.email || "N/A"}</p>
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="card-elevated consistent-radius h-12 w-12"
                onClick={handleProfile}
                title="Profile Settings"
              >
                <Settings className="w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="bg-primary text-white consistent-radius px-3 py-1">
                <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
                {isCalculatingSafety ? 'Calculating...' : locationStatus}
              </Badge>
              <Badge variant="secondary" className={`consistent-radius px-3 py-1 ${
                isCalculatingSafety ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800' :
                safetyScore >= 70 ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800' :
                safetyScore >= 40 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800' :
                'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
              } border`}>
                {isCalculatingSafety ? '🔄 Loading...' : `Score: ${Math.round(safetyScore)}%`}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Main Dashboard Content */}
        {tab === "overview" && (
          <div className="space-y-4">
            {/* Current Location Map */}
            <Card className="card-elevated p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Your Current Location
              </h3>
              <div 
                ref={mapContainerRef}
                className="h-48 rounded-lg overflow-hidden"
                style={{ width: '100%' }}
              />
              {currentLocation && (
                <p className="text-xs text-muted-foreground mt-2">
                  Coordinates: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                </p>
              )}
            </Card>

            <Card className="card-elevated p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Quick Stats
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/50 rounded-lg">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">24h</div>
                  <div className="text-xs text-green-600/70 dark:text-green-400/70">Safe Time</div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg">
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">12</div>
                  <div className="text-xs text-blue-600/70 dark:text-blue-400/70">Check-ins</div>
                </div>
              </div>
            </Card>

            <SafetyAnalysisCard safetyData={safetyData} isCalculating={isCalculatingSafety} />

            <div className="card-elevated rounded-xl">
              <QuickActions 
                onPanicPress={handlePanicPress}
                onTrackTrip={handleTrackTrip}
                onPoliceUnits={handlePoliceUnits}
                onProfile={handleProfile}
              />
            </div>
          </div>
        )}

        {tab === "map" && (
          <div className="space-y-4">
            <InteractiveMap className="card-elevated" />
          </div>
        )}

        {tab === "safety" && (
          <div className="space-y-4">
            {/* Geofence Zones Manager */}
            <Card className="card-elevated p-4">
              <GeofenceManager currentLocation={currentLocation ?? undefined} />
            </Card>
            <SafetyAnalysisCard safetyData={safetyData} isCalculating={isCalculatingSafety} />
          </div>
        )}

        {tab === "actions" && (
          <div className="space-y-4">
            <div className="card-elevated rounded-xl">
              <QuickActions 
                onPanicPress={handlePanicPress}
                onTrackTrip={handleTrackTrip}
                onPoliceUnits={handlePoliceUnits}
                onProfile={handleProfile}
              />
            </div>
            <Card className="card-elevated p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Emergency Contacts
              </h3>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setCurrentScreen("contacts")}
                >
                  <User className="w-4 h-4 mr-2" />
                  View Emergency Contacts
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={handlePanicPress}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Emergency SOS
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Live Alert Popup */}
      <LiveAlertPopup 
        alert={currentAlert} 
        onDismiss={() => setCurrentAlert(null)} 
        onAction={handleAlertAction} 
      />
      
      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Mobile Navigation */}
      <MobileNav 
        active={tab} 
        onSelectTab={(value: DashboardTab) => setTab(value)}
        onNotifications={handleNotificationClick}
        onProfile={handleProfile}
        unreadNotifications={unreadNotifications}
        className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border/50"
      />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <LocationProvider>
      <DashboardContent />
    </LocationProvider>
  )
}