"use client"

import { Button } from "@/components/ui/button"
import { Phone, MapPin, Shield, Users, Navigation, MessageCircle, Camera, FileText } from "lucide-react"

interface QuickActionsProps {
  onPanicPress: () => void
  onTrackTrip: () => void
  onPoliceUnits: () => void
  onProfile: () => void
}

export function QuickActions({ onPanicPress, onTrackTrip, onPoliceUnits, onProfile }: QuickActionsProps) {
  return (
    <div className="space-y-4">
      {/* Primary Emergency Action */}
      <Button
        onClick={onPanicPress}
        className="w-full h-16 bg-destructive hover:bg-destructive/90 shadow-[0_0_30px_rgba(255,68,68,0.4)] text-lg font-bold rounded-2xl"
        size="lg"
      >
        <div className="flex items-center gap-3">
          <Phone className="w-6 h-6" />
          <span>EMERGENCY SOS</span>
        </div>
      </Button>

      {/* Secondary Actions Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={onTrackTrip}
          variant="outline"
          className="h-16 flex-col gap-2 card-3d rounded-2xl"
          size="lg"
        >
          <Navigation className="w-5 h-5" />
          <span className="text-sm">Track Trip</span>
        </Button>

        <Button
          onClick={onPoliceUnits}
          variant="outline"
          className="h-16 flex-col gap-2 card-3d rounded-2xl"
          size="lg"
        >
          <Shield className="w-5 h-5" />
          <span className="text-sm">Police Units</span>
        </Button>

        <Button
          variant="outline"
          className="h-16 flex-col gap-2 card-3d rounded-2xl"
          size="lg"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm">Help Chat</span>
        </Button>

        <Button
          onClick={onProfile}
          variant="outline"
          className="h-16 flex-col gap-2 card-3d rounded-2xl"
          size="lg"
        >
          <FileText className="w-5 h-5" />
          <span className="text-sm">Profile</span>
        </Button>
      </div>

      {/* Additional Quick Actions */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="ghost"
          className="h-12 flex-col gap-1 card-3d rounded-xl"
          size="sm"
        >
          <Camera className="w-4 h-4" />
          <span className="text-xs">Report</span>
        </Button>

        <Button
          variant="ghost"
          className="h-12 flex-col gap-1 card-3d rounded-xl"
          size="sm"
        >
          <Users className="w-4 h-4" />
          <span className="text-xs">Contacts</span>
        </Button>

        <Button
          variant="ghost"
          className="h-12 flex-col gap-1 card-3d rounded-xl"
          size="sm"
        >
          <MapPin className="w-4 h-4" />
          <span className="text-xs">Nearby</span>
        </Button>
      </div>
    </div>
  )
}
