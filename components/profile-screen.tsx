"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, User, Settings, Shield, Bell, MapPin, Lock, MapPinned, HeartPulse, FileText, Info } from "lucide-react"
import { TripManager } from "@/components/trip-manager"

interface ProfileScreenProps {
  user: {
    name: string
    email: string
    phone?: string
  } | null
  onBack: () => void
  onLogout: () => void
}

export function ProfileScreen({ user, onBack, onLogout }: ProfileScreenProps) {
  const [activeTab, setActiveTab] = useState("profile")

  // Privacy permission states — persisted to localStorage
  const [locationTracking, setLocationTracking] = useState(true)
  const [digitalIdEmergency, setDigitalIdEmergency] = useState(true)
  const [legalDataUse, setLegalDataUse] = useState(false)
  const [permissionsSaved, setPermissionsSaved] = useState(false)

  // Load saved preferences on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('privacy_permissions')
      if (saved) {
        const prefs = JSON.parse(saved)
        setLocationTracking(prefs.locationTracking ?? true)
        setDigitalIdEmergency(prefs.digitalIdEmergency ?? true)
        setLegalDataUse(prefs.legalDataUse ?? false)
      }
    } catch {}
  }, [])

  const savePermissions = () => {
    localStorage.setItem('privacy_permissions', JSON.stringify({
      locationTracking,
      digitalIdEmergency,
      legalDataUse,
      updatedAt: new Date().toISOString()
    }))
    setPermissionsSaved(true)
    setTimeout(() => setPermissionsSaved(false), 3000)
  }

  if (!user) return null

  return (
    <div className="min-h-screen p-4 space-y-6 elderly-friendly">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="lg"
          onClick={onBack}
          className="card-elevated consistent-radius h-12 w-12 p-0"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Profile & Digital ID</h1>
          <p className="text-lg text-muted-foreground">Manage your tourist identity</p>
        </div>
      </div>

      {/* Profile Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 card-elevated card-aligned h-14 p-1">
          <TabsTrigger value="profile" className="flex items-center justify-center gap-1 text-sm px-2 py-2 h-12 consistent-radius">
            <User className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="trips" className="flex items-center justify-center gap-1 text-sm px-2 py-2 h-12 consistent-radius">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Trips</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center justify-center gap-1 text-sm px-2 py-2 h-12 consistent-radius">
            <Settings className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          {/* Profile Overview */}
          <Card className="card-elevated card-aligned p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-primary/10 dark:bg-primary/20 border-2 border-primary/20 dark:border-primary/30 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                <span className="text-2xl sm:text-3xl font-bold text-primary">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </span>
              </div>
              <div className="text-center sm:text-left flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl font-semibold truncate">{user.name}</h2>
                <p className="text-muted-foreground truncate">{user.email}</p>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary">Verified Tourist</span>
                </div>
              </div>
            </div>

            {/* Profile Stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="text-center card-3d p-2 sm:p-4">
                <div className="text-lg sm:text-2xl font-bold text-primary">5</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Trips</div>
              </div>
              <div className="text-center card-3d p-2 sm:p-4">
                <div className="text-lg sm:text-2xl font-bold text-secondary">12</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Cities</div>
              </div>
              <div className="text-center card-3d p-2 sm:p-4">
                <div className="text-lg sm:text-2xl font-bold text-accent">85</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Safety Score</div>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-16 flex-col gap-2"
            >
              <Bell className="w-5 h-5" />
              <span className="text-sm">Notifications</span>
            </Button>
            <Button
              variant="outline"
              className="h-16 flex-col gap-2"
            >
              <Shield className="w-5 h-5" />
              <span className="text-sm">Safety Settings</span>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="trips" className="space-y-4">
          <TripManager />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          {/* Settings Options */}
          <Card className="bg-card border border-border rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Account Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg">
                <div>
                  <p className="font-medium">Language</p>
                  <p className="text-sm text-muted-foreground">English</p>
                </div>
                <Button variant="ghost" size="sm">
                  Change
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg">
                <div>
                  <p className="font-medium">Emergency Contacts</p>
                  <p className="text-sm text-muted-foreground">2 contacts added</p>
                </div>
                <Button variant="ghost" size="sm">
                  Manage
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg">
                <div>
                  <p className="font-medium">Location Sharing</p>
                  <p className="text-sm text-muted-foreground">Enabled for safety</p>
                </div>
                <Button variant="ghost" size="sm">
                  Configure
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg">
                <div>
                  <p className="font-medium">Privacy Settings</p>
                  <p className="text-sm text-muted-foreground">Standard protection</p>
                </div>
                <Button variant="ghost" size="sm">
                  Review
                </Button>
              </div>
            </div>
          </Card>

          {/* Privacy & Safety Permissions */}
          <Card className="bg-card border border-border rounded-xl p-6 shadow-lg space-y-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Privacy &amp; Safety Permissions</h3>
                <p className="text-xs text-muted-foreground">Control how your data is used for your protection</p>
              </div>
            </div>

            {/* Info banner */}
            <div className="flex gap-3 p-3 bg-blue-500/8 border border-blue-500/20 rounded-lg">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                SetUva collects only the data you explicitly allow below. These permissions help authorities assist you in emergencies. You can change them at any time.
              </p>
            </div>

            {/* Permission 1 — Live Location Tracking */}
            <div className="flex items-start justify-between gap-4 p-4 bg-muted/50 border border-border rounded-xl">
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPinned className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">Live Location Tracking</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Your real-time GPS coordinates are shared with the tourist authority safety dashboard. This allows authorities to monitor your whereabouts, send alerts for unsafe zones, and dispatch help if you do not check in.
                  </p>
                  <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${locationTracking ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                    {locationTracking ? 'Active — Sharing with Authority Dashboard' : 'Disabled — Location not shared'}
                  </span>
                </div>
              </div>
              <Switch
                checked={locationTracking}
                onCheckedChange={setLocationTracking}
                className="flex-shrink-0 mt-1"
              />
            </div>

            {/* Permission 2 — Digital ID for Medical Emergencies */}
            <div className="flex items-start justify-between gap-4 p-4 bg-muted/50 border border-border rounded-xl">
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <HeartPulse className="w-4 h-4 text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">Digital ID — Medical Emergency Use</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    If you are found unconscious or incapacitated, your Digital ID data (blood type, allergies, medications, emergency contacts, insurance) stored in SetUva may be accessed by authorised medical personnel to provide immediate and informed treatment.
                  </p>
                  <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${digitalIdEmergency ? 'bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-muted text-muted-foreground'}`}>
                    {digitalIdEmergency ? 'Allowed — Medical personnel may access' : 'Disabled — Data will not be shared'}
                  </span>
                </div>
              </div>
              <Switch
                checked={digitalIdEmergency}
                onCheckedChange={setDigitalIdEmergency}
                className="flex-shrink-0 mt-1"
              />
            </div>

            {/* Permission 3 — Legal / Administrative Use */}
            <div className="flex items-start justify-between gap-4 p-4 bg-muted/50 border border-border rounded-xl">
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText className="w-4 h-4 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">Digital ID — Legal &amp; Administrative Use</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Your Digital ID, travel history, and location data may be used by authorised government or legal authorities for immigration, legal identification, or administrative procedures in the event of an emergency, accident, or legal requirement.
                  </p>
                  <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${legalDataUse ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
                    {legalDataUse ? 'Allowed — Legal authorities may access' : 'Disabled — Not shared with legal bodies'}
                  </span>
                </div>
              </div>
              <Switch
                checked={legalDataUse}
                onCheckedChange={setLegalDataUse}
                className="flex-shrink-0 mt-1"
              />
            </div>

            <Button
              className="w-full h-11"
              onClick={savePermissions}
              variant={permissionsSaved ? 'outline' : 'default'}
            >
              {permissionsSaved ? '✓ Permissions Saved' : 'Save Privacy Preferences'}
            </Button>
          </Card>

          {/* Danger Zone */}
          <Card className="bg-card border border-destructive/50 rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-destructive">Danger Zone</h3>
            <div className="space-y-4">
              <Button
                variant="destructive"
                className="w-full h-11"
                onClick={onLogout}
              >
                Log Out
              </Button>
              <Button
                variant="outline"
                className="w-full bg-card border border-destructive text-destructive hover:bg-destructive/10"
              >
                Delete Account
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
