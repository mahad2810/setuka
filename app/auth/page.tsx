"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Shield, ArrowLeft, Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation"
import { AuthForms } from "@/components/auth-forms"
import { useSession } from "@/lib/session-context"

export default function AuthPage() {
  const router = useRouter()
  const { isAuthenticated } = useSession()
  const [showPassword, setShowPassword] = useState(false)

  // Check if user is already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  const handleAuthSuccess = (userData: any) => {
    // Redirect to dashboard after successful authentication
    router.push('/dashboard')
  }

  const handleBack = () => {
    router.push('/landing')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        <div className="flex items-center gap-2">
          <img
            src="/SetUva-logo.png"
            alt="SetUva Logo"
            className="w-8 h-8 object-cover rounded-xl"
          />
          <span className="text-xl font-bold bg-gradient-to-r from-emerald-500 to-blue-500 bg-clip-text text-transparent">
            Setuka
          </span>
        </div>

        <div className="w-16 sm:w-20"></div> {/* Spacer for centering logo */}
      </div>

      {/* Auth Forms Container */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <AuthForms
            onBack={handleBack}
            onSuccess={handleAuthSuccess}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 sm:p-6 text-center">
        <p className="text-xs sm:text-sm text-muted-foreground">
          By continuing, you agree to our{" "}
          <a href="#" className="text-primary hover:underline">Terms of Service</a>{" "}
          and{" "}
          <a href="#" className="text-primary hover:underline">Privacy Policy</a>
        </p>
      </div>
    </div>
  )
}