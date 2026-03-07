"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, X, MapPin, Navigation, Shield } from "lucide-react"

interface LiveAlert {
  id: string
  type: "danger-zone" | "safe-zone" | "route-change" | "emergency"
  title: string
  message: string
  location?: string
  actionButtons?: { label: string; action: string; variant?: "default" | "destructive" | "outline" }[]
}

interface LiveAlertPopupProps {
  alert: LiveAlert | null
  onDismiss: () => void
  onAction: (action: string) => void
}

export function LiveAlertPopup({ alert, onDismiss, onAction }: LiveAlertPopupProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (alert) {
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }
  }, [alert])

  if (!alert || !isVisible) return null

  const getAlertStyle = (type: string) => {
    switch (type) {
      case "danger-zone":
        return "border-destructive/50 bg-destructive/10 emergency-glow"
      case "safe-zone":
        return "border-primary/50 bg-primary/10 neon-glow"
      case "route-change":
        return "border-secondary/50 bg-secondary/10"
      case "emergency":
        return "border-destructive/50 bg-destructive/20 emergency-glow"
      default:
        return "border-muted/50 bg-muted/10"
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "danger-zone":
        return <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
      case "safe-zone":
        return <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
      case "route-change":
        return <Navigation className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
      case "emergency":
        return <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-destructive animate-pulse" />
      default:
        return <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-background/80">
      <Card
        className={`bg-card border-2 p-3 sm:p-6 max-w-sm sm:max-w-md w-full mx-2 sm:mx-0 ${getAlertStyle(alert.type)} animate-in slide-in-from-top-4 duration-300 rounded-xl shadow-lg`}
      >
        <div className="space-y-3 sm:space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="flex-shrink-0">
                {getAlertIcon(alert.type)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-lg font-semibold leading-tight">{alert.title}</h3>
                {alert.location && (
                  <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{alert.location}</span>
                  </div>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onDismiss} className="h-6 w-6 p-0 flex-shrink-0 ml-2">
              <X className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </div>

          {/* Message */}
          <p className="text-xs sm:text-sm text-pretty leading-relaxed">{alert.message}</p>

          {/* Action Buttons */}
          {alert.actionButtons && alert.actionButtons.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {alert.actionButtons.map((button, index) => (
                <Button
                  key={index}
                  variant={button.variant || "default"}
                  onClick={() => onAction(button.action)}
                  size="sm"
                  className={`flex-1 text-xs sm:text-sm h-8 sm:h-auto ${
                    button.variant === "destructive"
                      ? "emergency-glow"
                      : button.variant === "default"
                        ? "neon-glow"
                        : ""
                  }`}
                >
                  <span className="truncate">{button.label}</span>
                </Button>
              ))}
            </div>
          )}

          {/* Default dismiss button if no action buttons */}
          {(!alert.actionButtons || alert.actionButtons.length === 0) && (
            <Button onClick={onDismiss} className="w-full text-xs sm:text-sm h-8 sm:h-auto">
              Acknowledge
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
