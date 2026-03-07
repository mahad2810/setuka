'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ApiClient } from '@/lib/api-client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeoZone {
  _id: string
  userId?: string
  name: string
  lat: number
  lng: number
  radiusMeters: number
  type: 'danger' | 'safe' | 'custom'
  color: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface GeofenceEvent {
  zone: GeoZone
  eventType: 'entered' | 'exited'
  timestamp: Date
}

export type CreateZonePayload = Omit<GeoZone, '_id' | 'userId' | 'active' | 'createdAt' | 'updatedAt'>

interface UseGeofenceOptions {
  /** Called whenever a zone is entered or exited. */
  onEvent?: (event: GeofenceEvent) => void
}

// ── Haversine helper ──────────────────────────────────────────────────────────

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGeofence({ onEvent }: UseGeofenceOptions = {}) {
  const [zones, setZones] = useState<GeoZone[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track which zone IDs the user is currently inside so we can detect transitions.
  const insideZoneIds = useRef<Set<string>>(new Set())

  // Keep a stable ref to onEvent so checkLocation doesn't re-create on every render.
  const onEventRef = useRef(onEvent)
  useEffect(() => { onEventRef.current = onEvent }, [onEvent])

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const fetchZones = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await ApiClient.get('/api/geofence')
      if (!res.ok) throw new Error('Failed to fetch zones')
      const data = await res.json()
      setZones(data.zones ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch zones')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createZone = useCallback(async (payload: CreateZonePayload): Promise<GeoZone> => {
    const res = await ApiClient.post('/api/geofence', payload)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to create zone')
    }
    const data = await res.json()
    setZones(prev => [data.zone, ...prev])
    return data.zone as GeoZone
  }, [])

  const updateZone = useCallback(async (id: string, payload: Partial<GeoZone>): Promise<GeoZone> => {
    const res = await ApiClient.put(`/api/geofence/${id}`, payload)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to update zone')
    }
    const data = await res.json()
    setZones(prev => prev.map(z => (z._id === id ? data.zone : z)))
    return data.zone as GeoZone
  }, [])

  const deleteZone = useCallback(async (id: string): Promise<void> => {
    const res = await ApiClient.delete(`/api/geofence/${id}`)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to delete zone')
    }
    setZones(prev => prev.filter(z => z._id !== id))
    insideZoneIds.current.delete(id)
  }, [])

  // ── Location check ────────────────────────────────────────────────────────

  /**
   * Call this whenever the user's GPS position updates.
   * Compares current position to all loaded zones and fires `onEvent` for each
   * enter / exit transition detected.
   */
  const checkLocation = useCallback((lat: number, lng: number) => {
    zones.forEach(zone => {
      const dist = haversineDistance(lat, lng, zone.lat, zone.lng)
      const isInside = dist <= zone.radiusMeters
      const wasInside = insideZoneIds.current.has(zone._id)

      if (isInside && !wasInside) {
        insideZoneIds.current.add(zone._id)
        onEventRef.current?.({ zone, eventType: 'entered', timestamp: new Date() })
      } else if (!isInside && wasInside) {
        insideZoneIds.current.delete(zone._id)
        onEventRef.current?.({ zone, eventType: 'exited', timestamp: new Date() })
      }
    })
  }, [zones])

  /** Synchronously returns the list of zones the supplied coordinate is inside. */
  const getZonesForLocation = useCallback(
    (lat: number, lng: number): GeoZone[] =>
      zones.filter(z => haversineDistance(lat, lng, z.lat, z.lng) <= z.radiusMeters),
    [zones]
  )

  // ── Auto-load on mount ────────────────────────────────────────────────────

  useEffect(() => { fetchZones() }, [fetchZones])

  return {
    zones,
    isLoading,
    error,
    fetchZones,
    createZone,
    updateZone,
    deleteZone,
    checkLocation,
    getZonesForLocation,
  }
}
