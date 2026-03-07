"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  MapPin, Calendar, Plus, ChevronDown, ChevronUp, Trash2, Edit3,
  Upload, FileText, AlertCircle, User, Heart, Paperclip, X,
  CheckCircle, Clock, Archive, ArrowLeft, Eye
} from "lucide-react"
import { ApiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────

interface TripActivity {
  id: string
  title: string
  location: string
  time: string
  type: "hotel" | "attraction" | "restaurant" | "transport" | "other"
  description?: string
  duration?: string
}

interface TripDay {
  date: string
  destinations: string[]
  activities: TripActivity[]
}

interface TravellerInfo {
  passportNumber?: string
  nationality?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelation?: string
}

interface MedicalInfo {
  bloodType?: string
  conditions?: string
  medications?: string
  allergies?: string
  doctorName?: string
  doctorContact?: string
  insuranceProvider?: string
  insuranceNumber?: string
}

interface Attachment {
  name: string
  type: string
  size: number
  data: string      // base64
  uploadedAt: string
}

interface Trip {
  _id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  status: "active" | "upcoming" | "past"
  notes?: string
  travellerInfo?: TravellerInfo
  medicalInfo?: MedicalInfo
  days?: TripDay[]
  attachments?: Attachment[]
  createdAt: string
  updatedAt: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<Trip["status"], string> = {
  active:   "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  upcoming: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  past:     "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

const STATUS_ICON: Record<Trip["status"], React.ReactNode> = {
  active:   <CheckCircle className="w-3 h-3" />,
  upcoming: <Clock className="w-3 h-3" />,
  past:     <Archive className="w-3 h-3" />,
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

/** Parse a CSV or plain-text itinerary into TripDay[] */
function parseItineraryFile(text: string, startDate: string): TripDay[] {
  const lines = text.trim().split("\n").filter(l => l.trim())

  // Try to detect CSV with header: date,time,title,location,type,description
  const header = lines[0].toLowerCase()
  if (header.includes("date") && header.includes("title")) {
    const cols = header.split(",").map(c => c.trim())
    const dayMap: Record<string, TripDay> = {}

    lines.slice(1).forEach(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""))
      const get = (key: string) => vals[cols.indexOf(key)] || ""
      const date = get("date") || startDate
      if (!dayMap[date]) dayMap[date] = { date, destinations: [], activities: [] }
      const loc = get("location")
      if (loc && !dayMap[date].destinations.includes(loc)) dayMap[date].destinations.push(loc)
      dayMap[date].activities.push({
        id: uid(),
        title:       get("title") || get("activity") || "Activity",
        location:    loc,
        time:        get("time"),
        type:        (get("type") as TripActivity["type"]) || "other",
        description: get("description") || get("notes"),
        duration:    get("duration"),
      })
    })
    return Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date))
  }

  // Plain text — one activity per line: treat each line as a same-day activity
  const day: TripDay = { date: startDate, destinations: [], activities: [] }
  lines.forEach(line => {
    day.activities.push({
      id:       uid(),
      title:    line.slice(0, 80),
      location: "",
      time:     "",
      type:     "other",
    })
  })
  return [day]
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(",")[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Empty-form factory ────────────────────────────────────────────────────────

function emptyForm() {
  return {
    title: "", destination: "", startDate: "", endDate: "", notes: "",
    travellerInfo: {
      passportNumber: "", nationality: "",
      emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "",
    } as TravellerInfo,
    medicalInfo: {
      bloodType: "", conditions: "", medications: "", allergies: "",
      doctorName: "", doctorContact: "", insuranceProvider: "", insuranceNumber: "",
    } as MedicalInfo,
    days: [] as TripDay[],
    attachments: [] as Attachment[],
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function TripManager() {
  const [trips, setTrips] = useState<{ active: Trip[]; upcoming: Trip[]; past: Trip[] }>({
    active: [], upcoming: [], past: [],
  })
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"list" | "new" | "detail">("list")
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState(emptyForm())
  const [formTab, setFormTab] = useState("basic")
  const csvInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchTrips = useCallback(async () => {
    try {
      setLoading(true)
      const res = await ApiClient.get("/api/trips")
      const data = await res.json()
      setTrips({
        active:   data.trips?.active   || [],
        upcoming: data.trips?.upcoming || [],
        past:     data.trips?.past     || [],
      })
    } catch (e) {
      console.error("fetchTrips:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTrips() }, [fetchTrips])

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(null), 4000) }
    else { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000) }
  }

  // ── Create trip ────────────────────────────────────────────────────────────
  const createTrip = async () => {
    if (!form.title || !form.destination || !form.startDate || !form.endDate) {
      flash("Title, destination, and dates are required.", true)
      return
    }
    setSaving(true)
    try {
      const res = await ApiClient.post("/api/trips", form)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      flash(`"${data.trip.title}" saved!`)
      setForm(emptyForm())
      setView("list")
      fetchTrips()
    } catch (e: any) {
      flash(e.message || "Failed to save trip", true)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete trip ────────────────────────────────────────────────────────────
  const deleteTrip = async (id: string) => {
    if (!confirm("Delete this trip?")) return
    try {
      const res = await ApiClient.delete(`/api/trips/${id}`)
      if (!res.ok) throw new Error()
      flash("Trip deleted.")
      fetchTrips()
      if (selectedTrip?._id === id) { setView("list"); setSelectedTrip(null) }
    } catch {
      flash("Failed to delete trip.", true)
    }
  }

  // ── CSV itinerary upload ───────────────────────────────────────────────────
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const parsed = parseItineraryFile(text, form.startDate || new Date().toISOString().slice(0, 10))
    setForm(f => ({ ...f, days: parsed }))
    flash(`Parsed ${parsed.length} day(s), ${parsed.reduce((s, d) => s + d.activities.length, 0)} activities from ${file.name}`)
    e.target.value = ""
  }

  // ── PDF / file attachment upload ───────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const MAX_MB = 5
    const oversized = files.filter(f => f.size > MAX_MB * 1024 * 1024)
    if (oversized.length) {
      flash(`Files must be under ${MAX_MB} MB each.`, true)
      return
    }
    const converted: Attachment[] = await Promise.all(
      files.map(async f => ({
        name:       f.name,
        type:       f.type,
        size:       f.size,
        data:       await fileToBase64(f),
        uploadedAt: new Date().toISOString(),
      }))
    )
    setForm(f => ({ ...f, attachments: [...f.attachments, ...converted] }))
    flash(`${converted.length} file(s) attached.`)
    e.target.value = ""
  }

  const removeAttachment = (idx: number) =>
    setForm(f => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) }))

  // ── Update form field helpers ──────────────────────────────────────────────
  const setField = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))
  const setTraveller = (key: keyof TravellerInfo, val: string) =>
    setForm(f => ({ ...f, travellerInfo: { ...f.travellerInfo, [key]: val } }))
  const setMedical = (key: keyof MedicalInfo, val: string) =>
    setForm(f => ({ ...f, medicalInfo: { ...f.medicalInfo, [key]: val } }))

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const allTrips = [...trips.active, ...trips.upcoming, ...trips.past]

  // ── Render ─────────────────────────────────────────────────────────────────
  if (view === "detail" && selectedTrip) {
    return <TripDetail trip={selectedTrip} onBack={() => setView("list")} onDelete={deleteTrip} />
  }

  return (
    <div className="space-y-4">
      {/* Flash messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
          <CheckCircle className="w-4 h-4 flex-shrink-0" /> {successMsg}
        </div>
      )}

      {view === "list" && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base">My Trips</h3>
              <p className="text-xs text-muted-foreground">{allTrips.length} total</p>
            </div>
            <Button size="sm" onClick={() => { setForm(emptyForm()); setView("new") }} className="gap-1">
              <Plus className="w-4 h-4" /> New Trip
            </Button>
          </div>

          {loading && (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading trips…</div>
          )}

          {!loading && allTrips.length === 0 && (
            <Card className="p-8 text-center border-dashed">
              <MapPin className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">No trips yet. Create your first one!</p>
            </Card>
          )}

          {/* Trip lists by status */}
          {(["active", "upcoming", "past"] as const).map(status => {
            const list = trips[status]
            if (!list.length) return null
            const label = status === "active" ? "Active" : status === "upcoming" ? "Upcoming" : "Past Trips"
            return (
              <div key={status} className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">{label}</h4>
                {list.map(trip => (
                  <Card
                    key={trip._id}
                    className={cn(
                      "p-4 cursor-pointer border transition-colors hover:border-primary/40",
                      expandedId === trip._id && "border-primary/40"
                    )}
                    onClick={() => setExpandedId(expandedId === trip._id ? null : trip._id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{trip.title}</span>
                          <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[trip.status])}>
                            {STATUS_ICON[trip.status]} {trip.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" /> {trip.destination}
                          <span className="mx-1">·</span>
                          <Calendar className="w-3 h-3" /> {fmtDate(trip.startDate)} – {fmtDate(trip.endDate)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={e => { e.stopPropagation(); setSelectedTrip(trip); setView("detail") }}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); deleteTrip(trip._id) }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        {expandedId === trip._id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Expanded summary */}
                    {expandedId === trip._id && (
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-2 text-xs text-muted-foreground">
                        {trip.days && trip.days.length > 0 && (
                          <p>📅 {trip.days.length} day(s) · {trip.days.reduce((s, d) => s + d.activities.length, 0)} activities</p>
                        )}
                        {trip.travellerInfo?.emergencyContactName && (
                          <p>🆘 Emergency: {trip.travellerInfo.emergencyContactName} ({trip.travellerInfo.emergencyContactPhone})</p>
                        )}
                        {trip.medicalInfo?.bloodType && (
                          <p>🩸 Blood type: {trip.medicalInfo.bloodType}</p>
                        )}
                        {trip.attachments && trip.attachments.length > 0 && (
                          <p>📎 {trip.attachments.length} file(s) attached</p>
                        )}
                        {trip.notes && <p className="line-clamp-2">📝 {trip.notes}</p>}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )
          })}
        </>
      )}

      {/* ── New trip form ─────────────────────────────────────────────────── */}
      {view === "new" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView("list")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h3 className="font-semibold text-base">New Trip</h3>
          </div>

          <Tabs value={formTab} onValueChange={setFormTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 h-10 text-xs">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="traveller">Traveller</TabsTrigger>
              <TabsTrigger value="medical">Medical</TabsTrigger>
              <TabsTrigger value="itinerary">Itinerary</TabsTrigger>
            </TabsList>

            {/* ─ Basic info ─ */}
            <TabsContent value="basic" className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Trip Title *</label>
                <Input placeholder="e.g. Kolkata Heritage Tour" value={form.title} onChange={e => setField("title", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Destination *</label>
                <Input placeholder="e.g. Kolkata, West Bengal" value={form.destination} onChange={e => setField("destination", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Start Date *</label>
                  <Input type="date" value={form.startDate} onChange={e => setField("startDate", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">End Date *</label>
                  <Input type="date" value={form.endDate} onChange={e => setField("endDate", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Notes</label>
                <Textarea placeholder="Any general notes about the trip..." rows={3} value={form.notes} onChange={e => setField("notes", e.target.value)} />
              </div>
            </TabsContent>

            {/* ─ Traveller info ─ */}
            <TabsContent value="traveller" className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Personal Information</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Passport Number</label>
                  <Input placeholder="e.g. A1234567" value={form.travellerInfo.passportNumber || ""} onChange={e => setTraveller("passportNumber", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Nationality</label>
                  <Input placeholder="e.g. Indian" value={form.travellerInfo.nationality || ""} onChange={e => setTraveller("nationality", e.target.value)} />
                </div>
              </div>
              <div className="pt-2 border-t border-border/50 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emergency Contact</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Name</label>
                    <Input placeholder="Full name" value={form.travellerInfo.emergencyContactName || ""} onChange={e => setTraveller("emergencyContactName", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Phone</label>
                    <Input placeholder="+91..." value={form.travellerInfo.emergencyContactPhone || ""} onChange={e => setTraveller("emergencyContactPhone", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Relationship</label>
                  <Input placeholder="e.g. Spouse, Parent" value={form.travellerInfo.emergencyContactRelation || ""} onChange={e => setTraveller("emergencyContactRelation", e.target.value)} />
                </div>
              </div>
            </TabsContent>

            {/* ─ Medical info ─ */}
            <TabsContent value="medical" className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium">Medical Information</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Blood Type</label>
                  <Select value={form.medicalInfo.bloodType || ""} onValueChange={v => setMedical("bloodType", v)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {["A+","A-","B+","B-","AB+","AB-","O+","O-","Unknown"].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Insurance Provider</label>
                  <Input placeholder="e.g. Star Health" value={form.medicalInfo.insuranceProvider || ""} onChange={e => setMedical("insuranceProvider", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Insurance Policy Number</label>
                <Input placeholder="Policy / Card number" value={form.medicalInfo.insuranceNumber || ""} onChange={e => setMedical("insuranceNumber", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Medical Conditions</label>
                <Textarea placeholder="e.g. Diabetes, Hypertension" rows={2} value={form.medicalInfo.conditions || ""} onChange={e => setMedical("conditions", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Current Medications</label>
                <Textarea placeholder="e.g. Metformin 500mg, Aspirin" rows={2} value={form.medicalInfo.medications || ""} onChange={e => setMedical("medications", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Allergies</label>
                <Input placeholder="e.g. Penicillin, Shellfish" value={form.medicalInfo.allergies || ""} onChange={e => setMedical("allergies", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Doctor Name</label>
                  <Input placeholder="Dr. name" value={form.medicalInfo.doctorName || ""} onChange={e => setMedical("doctorName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Doctor Contact</label>
                  <Input placeholder="+91..." value={form.medicalInfo.doctorContact || ""} onChange={e => setMedical("doctorContact", e.target.value)} />
                </div>
              </div>
            </TabsContent>

            {/* ─ Itinerary + Attachments ─ */}
            <TabsContent value="itinerary" className="space-y-4">
              {/* CSV / text upload */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Upload Itinerary</span>
                  <span className="text-xs text-muted-foreground">(CSV or TXT)</span>
                </div>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => csvInputRef.current?.click()}
                >
                  <Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Click to upload CSV / TXT itinerary</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Expected CSV columns: date, time, title, location, type, description</p>
                </div>
                <input ref={csvInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSVUpload} />
              </div>

              {/* Parsed days preview */}
              {form.days.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{form.days.length} day(s) loaded:</p>
                  {form.days.map((day, di) => (
                    <Card key={di} className="p-3 text-xs">
                      <p className="font-medium">{day.date}</p>
                      {day.activities.map((act, ai) => (
                        <p key={ai} className="text-muted-foreground">· {act.time ? `${act.time} – ` : ""}{act.title}{act.location ? ` @ ${act.location}` : ""}</p>
                      ))}
                    </Card>
                  ))}
                  <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => setForm(f => ({ ...f, days: [] }))}>
                    <X className="w-3 h-3 mr-1" /> Clear itinerary
                  </Button>
                </div>
              )}

              {/* File attachments (PDFs, images, reports) */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Attachments</span>
                  <span className="text-xs text-muted-foreground">(PDF, images, medical reports – max 5 MB each)</span>
                </div>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => pdfInputRef.current?.click()}
                >
                  <Paperclip className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Click to attach files</p>
                </div>
                <input ref={pdfInputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="hidden" onChange={handleFileUpload} />

                {form.attachments.length > 0 && (
                  <div className="space-y-1">
                    {form.attachments.map((att, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-muted rounded text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
                          <span className="truncate">{att.name}</span>
                          <span className="text-muted-foreground flex-shrink-0">({(att.size / 1024).toFixed(0)} KB)</span>
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0" onClick={() => removeAttachment(i)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Save / Cancel */}
          <div className="flex gap-3 pt-2 border-t border-border/50">
            <Button variant="outline" className="flex-1" onClick={() => setView("list")}>Cancel</Button>
            <Button className="flex-1" disabled={saving} onClick={createTrip}>
              {saving ? "Saving…" : "Save Trip"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Trip detail view ────────────────────────────────────────────────────────

function TripDetail({ trip, onBack, onDelete }: { trip: Trip; onBack: () => void; onDelete: (id: string) => void }) {
  const [tab, setTab] = useState("overview")

  const downloadAttachment = (att: Attachment) => {
    const link = document.createElement("a")
    link.href = `data:${att.type};base64,${att.data}`
    link.download = att.name
    link.click()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h3 className="font-semibold text-base">{trip.title}</h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" /> {trip.destination}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium", STATUS_COLORS[trip.status])}>
            {STATUS_ICON[trip.status]} {trip.status}
          </span>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onDelete(trip._id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 h-10 text-xs">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="traveller">Traveller</TabsTrigger>
          <TabsTrigger value="medical">Medical</TabsTrigger>
          <TabsTrigger value="itinerary">Itinerary</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          <Card className="p-4 space-y-2 text-sm">
            <Row label="Destination" value={trip.destination} />
            <Row label="Start" value={fmtDate(trip.startDate)} />
            <Row label="End" value={fmtDate(trip.endDate)} />
            {trip.days && <Row label="Days" value={`${trip.days.length} days`} />}
            {trip.notes && <Row label="Notes" value={trip.notes} />}
          </Card>
          {trip.attachments && trip.attachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Attachments</p>
              {trip.attachments.map((att, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-muted rounded text-xs cursor-pointer hover:bg-muted/80" onClick={() => downloadAttachment(att)}>
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span>{att.name}</span>
                    <span className="text-muted-foreground">({(att.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <span className="text-primary text-xs">↓ Download</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="traveller" className="space-y-3">
          <Card className="p-4 space-y-2 text-sm">
            {trip.travellerInfo?.passportNumber && <Row label="Passport" value={trip.travellerInfo.passportNumber} />}
            {trip.travellerInfo?.nationality && <Row label="Nationality" value={trip.travellerInfo.nationality} />}
            {trip.travellerInfo?.emergencyContactName && (
              <>
                <div className="pt-2 border-t border-border/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emergency Contact</div>
                <Row label="Name" value={trip.travellerInfo.emergencyContactName} />
                <Row label="Phone" value={trip.travellerInfo.emergencyContactPhone || "-"} />
                <Row label="Relation" value={trip.travellerInfo.emergencyContactRelation || "-"} />
              </>
            )}
            {!trip.travellerInfo?.passportNumber && !trip.travellerInfo?.emergencyContactName && (
              <p className="text-muted-foreground text-xs">No traveller information saved.</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="medical" className="space-y-3">
          <Card className="p-4 space-y-2 text-sm">
            {trip.medicalInfo?.bloodType && <Row label="Blood Type" value={trip.medicalInfo.bloodType} highlight />}
            {trip.medicalInfo?.conditions && <Row label="Conditions" value={trip.medicalInfo.conditions} />}
            {trip.medicalInfo?.medications && <Row label="Medications" value={trip.medicalInfo.medications} />}
            {trip.medicalInfo?.allergies && <Row label="Allergies" value={trip.medicalInfo.allergies} highlight />}
            {trip.medicalInfo?.insuranceProvider && <Row label="Insurance" value={`${trip.medicalInfo.insuranceProvider} – ${trip.medicalInfo.insuranceNumber || ""}`} />}
            {trip.medicalInfo?.doctorName && <Row label="Doctor" value={`${trip.medicalInfo.doctorName} – ${trip.medicalInfo.doctorContact || ""}`} />}
            {!trip.medicalInfo?.bloodType && !trip.medicalInfo?.conditions && (
              <p className="text-muted-foreground text-xs">No medical information saved.</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="itinerary" className="space-y-3">
          {(!trip.days || trip.days.length === 0) ? (
            <Card className="p-6 text-center border-dashed">
              <p className="text-muted-foreground text-xs">No itinerary saved for this trip.</p>
            </Card>
          ) : (
            trip.days.map((day, di) => (
              <Card key={di} className="p-3">
                <p className="text-xs font-semibold mb-2 text-primary">{day.date}</p>
                {day.activities.length === 0 && <p className="text-xs text-muted-foreground">No activities.</p>}
                {day.activities.map((act, ai) => (
                  <div key={ai} className="flex items-start gap-2 py-1.5 border-t border-border/30 first:border-0">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 flex-shrink-0 mt-0.5">{act.type}</Badge>
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{act.time && <span className="text-muted-foreground mr-1">{act.time}</span>}{act.title}</p>
                      {act.location && <p className="text-xs text-muted-foreground">📍 {act.location}</p>}
                      {act.description && <p className="text-xs text-muted-foreground/70">{act.description}</p>}
                    </div>
                  </div>
                ))}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground flex-shrink-0 w-28 text-xs">{label}</span>
      <span className={cn("text-xs text-right flex-1", highlight && "font-semibold text-amber-600 dark:text-amber-400")}>{value}</span>
    </div>
  )
}
