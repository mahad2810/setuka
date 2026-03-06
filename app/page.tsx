"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Shield } from "lucide-react"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to landing page
    router.push('/auth')
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Shield className="w-8 h-8 text-emerald-500" />
        </div>
        <p className="text-muted-foreground">Redirecting to SetUva...</p>
      </div>
    </div>
  )
}