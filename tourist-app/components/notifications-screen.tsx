"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Bell, History, Settings, Filter } from "lucide-react"
import { NotificationSystem } from "./notification-system"

interface NotificationsScreenProps {
  onBack: () => void
}

export function NotificationsScreen({ onBack }: NotificationsScreenProps) {
  const [activeTab, setActiveTab] = useState("all")

  return (
    <div className="min-h-screen p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Notifications & Alerts</h1>
          <p className="text-sm text-muted-foreground">Stay informed about your safety</p>
        </div>
        <Button variant="ghost" size="icon" className="rounded-xl">
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      {/* Notification Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          <TabsTrigger value="all" className="flex items-center justify-center gap-1 text-xs px-2 py-2 min-h-[40px]">
            <Bell className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">All</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center justify-center gap-1 text-xs px-2 py-2 min-h-[40px]">
            <Filter className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center justify-center gap-1 text-xs px-2 py-2 min-h-[40px]">
            <History className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">History</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <NotificationSystem />
        </TabsContent>

        <TabsContent value="alerts">
          <Card className="card-elevated p-6">
            <h3 className="text-lg font-semibold mb-4">Active Safety Alerts</h3>
            <div className="space-y-4">
              <div className="card-3d bg-destructive/10 p-4 border border-destructive/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-destructive/20 rounded-xl flex items-center justify-center">
                    <Bell className="w-4 h-4 text-destructive" />
                  </div>
                  <div>
                    <h4 className="font-medium text-destructive">High-Risk Zone Alert</h4>
                    <p className="text-sm text-muted-foreground">Active monitoring in your current area</p>
                  </div>
                </div>
              </div>
              <div className="card-3d bg-secondary/10 p-4 border border-secondary/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-secondary/20 rounded-xl flex items-center justify-center">
                    <Bell className="w-4 h-4 text-secondary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-secondary">Route Monitoring</h4>
                    <p className="text-sm text-muted-foreground">AI tracking your planned itinerary</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="card-elevated p-6">
            <h3 className="text-lg font-semibold mb-4">Notification History</h3>
            <div className="space-y-3">
              {[
                { time: "2 hours ago", message: "Safety score updated to 85", type: "info" },
                { time: "4 hours ago", message: "Entered safe zone - Tourist Hub", type: "success" },
                { time: "6 hours ago", message: "Trip tracking started", type: "info" },
                { time: "1 day ago", message: "Emergency contact added", type: "success" },
                { time: "2 days ago", message: "Profile verification completed", type: "success" },
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 card-3d">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      item.type === "success"
                        ? "bg-primary"
                        : item.type === "warning"
                          ? "bg-secondary"
                          : item.type === "error"
                            ? "bg-destructive"
                            : "bg-muted-foreground"
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-sm">{item.message}</p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
