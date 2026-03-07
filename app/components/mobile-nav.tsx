"use client"

import { Bell, Home, Map, User2, Activity, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export type DashboardTab = "overview" | "map" | "safety" | "actions"

interface MobileNavProps {
  active: DashboardTab
  onSelectTab: (tab: DashboardTab) => void
  onNotifications: () => void
  onProfile: () => void
  unreadNotifications?: number
  className?: string
}

export function MobileNav({
  active,
  onSelectTab,
  onNotifications,
  onProfile,
  unreadNotifications = 0,
  className,
}: MobileNavProps) {
  const navItems = [
    {
      id: "overview" as DashboardTab,
      icon: Home,
      label: "Overview",
    },
    {
      id: "map" as DashboardTab,
      icon: Map,
      label: "Map",
    },
    {
      id: "safety" as DashboardTab,
      icon: Shield,
      label: "Safety",
    },
    {
      id: "actions" as DashboardTab,
      icon: Activity,
      label: "Actions",
    }
  ]

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-background shadow-lg",
        "pb-4 pt-2 safe-area-pb",
        className,
      )}
    >
      <div className="mx-auto max-w-md px-2">
        <div className="flex items-center justify-around gap-1">
          {navItems.map((item) => {
            const isActive = active === item.id
            const Icon = item.icon
            
            return (
              <Button
                key={item.id}
                variant="ghost"
                size="sm"
                onClick={() => onSelectTab(item.id)}
                className={cn(
                  "flex flex-col items-center gap-1 h-auto py-2 px-2 min-w-0 flex-1",
                  "hover:bg-muted/50 transition-colors",
                  isActive && "bg-primary/10 text-primary"
                )}
              >
                <Icon className={cn(
                  "w-5 h-5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </Button>
            )
          })}
          
          {/* Notifications Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onNotifications}
            className="flex flex-col items-center gap-1 h-auto py-2 px-2 min-w-0 hover:bg-muted/50 transition-colors relative flex-1"
          >
            <div className="relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              {unreadNotifications > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-4 w-4 p-0 text-xs flex items-center justify-center min-w-4"
                >
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </Badge>
              )}
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              Alerts
            </span>
          </Button>

          {/* Profile Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onProfile}
            className="flex flex-col items-center gap-1 h-auto py-2 px-2 min-w-0 hover:bg-muted/50 transition-colors flex-1"
          >
            <User2 className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Profile
            </span>
          </Button>
        </div>
      </div>
    </nav>
  )
}
