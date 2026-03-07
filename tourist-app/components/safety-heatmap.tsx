"use client"

import React, { useEffect, useRef, useState } from 'react'
import mapboxgl, { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { Thermometer, Car, Lightbulb, Shield, Eye, EyeOff, MapPin, Activity, AlertTriangle, Zap, Settings2, Palette, Navigation, Plus, Minus, RotateCcw, Crosshair } from 'lucide-react'
import { LiveAlertPopup } from './live-alert-popup'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoibWFoYWQxNjA0IiwiYSI6ImNtY3A2OWlpaTAydXQybHIyYjJvejhqemQifQ.2y3ZmPe5lRXfqns5zlG7hA'

interface DataPoint {
  rank: number
  placeName: string
  lat: number
  lon: number
  region: 'KOLKATA' | 'DARJEELING' | string
  score: number      // raw SafetyScore API score (3.0–8.7)
  label: string      // Very Safe / Safe / Moderate / Caution / High Risk
  road: number       // blended road rating (1–10)
  crime: number      // blended crime rating (1–10)
  accident: number   // blended accident risk (1–10)
  confidence: string // HIGH / MEDIUM / LOW / VERY LOW
  safety: number     // normalised to 0–100 for heatmap weight
}

interface HeatmapLayer {
  id: 'crime' | 'accident' | 'road' | 'safety'
  name: string
  icon: React.ReactNode
  colors: {
    gradient: string[]
    description: string
  }[]
  description: string
  enabled: boolean
  scale: {min: number, max: number}
  opacity: number
  radius: number
}

interface SafetyHeatmapProps {
  className?: string
  onLocationSelect?: (lat: number, lon: number) => void
  externalMapRef?: React.MutableRefObject<MapboxMap | null>
}

export function SafetyHeatmap({ className, onLocationSelect, externalMapRef }: SafetyHeatmapProps) {
  const internalMapRef = useRef<MapboxMap | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = externalMapRef ?? internalMapRef
  const isExternal = !!externalMapRef
  const [data, setData] = useState<DataPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Geofencing demo state
  const [isDemoActive, setIsDemoActive] = useState(false)
  const [showAlert, setShowAlert] = useState(false)
  const [navigationPosition, setNavigationPosition] = useState(0) // 0-100 progress along route
  
  // LiveAlert state
  const [currentAlert, setCurrentAlert] = useState<{
    id: string
    type: "danger-zone" | "safe-zone" | "route-change" | "emergency"
    title: string
    message: string
    location?: string
    actionButtons?: { label: string; action: string; variant?: "default" | "destructive" | "outline" }[]
  } | null>(null)

  // Map control state
  const [mapCenter, setMapCenter] = useState<[number, number]>([88.3615, 22.5623]) // Kolkata center
  const [mapZoom, setMapZoom] = useState(10)
  
  // Demo navigation route points — Kolkata: Park Street → Esplanade → Burrabazar
  const demoRoutePoints = [
    [88.3522, 22.5516], // Start: Park Street (safe)
    [88.3540, 22.5530], // Point 1 (safe)
    [88.3560, 22.5545], // Point 2 (safe)
    [88.3565, 22.5560], // Point 3 (entering danger zone)
    [88.3570, 22.5575], // Point 4 (Burrabazar - danger zone)
    [88.3560, 22.5590], // Point 5 (leaving danger zone)
    [88.3545, 22.5610], // Point 6 (safe)
    [88.3525, 22.5639]  // End: Esplanade (safe)
  ]
  
  // Navigation marker ref for map marker
  const navigationMarkerRef = useRef<mapboxgl.Marker | null>(null)

  const [layers, setLayers] = useState<HeatmapLayer[]>([
    {
      id: 'safety',
      name: 'Safety Score',
      icon: <Shield className="w-4 h-4" />,
      colors: [
        {
          gradient: ['rgb(220,53,69)', 'rgb(255,193,7)', 'rgb(25,135,84)'],
          description: 'Red to Green (Danger to Safe)'
        },
        {
          gradient: ['rgb(13,110,253)', 'rgb(32,201,151)', 'rgb(255,255,255)'],
          description: 'Blue to White (Cool Gradient)'
        },
        {
          gradient: ['rgb(111,66,193)', 'rgb(214,51,132)', 'rgb(253,126,20)'],
          description: 'Purple to Orange (Vibrant)'
        }
      ],
      description: 'Overall safety rating (0-100)',
      enabled: true,
      scale: {min: 0, max: 100},
      opacity: 0.8,
      radius: 20
    },
    {
      id: 'crime',
      name: 'Crime Level',
      icon: <AlertTriangle className="w-4 h-4" />,
      colors: [
        {
          gradient: ['rgb(13,110,253)', 'rgb(255,193,7)', 'rgb(220,53,69)'],
          description: 'Blue to Red (Safe to Dangerous)'
        },
        {
          gradient: ['rgb(25,25,112)', 'rgb(138,43,226)', 'rgb(255,20,147)'],
          description: 'Dark Blue to Pink (Night Mode)'
        },
        {
          gradient: ['rgb(0,206,209)', 'rgb(255,140,0)', 'rgb(178,34,34)'],
          description: 'Cyan to Dark Red (Ocean Fire)'
        }
      ],
      description: 'Crime incidents (0-10)',
      enabled: false,
      scale: {min: 0, max: 10},
      opacity: 0.7,
      radius: 25
    },
    {
      id: 'accident',
      name: 'Accident Risk',
      icon: <Car className="w-4 h-4" />,
      colors: [
        {
          gradient: ['rgb(32,201,151)', 'rgb(255,193,7)', 'rgb(220,53,69)'],
          description: 'Green to Red (Safe to Risky)'
        },
        {
          gradient: ['rgb(0,123,255)', 'rgb(255,165,0)', 'rgb(255,69,0)'],
          description: 'Blue to Orange Red (Cool to Hot)'
        },
        {
          gradient: ['rgb(148,0,211)', 'rgb(255,20,147)', 'rgb(255,105,180)'],
          description: 'Purple to Pink (Neon Style)'
        }
      ],
      description: 'Traffic accidents (0-10)',
      enabled: false,
      scale: {min: 0, max: 10},
      opacity: 0.75,
      radius: 22
    },
    {
      id: 'road',
      name: 'Road Quality',
      icon: <Lightbulb className="w-4 h-4" />,
      colors: [
        {
          gradient: ['rgb(25,25,112)', 'rgb(255,215,0)', 'rgb(255,255,224)'],
          description: 'Dark to Bright (Poor to Good)'
        },
        {
          gradient: ['rgb(72,61,139)', 'rgb(138,43,226)', 'rgb(255,255,255)'],
          description: 'Purple to White (Mystical)'
        },
        {
          gradient: ['rgb(0,0,139)', 'rgb(30,144,255)', 'rgb(255,255,255)'],
          description: 'Deep Blue to White (Sky)'
        }
      ],
      description: 'Road quality rating (1–10)',
      enabled: false,
      scale: {min: 0, max: 10},
      opacity: 0.6,
      radius: 18
    }
  ])

  const [selectedColorScheme, setSelectedColorScheme] = useState<{[key: string]: number}>({
    safety: 0,
    crime: 0,
    accident: 0,
    road: 0
  })

  // Load all_scores.csv — pre-computed SafetyScore API scores for Kolkata + Darjeeling
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        const res = await fetch('/all_scores.csv')
        if (!res.ok) throw new Error('Failed to load all_scores.csv')
        const text = await res.text()
        const lines = text.trim().split('\n')
        // columns: rank,place_name,latitude,longitude,region,score,label,
        //          road,crime,accident,confidence,nearest_dist_km,model,
        //          road_rating_raw,crime_rating_raw,accident_rating_raw
        const parsed: DataPoint[] = lines.slice(1).map(line => {
          const v = line.split(',')
          const rank     = parseInt(v[0])
          const placeName = v[1]?.trim() || ''
          const lat      = parseFloat(v[2])
          const lon      = parseFloat(v[3])
          const region   = v[4]?.trim() || ''
          const score    = parseFloat(v[5])   // 3.0–8.7
          const label    = v[6]?.trim() || ''
          const road     = parseFloat(v[7])   // 1–10
          const crime    = parseFloat(v[8])   // 1–10
          const accident = parseFloat(v[9])   // 1–10
          const confidence = v[10]?.trim() || ''
          // Normalise composite score from 3.0–8.7 → 0–100 for heatmap weight
          const safety = Math.round(((score - 3.0) / (8.7 - 3.0)) * 100)
          return { rank, placeName, lat, lon, region, score, label, road, crime, accident, confidence, safety }
        }).filter(p =>
          !isNaN(p.lat) && !isNaN(p.lon) &&
          !isNaN(p.road) && !isNaN(p.crime) &&
          !isNaN(p.accident) && !isNaN(p.score)
        )
        setData(parsed)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  // Initialize map — only when not using an external map
  useEffect(() => {
    if (isExternal) return
    if (!mapContainerRef.current || internalMapRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [88.3615, 22.5623], // Centered on Kolkata
      zoom: 11,
      pitch: 0
    })

    mapRef.current = map

    map.on('load', () => {
      // Add sources for each layer
      layers.forEach(layer => {
        if (!map.getSource(`${layer.id}-source`)) {
          map.addSource(`${layer.id}-source`, {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          })
        }
      })
    })

    // Add click handler for location selection
    map.on('click', (e) => {
      if (onLocationSelect) {
        onLocationSelect(e.lngLat.lat, e.lngLat.lng)
      }
    })

    return () => {
      map.remove()
      internalMapRef.current = null
    }
  }, [isExternal, onLocationSelect])

  // When using an external map: ensure sources exist, then clean up on unmount
  useEffect(() => {
    if (!isExternal) return
    const map = mapRef.current
    if (!map) return

    const initSources = () => {
      layers.forEach(layer => {
        if (!map.getSource(`${layer.id}-source`)) {
          map.addSource(`${layer.id}-source`, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
          })
        }
      })
    }

    if (map.isStyleLoaded()) {
      initSources()
    } else {
      map.once('load', initSources)
    }

    return () => {
      // remove heatmap layers/sources from external map on unmount
      const m = mapRef.current
      if (!m) return
      layers.forEach(layer => {
        if (m.getLayer(`${layer.id}-heatmap`)) m.removeLayer(`${layer.id}-heatmap`)
        if (m.getSource(`${layer.id}-source`)) m.removeSource(`${layer.id}-source`)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExternal])

  // Update heatmap layers when data or layer settings change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !data.length) return

    const applyLayers = () => {
      layers.forEach(layer => {
        const sourceId = `${layer.id}-source`
        const layerId = `${layer.id}-heatmap`

        // Ensure source exists (handles external map or late data arrival)
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
          })
        }

        // Remove existing layer before re-adding
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId)
        }

        if (layer.enabled) {
          // Get current color scheme for this layer
          const colorSchemeIndex = selectedColorScheme[layer.id] || 0
          const currentColors = layer.colors[colorSchemeIndex].gradient

          // Create GeoJSON features for this layer
          const features = data.map(point => ({
            type: 'Feature' as const,
            properties: { value: point[layer.id] },
            geometry: {
              type: 'Point' as const,
              coordinates: [point.lon, point.lat]
            }
          }))

          // Update source
          const source = map.getSource(sourceId) as GeoJSONSource
          if (source) {
            source.setData({ type: 'FeatureCollection', features })

            // Add enhanced heatmap layer with improved aesthetics
            map.addLayer({
              id: layerId,
            type: 'heatmap',
            source: sourceId,
            maxzoom: 18,
            paint: {
              // Heatmap weight based on data value
              'heatmap-weight': [
                'interpolate',
                ['linear'],
                ['get', 'value'],
                layer.scale.min, 0,
                layer.scale.max, 1
              ],
              // Enhanced heatmap intensity with smooth transitions
              'heatmap-intensity': [
                'interpolate',
                ['exponential', 2],
                ['zoom'],
                0, 0.8,
                9, 1.2,
                15, 2.5,
                18, 4
              ],
              // Dynamic color gradient with multiple stops for smoother transitions
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(0,0,0,0)',
                0.1, currentColors[0],
                0.3, currentColors[0],
                0.5, currentColors[1],
                0.7, currentColors[1],
                0.85, currentColors[2],
                1, currentColors[2]
              ],
              // Adaptive radius based on zoom level and layer settings
              'heatmap-radius': [
                'interpolate',
                ['exponential', 1.5],
                ['zoom'],
                0, layer.radius * 0.5,
                9, layer.radius * 0.8,
                15, layer.radius * 1.2,
                18, layer.radius * 2
              ],
              // Dynamic opacity with layer-specific settings
              'heatmap-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                7, layer.opacity * 0.6,
                12, layer.opacity,
                18, layer.opacity * 0.8
              ]
            }
          })
          }  // close if (source)
        }  // close if (layer.enabled)
      })
    }

    if (map.isStyleLoaded()) {
      applyLayers()
    } else {
      map.once('style.load', applyLayers)
    }
  }, [data, layers, selectedColorScheme])

  const toggleLayer = (layerId: string) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId 
        ? { ...layer, enabled: !layer.enabled }
        : layer
    ))
  }

  const enableOnlyLayer = (layerId: string) => {
    setLayers(prev => prev.map(layer => ({
      ...layer,
      enabled: layer.id === layerId
    })))
  }

  const updateLayerOpacity = (layerId: string, opacity: number) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId 
        ? { ...layer, opacity: opacity / 100 }
        : layer
    ))
  }

  const updateLayerRadius = (layerId: string, radius: number) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId 
        ? { ...layer, radius }
        : layer
    ))
  }

  const changeColorScheme = (layerId: string, schemeIndex: number) => {
    setSelectedColorScheme(prev => ({
      ...prev,
      [layerId]: schemeIndex
    }))
  }

  // Geofencing demo functions
  const startGeofencingDemo = () => {
    setIsDemoActive(true)
    setNavigationPosition(0)
    setCurrentAlert(null)
    
    // Create navigation marker on the map
    const map = mapRef.current
    if (map) {
      // Remove existing marker if any
      if (navigationMarkerRef.current) {
        navigationMarkerRef.current.remove()
      }
      
      // Create a custom navigation marker element
      const markerElement = document.createElement('div')
      markerElement.className = 'navigation-marker'
      markerElement.innerHTML = `
        <div style="
          width: 16px; 
          height: 16px; 
          background: #3b82f6; 
          border: 2px solid white; 
          border-radius: 50%; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          position: relative;
        ">
          <div style="
            position: absolute;
            top: -2px;
            left: -2px;
            width: 20px;
            height: 20px;
            background: rgba(59, 130, 246, 0.3);
            border-radius: 50%;
            animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
        </div>
        <style>
          @keyframes ping {
            75%, 100% {
              transform: scale(2);
              opacity: 0;
            }
          }
        </style>
      `
      
      // Add marker to map at starting position
      navigationMarkerRef.current = new mapboxgl.Marker(markerElement)
        .setLngLat(demoRoutePoints[0] as [number, number])
        .addTo(map)
      
      // Center map on starting position
      map.easeTo({
        center: demoRoutePoints[0] as [number, number],
        zoom: 15,
        duration: 1000
      })
    }
    
    // Simulate navigation movement
    const interval = setInterval(() => {
      setNavigationPosition(prev => {
        const newPosition = prev + 1.25 // Slower movement for better visualization
        
        // Calculate current route point based on position
        const totalPoints = demoRoutePoints.length - 1
        const currentIndex = Math.floor((newPosition / 100) * totalPoints)
        const nextIndex = Math.min(currentIndex + 1, totalPoints)
        const progress = ((newPosition / 100) * totalPoints) - currentIndex
        
        // Interpolate between current and next point
        if (currentIndex < totalPoints) {
          const currentPoint = demoRoutePoints[currentIndex]
          const nextPoint = demoRoutePoints[nextIndex]
          const interpolatedLng = currentPoint[0] + (nextPoint[0] - currentPoint[0]) * progress
          const interpolatedLat = currentPoint[1] + (nextPoint[1] - currentPoint[1]) * progress
          
          // Update marker position
          if (navigationMarkerRef.current) {
            navigationMarkerRef.current.setLngLat([interpolatedLng, interpolatedLat])
          }
          
          // Update map center to follow the marker
          const map = mapRef.current
          if (map) {
            map.easeTo({
              center: [interpolatedLng, interpolatedLat],
              duration: 100
            })
          }
        }
        
        // Trigger alert when entering dangerous zone (around 60-80%)
        if (newPosition >= 60 && newPosition <= 80 && !currentAlert) {
          setCurrentAlert({
            id: `geofence-alert-${Date.now()}`,
            type: "danger-zone",
            title: "DANGER ZONE ALERT!",
            message: "You are entering a high-risk area with elevated crime rates and poor lighting conditions. Consider taking an alternative route or proceed with extra caution.",
            location: "High Crime Area - Downtown District",
            actionButtons: [
              { label: "Find Alternative Route", action: "alternative-route", variant: "default" },
              { label: "Continue Anyway", action: "continue", variant: "destructive" },
              { label: "Call Emergency", action: "emergency", variant: "outline" }
            ]
          })
        }
        
        // Reset demo when reaching end
        if (newPosition >= 100) {
          clearInterval(interval)
          setTimeout(() => {
            setIsDemoActive(false)
            setNavigationPosition(0)
            setCurrentAlert(null)
            // Remove navigation marker
            if (navigationMarkerRef.current) {
              navigationMarkerRef.current.remove()
              navigationMarkerRef.current = null
            }
            // Reset map view
            resetMapView()
          }, 2000) // Wait 2 seconds before cleanup
          return 100
        }
        
        return newPosition
      })
    }, 120) // Update every 120ms for smooth animation
  }

  const stopGeofencingDemo = () => {
    setIsDemoActive(false)
    setNavigationPosition(0)
    setCurrentAlert(null)
    
    // Remove navigation marker
    if (navigationMarkerRef.current) {
      navigationMarkerRef.current.remove()
      navigationMarkerRef.current = null
    }
    
    // Reset map view
    resetMapView()
  }

  const handleAlertAction = (action: string) => {
    switch (action) {
      case "alternative-route":
        // Simulate finding alternative route
        setCurrentAlert({
          id: `alt-route-${Date.now()}`,
          type: "safe-zone",
          title: "Alternative Route Found",
          message: "A safer route has been calculated avoiding high-risk areas. The new route adds 5 minutes but ensures better safety.",
          actionButtons: [
            { label: "Accept New Route", action: "accept-route", variant: "default" },
            { label: "Keep Original", action: "dismiss", variant: "outline" }
          ]
        })
        break
      case "continue":
      case "accept-route":
      case "dismiss":
        setCurrentAlert(null)
        break
      case "emergency":
        setCurrentAlert({
          id: `emergency-${Date.now()}`,
          type: "emergency",
          title: "Emergency Services",
          message: "Contacting local emergency services and sharing your location. Stay calm and follow safety protocols.",
          actionButtons: [
            { label: "Cancel Call", action: "dismiss", variant: "outline" }
          ]
        })
        break
    }
  }

  const dismissAlert = () => {
    setCurrentAlert(null)
  }

  // Map navigation functions
  const zoomIn = () => {
    const map = mapRef.current
    if (map) {
      const currentZoom = map.getZoom()
      map.easeTo({ zoom: Math.min(currentZoom + 1, 18), duration: 300 })
      setMapZoom(Math.min(currentZoom + 1, 18))
    }
  }

  const zoomOut = () => {
    const map = mapRef.current
    if (map) {
      const currentZoom = map.getZoom()
      map.easeTo({ zoom: Math.max(currentZoom - 1, 1), duration: 300 })
      setMapZoom(Math.max(currentZoom - 1, 1))
    }
  }

  const panMap = (direction: 'north' | 'south' | 'east' | 'west') => {
    const map = mapRef.current
    if (map) {
      const center = map.getCenter()
      const panDistance = 0.01 // Adjust as needed
      
      let newLng = center.lng
      let newLat = center.lat
      
      switch (direction) {
        case 'north':
          newLat += panDistance
          break
        case 'south':
          newLat -= panDistance
          break
        case 'east':
          newLng += panDistance
          break
        case 'west':
          newLng -= panDistance
          break
      }
      
      map.easeTo({ center: [newLng, newLat], duration: 300 })
      setMapCenter([newLng, newLat])
    }
  }

  const resetMapView = () => {
    const map = mapRef.current
    if (map) {
      map.easeTo({
        center: [88.3615, 22.5623],
        zoom: 11,
        duration: 500
      })
      setMapCenter([88.3615, 22.5623])
      setMapZoom(11)
    }
  }

  const centerOnLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const map = mapRef.current
          if (map) {
            map.easeTo({
              center: [longitude, latitude],
              zoom: 14,
              duration: 500
            })
            setMapCenter([longitude, latitude])
            setMapZoom(14)
          }
        },
        (error) => {
          console.error('Error getting location:', error)
          // Fallback to default location
          resetMapView()
        }
      )
    } else {
      resetMapView()
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {error ? (
        <div className="text-center p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="text-destructive mb-2">⚠️ Error loading heatmap data</div>
          <div className="text-sm text-muted-foreground">{error}</div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Enhanced Header */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Safety Analytics
              </h4>
              <p className="text-sm text-muted-foreground">
                Interactive heatmaps with multiple visualization options
              </p>
            </div>
            <Badge variant="outline" className="flex items-center gap-1 text-xs">
              <MapPin className="w-3 h-3" />
              {data.length.toLocaleString()} data points
            </Badge>
          </div>

          {/* Standalone map container — only visible when NOT merged with InteractiveMap */}
          {!isExternal && (
          <div className="relative">
            <div 
              ref={mapContainerRef} 
              className="w-full h-64 rounded-xl overflow-hidden border border-border/30 shadow-lg"
            />
            
            {/* Single Navigation Arrow - Google Maps Style */}
            <div className="absolute top-3 right-3">
              <div className="bg-background/90 backdrop-blur-sm rounded-lg border shadow-lg p-2">
                <div className="relative w-8 h-8 cursor-pointer group" title="Pan Map">
                  {/* Center dot */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-foreground rounded-full"></div>
                  
                  {/* North Arrow */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => panMap('north')}
                    className="absolute top-0 left-1/2 transform -translate-x-1/2 h-3 w-3 p-0 hover:bg-primary/20 rounded-none"
                    title="Pan North"
                  >
                    <img 
                      src="/arrow.png" 
                      alt="North" 
                      className="w-2.5 h-2.5 transform rotate-0 opacity-70 group-hover:opacity-100" 
                    />
                  </Button>
                  
                  {/* South Arrow */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => panMap('south')}
                    className="absolute bottom-0 left-1/2 transform -translate-x-1/2 h-3 w-3 p-0 hover:bg-primary/20 rounded-none"
                    title="Pan South"
                  >
                    <img 
                      src="/arrow.png" 
                      alt="South" 
                      className="w-2.5 h-2.5 transform rotate-180 opacity-70 group-hover:opacity-100" 
                    />
                  </Button>
                  
                  {/* West Arrow */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => panMap('west')}
                    className="absolute left-0 top-1/2 transform -translate-y-1/2 h-3 w-3 p-0 hover:bg-primary/20 rounded-none"
                    title="Pan West"
                  >
                    <img 
                      src="/arrow.png" 
                      alt="West" 
                      className="w-2.5 h-2.5 transform -rotate-90 opacity-70 group-hover:opacity-100" 
                    />
                  </Button>
                  
                  {/* East Arrow */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => panMap('east')}
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 h-3 w-3 p-0 hover:bg-primary/20 rounded-none"
                    title="Pan East"
                  >
                    <img 
                      src="/arrow.png" 
                      alt="East" 
                      className="w-2.5 h-2.5 transform rotate-90 opacity-70 group-hover:opacity-100" 
                    />
                  </Button>
                </div>
              </div>
            </div>
            
            {isLoading && (
              <div className="absolute inset-0 bg-background/90 rounded-xl flex items-center justify-center border border-border">
                <div className="text-foreground text-sm flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-foreground border-t-transparent"></div>
                  Loading heatmap data...
                </div>
              </div>
            )}
          </div>
          )}

          {/* Geofencing Alert Demo */}
          <Card className="p-4 border-2 border-dashed border-primary/30 bg-primary/5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-semibold text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Geofencing Alert Demo
                  </h5>
                  <p className="text-xs text-muted-foreground">
                    Watch navigation entering a dangerous zone
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isDemoActive ? "destructive" : "default"}
                  onClick={isDemoActive ? stopGeofencingDemo : startGeofencingDemo}
                  className="text-xs"
                >
                  {isDemoActive ? "Stop Demo" : "Start Demo"}
                </Button>
              </div>

              {/* Demo Navigation Route */}
              <div className="relative">
                <div className="h-12 bg-muted/50 rounded-lg border overflow-hidden relative">
                  {/* Route path */}
                  <div className="absolute inset-x-2 top-1/2 transform -translate-y-1/2 h-1 bg-gray-300 rounded-full">
                    {/* Safe zones */}
                    <div className="absolute left-0 w-[60%] h-full bg-green-400 rounded-full"></div>
                    <div className="absolute right-0 w-[20%] h-full bg-green-400 rounded-full"></div>
                    {/* Danger zone */}
                    <div className="absolute left-[60%] w-[20%] h-full bg-red-400 rounded-full animate-pulse"></div>
                  </div>
                  
                  {/* Navigation marker */}
                  {isDemoActive && (
                    <div 
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 transition-all duration-100 ease-linear"
                      style={{ left: `${8 + (navigationPosition * 0.84)}%` }}
                    >
                      <div className="w-3 h-3 bg-blue-500 rounded-full shadow-lg animate-bounce">
                        <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-75"></div>
                      </div>
                    </div>
                  )}
                  
                  {/* Zone labels */}
                  <div className="absolute bottom-1 left-2 text-[10px] text-green-600 font-medium">Safe</div>
                  <div className="absolute bottom-1 left-[60%] text-[10px] text-red-600 font-medium">Danger Zone</div>
                  <div className="absolute bottom-1 right-2 text-[10px] text-green-600 font-medium">Safe</div>
                </div>
                
                {/* Progress indicator */}
                {isDemoActive && (
                  <div className="mt-2 text-xs text-muted-foreground text-center">
                    Navigation Progress: {Math.round(navigationPosition)}%
                  </div>
                )}
              </div>

              {/* Geofencing Alert Popup - Now using LiveAlertPopup */}
              <LiveAlertPopup
                alert={currentAlert}
                onDismiss={dismissAlert}
                onAction={handleAlertAction}
              />
            </div>
          </Card>

          {/* Enhanced Layer Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="font-medium text-sm flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Heatmap Layers
              </h5>
              <div className="text-xs text-muted-foreground">
                Toggle • Customize • Analyze
              </div>
            </div>

            <div className="space-y-3">
              {layers.map(layer => {
                const currentColorScheme = selectedColorScheme[layer.id] || 0
                const currentColors = layer.colors[currentColorScheme].gradient
                
                return (
                  <Card 
                    key={layer.id}
                    className={cn(
                      "p-4 transition-all duration-300 border-2",
                      layer.enabled 
                        ? "border-primary bg-primary/5 shadow-lg" 
                        : "border-border/60 hover:border-border bg-card/50 hover:bg-card/80"
                    )}
                  >
                    {/* Layer Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg transition-colors",
                          layer.enabled ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}>
                          {layer.icon}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{layer.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {layer.description}
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={layer.enabled}
                        onCheckedChange={() => toggleLayer(layer.id)}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>

                    {layer.enabled && (
                      <div className="space-y-4 pt-3 border-t border-border/30">
                        {/* Color Scheme Selector */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Palette className="w-3 h-3" />
                            Color Scheme
                          </label>
                          <Select
                            value={currentColorScheme.toString()}
                            onValueChange={(value) => changeColorScheme(layer.id, parseInt(value))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {layer.colors.map((colorScheme, index) => (
                                <SelectItem key={index} value={index.toString()}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-8 h-3 rounded-full"
                                      style={{
                                        background: `linear-gradient(to right, ${colorScheme.gradient.join(', ')})`
                                      }}
                                    />
                                    <span className="text-xs">{colorScheme.description}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Opacity Control */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            Opacity: {Math.round(layer.opacity * 100)}%
                          </label>
                          <Slider
                            value={[layer.opacity * 100]}
                            onValueChange={([value]) => updateLayerOpacity(layer.id, value)}
                            max={100}
                            min={10}
                            step={5}
                            className="w-full"
                          />
                        </div>

                        {/* Radius Control */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            Radius: {layer.radius}px
                          </label>
                          <Slider
                            value={[layer.radius]}
                            onValueChange={([value]) => updateLayerRadius(layer.id, value)}
                            max={40}
                            min={5}
                            step={1}
                            className="w-full"
                          />
                        </div>

                        {/* Current Color Gradient Display */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">
                            Current Gradient
                          </label>
                          <div className="h-4 rounded-lg overflow-hidden" 
                               style={{
                                 background: `linear-gradient(to right, ${currentColors.join(', ')})`
                               }} 
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Low ({layer.scale.min})</span>
                            <span>High ({layer.scale.max})</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>

            {/* Enhanced Quick Actions */}
            <div className="flex gap-2 pt-2 border-t border-border/40">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLayers(prev => prev.map(l => ({ ...l, enabled: true })))}
                className="flex-1 text-xs"
              >
                <Eye className="w-3 h-3 mr-1" />
                Show All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLayers(prev => prev.map(l => ({ ...l, enabled: false })))}
                className="flex-1 text-xs"
              >
                <EyeOff className="w-3 h-3 mr-1" />
                Hide All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLayers(prev => prev.map(l => ({ ...l, opacity: 0.8, radius: 20 })))
                  setSelectedColorScheme({ safety: 0, crime: 0, accident: 0, road: 0 })
                }}
                className="flex-1 text-xs"
              >
                <Settings2 className="w-3 h-3 mr-1" />
                Reset
              </Button>
            </div>

            {/* Enhanced Info */}
            <div className="text-xs text-muted-foreground bg-gradient-to-r from-muted/20 to-muted/10 p-3 rounded-lg border border-border/30">
              <div className="flex items-start gap-2">
                <div className="text-primary text-sm">💡</div>
                <div>
                  <div className="font-medium mb-1">Interactive Heatmap Tips:</div>
                  <ul className="space-y-1 text-xs">
                    <li>• Toggle layers to compare different safety metrics</li>
                    <li>• Adjust opacity to overlay multiple layers</li>
                    <li>• Change color schemes for better visualization</li>
                    <li>• Click on the map to center on specific locations</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Live Alert Popup */}
      <LiveAlertPopup
        alert={currentAlert}
        onDismiss={dismissAlert}
        onAction={handleAlertAction}
      />
    </div>
  )
}
