"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertTriangle, Shield, MapPin, Plus, Trash2, RefreshCw,
  Edit3, CheckCircle, X, Circle
} from "lucide-react"
import { useGeofence, type GeoZone, type CreateZonePayload } from "@/hooks/use-geofence"
import { cn } from "@/lib/utils"

// ── Constants ─────────────────────────────────────────────────────────────────

const ZONE_TYPES: { value: GeoZone['type']; label: string; color: string }[] = [
  { value: 'danger', label: 'Danger Zone',  color: '#ef4444' },
  { value: 'safe',   label: 'Safe Zone',    color: '#22c55e' },
  { value: 'custom', label: 'Custom Zone',  color: '#f59e0b' },
]

const PRESET_RADII = [100, 200, 500, 1000, 2000]

const ZONE_TYPE_STYLES: Record<GeoZone['type'], string> = {
  danger: 'bg-red-100  text-red-800  dark:bg-red-900/30  dark:text-red-300',
  safe:   'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  custom: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
}

const ZONE_TYPE_ICON: Record<GeoZone['type'], React.ReactNode> = {
  danger: <AlertTriangle className="w-3 h-3" />,
  safe:   <Shield        className="w-3 h-3" />,
  custom: <Circle        className="w-3 h-3" />,
}

// ── Form state ────────────────────────────────────────────────────────────────

type FormState = {
  name: string
  lat: string
  lng: string
  radiusMeters: string
  type: GeoZone['type']
  color: string
}

const emptyForm = (): FormState => ({
  name: '', lat: '', lng: '', radiusMeters: '200', type: 'custom', color: '#f59e0b',
})

// ── Component ─────────────────────────────────────────────────────────────────

interface GeofenceManagerProps {
  /** When provided, the "Use my current location" button is enabled. */
  currentLocation?: { lat: number; lng: number }
}

export function GeofenceManager({ currentLocation }: GeofenceManagerProps) {
  const { zones, isLoading, error, fetchZones, createZone, deleteZone, updateZone } = useGeofence()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ msg: string; isError?: boolean } | null>(null)

  const notify = useCallback((msg: string, isError = false) => {
    setFlash({ msg, isError })
    setTimeout(() => setFlash(null), 3500)
  }, [])

  const setField = (key: keyof FormState, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }))

  // Sync type → default color
  const setType = (type: GeoZone['type']) => {
    const preset = ZONE_TYPES.find(t => t.value === type)
    setForm(prev => ({ ...prev, type, color: preset?.color ?? prev.color }))
  }

  const fillCurrentLocation = () => {
    if (!currentLocation) return
    setForm(prev => ({
      ...prev,
      lat: currentLocation.lat.toFixed(6),
      lng: currentLocation.lng.toFixed(6),
    }))
  }

  const openCreate = () => {
    setForm(emptyForm())
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (zone: GeoZone) => {
    setForm({
      name: zone.name,
      lat: String(zone.lat),
      lng: String(zone.lng),
      radiusMeters: String(zone.radiusMeters),
      type: zone.type,
      color: zone.color,
    })
    setEditingId(zone._id)
    setShowForm(true)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm())
  }

  const handleSubmit = async () => {
    const lat = parseFloat(form.lat)
    const lng = parseFloat(form.lng)
    const radiusMeters = parseFloat(form.radiusMeters)

    if (!form.name.trim()) return notify('Zone name is required', true)
    if (isNaN(lat) || lat < -90  || lat > 90)   return notify('Invalid latitude',  true)
    if (isNaN(lng) || lng < -180 || lng > 180)  return notify('Invalid longitude', true)
    if (isNaN(radiusMeters) || radiusMeters < 10 || radiusMeters > 50000)
      return notify('Radius must be between 10 and 50 000 metres', true)

    const payload: CreateZonePayload = {
      name: form.name.trim(),
      lat, lng, radiusMeters,
      type: form.type,
      color: form.color,
    }

    try {
      if (editingId) {
        await updateZone(editingId, payload)
        notify('Zone updated')
      } else {
        await createZone(payload)
        notify('Zone created')
      }
      cancelForm()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save zone', true)
    }
  }

  const handleDelete = async (id: string) => {
    setSavingId(id)
    try {
      await deleteZone(id)
      notify('Zone removed')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete zone', true)
    } finally {
      setSavingId(null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Flash messages */}
      {flash && (
        <div className={cn(
          "flex items-center gap-2 p-3 rounded-lg text-sm border",
          flash.isError
            ? "bg-destructive/10 border-destructive/30 text-destructive"
            : "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
        )}>
          {flash.isError
            ? <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            : <CheckCircle className="w-4 h-4 flex-shrink-0" />
          }
          {flash.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Geofence Zones</h3>
          <p className="text-xs text-muted-foreground">{zones.length} zone{zones.length !== 1 ? 's' : ''} active</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={fetchZones} disabled={isLoading} className="h-8 w-8 p-0">
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-1 h-8">
            <Plus className="w-4 h-4" /> New Zone
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <Card className="p-4 space-y-3 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">{editingId ? 'Edit Zone' : 'New Geofence Zone'}</h4>
            <Button variant="ghost" size="sm" onClick={cancelForm} className="h-7 w-7 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Zone Name *</label>
            <Input
              placeholder="e.g. Hotel Area, Old City Market"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Latitude *</label>
              <Input
                placeholder="22.5726"
                value={form.lat}
                onChange={e => setField('lat', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Longitude *</label>
              <Input
                placeholder="88.3639"
                value={form.lng}
                onChange={e => setField('lng', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Use current location shortcut */}
          {currentLocation && (
            <Button variant="outline" size="sm" onClick={fillCurrentLocation} className="gap-1 h-8 text-xs w-full">
              <MapPin className="w-3 h-3" /> Use my current location
            </Button>
          )}

          {/* Radius */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Radius (metres) *</label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={10}
                max={50000}
                value={form.radiusMeters}
                onChange={e => setField('radiusMeters', e.target.value)}
                className="h-9 text-sm flex-1"
              />
              <div className="flex gap-1">
                {PRESET_RADII.map(r => (
                  <Button
                    key={r}
                    variant={form.radiusMeters === String(r) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setField('radiusMeters', String(r))}
                    className="h-9 px-2 text-xs"
                  >
                    {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Type */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Zone Type</label>
            <Select value={form.type} onValueChange={val => setType(val as GeoZone['type'])}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZONE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: t.color }}
                      />
                      {t.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button onClick={handleSubmit} size="sm" className="flex-1 gap-1 h-9">
              <CheckCircle className="w-4 h-4" />
              {editingId ? 'Save Changes' : 'Create Zone'}
            </Button>
            <Button variant="outline" onClick={cancelForm} size="sm" className="h-9">
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Zone list */}
      {isLoading && zones.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading zones…</div>
      ) : zones.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <MapPin className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium">No geofence zones yet</p>
          <p className="text-xs mt-1">Create a zone to get enter/exit alerts as you travel.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {zones.map(zone => (
            <Card key={zone._id} className="p-3">
              <div className="flex items-start gap-3">
                {/* Colour dot */}
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5 ring-2 ring-offset-1"
                  style={{ backgroundColor: zone.color }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{zone.name}</span>
                    <Badge variant="secondary" className={cn("text-xs gap-0.5", ZONE_TYPE_STYLES[zone.type])}>
                      {ZONE_TYPE_ICON[zone.type]}
                      {ZONE_TYPES.find(t => t.value === zone.type)?.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)} · radius{' '}
                    {zone.radiusMeters >= 1000
                      ? `${(zone.radiusMeters / 1000).toFixed(1)} km`
                      : `${zone.radiusMeters} m`}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => openEdit(zone)}
                    className="h-7 w-7 p-0"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => handleDelete(zone._id)}
                    disabled={savingId === zone._id}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
