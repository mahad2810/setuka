"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Phone, MapPin, Users, ArrowLeft, AlertTriangle, Clock, Zap } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useSession } from "@/lib/session-context"
import { useLocation } from "@/lib/location-context"

interface EmergencySOSProps {
  user: { name: string; email: string } | null
  onBack: () => void
}

export function EmergencySOS({ user, onBack }: EmergencySOSProps) {
  const [sosActive, setSosActive] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [emergencyContacts, setEmergencyContacts] = useState([
    { name: "Local Police", number: "100", type: "police" },
    { name: "Tourist Helpline", number: "1363", type: "helpline" },
    { name: "Emergency Services", number: "108", type: "medical" },
  ])
  const [locationShared, setLocationShared] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const { toast } = useToast()
  const sessionCtx = useSession()
  const sessionUser = sessionCtx?.user as any
  const { currentLocation } = useLocation()

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (sosActive && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    } else if (sosActive && countdown === 0) {
      // Activate emergency response
      triggerSOS()
    }
    return () => clearTimeout(timer)
  }, [sosActive, countdown])

  const handleSOSPress = () => {
    setSosActive(true)
    setCountdown(5)
  }

  const handleCancel = () => {
    setSosActive(false)
    setCountdown(5)
    setLocationShared(false)
  }

  const triggerSOS = async () => {
    try {
      setIsSending(true)
      const coords = currentLocation
      const payload = {
        message: "User activated SOS. Please assist immediately.",
        user: {
          name: user?.name || sessionUser?.name,
          email: user?.email || sessionUser?.email,

        },
        location: coords ? { lat: coords.lat, lng: coords.lng } : undefined,
        // contacts intentionally omitted; server uses static destination number
        callPolice: true,
      }

      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to send SOS')
      }

      setLocationShared(true)
      const smsSummary = Array.isArray(data?.sms)
        ? data.sms.map((s: any) => `${s.to}: ${s.status}${s.error ? ` (${s.error})` : ''}`).join('; ')
        : 'No SMS data'
      const callSummary = data?.call ? `Call: ${data.call.status}${data.call.error ? ` (${data.call.error})` : ''}` : ''
      toast({ title: 'SOS sent', description: `${smsSummary}. ${callSummary}` })
    } catch (e: any) {
      toast({ title: 'Failed to send SOS', description: e?.message || 'Please try again.', variant: 'destructive' as any })
    } finally {
      setIsSending(false)
    }
  }

  const handleCallEmergency = (number: string) => {
    // Try to open the device dialer
    if (typeof window !== 'undefined') {
      window.location.href = `tel:${number}`
    }
  }

  return (
    <div className="min-h-screen p-4 space-y-6 elderly-friendly">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="lg"
          onClick={onBack}
          className="card-elevated consistent-radius h-14 w-14 p-0"
        >
          <ArrowLeft className="w-7 h-7" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-destructive">Emergency SOS</h1>
          <p className="text-lg text-muted-foreground">Immediate help when you need it</p>
        </div>
      </div>

      {/* SOS Status */}
      {sosActive && (
        <Card className="card-elevated rounded-2xl p-6 mb-6 border-destructive/30">
          <div className="text-center space-y-4">
            <div className="mx-auto w-20 h-20 bg-destructive/20 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(255,68,68,0.4)] animate-pulse">
              <AlertTriangle className="w-10 h-10 text-destructive" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-destructive">SOS ACTIVATED</h2>
              {countdown > 0 ? (
                <p className="text-lg">Emergency call in {countdown} seconds</p>
              ) : isSending ? (
                <p className="text-lg">Sending SOS...</p>
              ) : (
                <p className="text-lg text-primary">Emergency services contacted</p>
              )}
            </div>
            {countdown > 0 && (
              <Button
                onClick={handleCancel}
                variant="outline"
                className="card-3d rounded-2xl"
              >
                Cancel Emergency
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Main SOS Button */}
      {!sosActive && (
        <div className="flex-1 flex items-center justify-center mb-8">
          <div className="text-center space-y-6">
            <div className="relative">
              <Button
                onClick={handleSOSPress}
                className="relative z-10 w-56 h-56 rounded-full bg-destructive hover:bg-destructive/90 shadow-[0_0_40px_rgba(255,68,68,0.6)] text-white text-3xl font-bold consistent-radius"
                size="lg"
              >
                <div className="flex flex-col items-center gap-4">
                  <Phone className="w-16 h-16" />
                  <span className="text-4xl">SOS</span>
                  <span className="text-lg font-normal">EMERGENCY</span>
                </div>
              </Button>
              <div className="absolute inset-0 rounded-full border-4 border-destructive/30 animate-ping pointer-events-none z-0" />
            </div>
            <p className="text-lg text-muted-foreground max-w-sm">
              Press to activate emergency response and contact authorities
            </p>
          </div>
        </div>
      )}

      {/* Location Status */}
      <Card className="card-elevated rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium">Location Status</p>
              <p className="text-sm text-muted-foreground">
                {locationShared ? "Shared with emergency services" : "Ready to share"}
              </p>
            </div>
          </div>
          <Badge variant={locationShared ? "default" : "secondary"} className={locationShared ? "bg-primary" : ""}>
            {locationShared ? "Active" : "Standby"}
          </Badge>
        </div>
        {locationShared && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Location updated 30 seconds ago</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="w-4 h-4" />
              <span>Real-time tracking enabled</span>
            </div>
          </div>
        )}
      </Card>

      {/* Emergency Contacts */}
      <Card className="card-elevated rounded-2xl p-4 mb-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Emergency Contacts
        </h3>
        <div className="space-y-3">
          {emergencyContacts.map((contact, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 card-3d rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${contact.type === "police"
                    ? "bg-primary/20"
                    : contact.type === "medical"
                      ? "bg-destructive/20"
                      : "bg-secondary/20"
                    }`}
                >
                  {contact.type === "police" ? "🚔" : contact.type === "medical" ? "🚑" : "📞"}
                </div>
                <div>
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">{contact.number}</p>
                </div>
              </div>
              <Button
                onClick={() => handleCallEmergency(contact.number)}
                className="bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(0,255,136,0.3)] rounded-xl"
                size="sm"
              >
                Call
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* User Info */}
      <Card className="card-elevated rounded-2xl p-4">
        <h3 className="font-semibold mb-3">Your Information</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name:</span>
            <span>{user?.name || "Tourist User"}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Location:</span>
            <span>Delhi, India</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant="secondary" className="bg-primary/20 text-primary">
              Tourist
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  )
}
