"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Shield, MapPin, Clock, Users, Activity, AlertTriangle } from "lucide-react"
import { useLocation } from "@/lib/location-context"

interface SafetyMetricsData {
  areaSafety: number
  routeSecurity: number
  responseTime: number
  touristDensity: number
  crimeLevel: number
  accidentRisk: number
  lightingQuality: number
}

export function SafetyMetrics() {
  const { currentLocation, safetyData, isCalculatingSafety } = useLocation()
  const [metricsData, setMetricsData] = useState<SafetyMetricsData>({
    areaSafety: 85,
    routeSecurity: 92,
    responseTime: 78,
    touristDensity: 65,
    crimeLevel: 5,
    accidentRisk: 3,
    lightingQuality: 8
  })

  // Update metrics when safety data changes
  useEffect(() => {
    if (safetyData) {
      const road = safetyData.road ?? 5
      setMetricsData({
        areaSafety: safetyData.score,
        routeSecurity: safetyData.score,
        responseTime: Math.max(40, 90 - (safetyData.crime ?? 5) * 5),
        touristDensity: 55,
        crimeLevel: safetyData.crime ?? 0,
        accidentRisk: safetyData.accident ?? 0,
        lightingQuality: road,
      })
    }
  }, [safetyData])

  const metrics = [
    { 
      label: "Area Safety", 
      value: Math.round(metricsData.areaSafety), 
      icon: Shield, 
      color: metricsData.areaSafety >= 70 ? "text-green-600" : metricsData.areaSafety >= 40 ? "text-amber-600" : "text-red-600",
      description: safetyData?.riskLevel ? `${safetyData.riskLevel} risk` : "Based on local data"
    },
    { 
      label: "Route Security", 
      value: Math.round(metricsData.routeSecurity), 
      icon: MapPin, 
      color: metricsData.routeSecurity >= 70 ? "text-green-600" : metricsData.routeSecurity >= 40 ? "text-amber-600" : "text-red-600",
      description: "Route safety analysis"
    },
    { 
      label: "Emergency Response", 
      value: Math.round(metricsData.responseTime), 
      icon: Clock, 
      color: metricsData.responseTime >= 70 ? "text-green-600" : metricsData.responseTime >= 40 ? "text-amber-600" : "text-red-600",
      description: "Response time estimate"
    },
    { 
      label: "Tourist Activity", 
      value: Math.round(metricsData.touristDensity), 
      icon: Users, 
      color: "text-blue-600",
      description: "Area popularity"
    },
  ]

  const riskFactors = [
    {
      label: "Crime Level",
      value: metricsData.crimeLevel,
      max: 10,
      icon: AlertTriangle,
      color: metricsData.crimeLevel <= 3 ? "text-green-600" : metricsData.crimeLevel <= 6 ? "text-amber-600" : "text-red-600"
    },
    {
      label: "Accident Risk",
      value: metricsData.accidentRisk,
      max: 10,
      icon: Activity,
      color: metricsData.accidentRisk <= 3 ? "text-green-600" : metricsData.accidentRisk <= 6 ? "text-amber-600" : "text-red-600"
    },
    {
      label: "Road Quality",
      value: metricsData.lightingQuality,
      max: 10,
      icon: Shield,
      color: metricsData.lightingQuality >= 7 ? "text-green-600" : metricsData.lightingQuality >= 4 ? "text-amber-600" : "text-red-600"
    }
  ]

  return (
    <div className="space-y-6">
      {/* Main Safety Metrics */}
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((metric, index) => (
          <Card
            key={index}
            className="bg-card/40 backdrop-blur-xl border border-border/60 rounded-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <metric.icon className={`w-5 h-5 ${metric.color}`} />
                <span className="text-2xl font-bold">{metric.value}</span>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">{metric.label}</p>
                <Progress value={metric.value} className="h-2" />
                <p className="text-xs text-muted-foreground">{metric.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Risk Factors Detail */}
      {safetyData && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Risk Factor Analysis
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {riskFactors.map((factor, index) => (
              <Card
                key={index}
                className="bg-card/40 backdrop-blur-xl border border-border/60 rounded-lg p-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <factor.icon className={`w-4 h-4 ${factor.color}`} />
                    <span className="text-sm font-bold">{factor.value}/{factor.max}</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium">{factor.label}</p>
                    <Progress value={(factor.value / factor.max) * 100} className="h-1" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Analysis Section */}


      {/* Loading State */}
      {isCalculatingSafety && (
        <Card className="bg-card/40 backdrop-blur-xl border border-border/60 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-primary animate-spin" />
            <div>
              <p className="text-sm font-medium">Analyzing Location Safety</p>
              <p className="text-xs text-muted-foreground">Processing real-time data...</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}