"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Clock, X, Bell, Shield, Navigation, Activity } from "lucide-react"

interface Notification {
  id: string
  type: "safety" | "route" | "zone" | "activity" | "system"
  title: string
  message: string
  timestamp: Date
  priority: "high" | "medium" | "low"
  read: boolean
  actionRequired?: boolean
}

interface NotificationSystemProps {
  className?: string
}

export function NotificationSystem({ className }: NotificationSystemProps) {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      type: "zone",
      title: "Entering High-Risk Area",
      message: "You are approaching a zone with increased safety concerns. Exercise caution.",
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      priority: "high",
      read: false,
      actionRequired: true,
    },
    {
      id: "2",
      type: "route",
      title: "Route Deviation Detected",
      message: "AI detected deviation from planned route. Confirm if this is intentional.",
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      priority: "medium",
      read: false,
      actionRequired: true,
    },
    {
      id: "3",
      type: "activity",
      title: "Prolonged Inactivity",
      message: "No movement detected for 30 minutes. Are you safe?",
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      priority: "high",
      read: true,
      actionRequired: false,
    },
    {
      id: "4",
      type: "safety",
      title: "Safety Score Updated",
      message: "Your area safety score has improved to 85/100.",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      priority: "low",
      read: true,
    },
    {
      id: "5",
      type: "system",
      title: "Emergency Contact Added",
      message: "New emergency contact has been successfully added to your profile.",
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      priority: "low",
      read: true,
    },
  ])

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif)))
  }

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id))
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "safety":
        return Shield
      case "route":
        return Navigation
      case "zone":
        return MapPin
      case "activity":
        return Activity
      case "system":
        return Bell
      default:
        return Bell
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-destructive/30 bg-destructive/10"
      case "medium":
        return "border-secondary/30 bg-secondary/10"
      case "low":
        return "border-muted/30 bg-muted/10"
      default:
        return "border-muted/30 bg-muted/10"
    }
  }

  const getPriorityTextColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-destructive"
      case "medium":
        return "text-secondary"
      case "low":
        return "text-muted-foreground"
      default:
        return "text-muted-foreground"
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
              {unreadCount} new
            </Badge>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.map((notification) => {
          const IconComponent = getNotificationIcon(notification.type)
          return (
            <Card
              key={notification.id}
              className={`bg-card border p-4 ${getPriorityColor(notification.priority)} ${
                !notification.read ? "ring-1 ring-primary/20" : ""
              } rounded-lg`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    notification.priority === "high"
                      ? "bg-destructive/20"
                      : notification.priority === "medium"
                        ? "bg-secondary/20"
                        : "bg-muted/20"
                  }`}
                >
                  <IconComponent className={`w-4 h-4 ${getPriorityTextColor(notification.priority)}`} />
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className={`font-medium ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>
                        {notification.title}
                      </h4>
                      <p className={`text-sm ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>
                        {notification.message}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissNotification(notification.id)}
                      className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>
                        {notification.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <Badge variant="outline" className={`text-xs ${getPriorityColor(notification.priority)}`}>
                        {notification.priority}
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      {notification.actionRequired && (
                        <Button size="sm" className="h-6 text-xs bg-primary hover:bg-primary/90">
                          Respond
                        </Button>
                      )}
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notification.id)}
                          className="h-6 text-xs"
                        >
                          Mark Read
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {notifications.length === 0 && (
        <Card className="card-3d rounded-xl p-8 text-center">
          <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No notifications</p>
          <p className="text-sm text-muted-foreground">You're all caught up!</p>
        </Card>
      )}
    </div>
  )
}
