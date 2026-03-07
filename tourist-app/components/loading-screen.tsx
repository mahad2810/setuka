import { Shield } from "lucide-react"

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-blue-500/5 to-purple-500/10" />
      <div className="absolute top-20 left-10 w-32 h-32 bg-emerald-400/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl animate-pulse delay-1000" />

      {/* Loading Content */}
      <div className="relative z-10 text-center space-y-6">
        <div className="relative">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center shadow-lg animate-pulse mx-auto">
            <Shield className="w-10 h-10 text-emerald-500 animate-pulse" />
          </div>
          <div className="absolute inset-0 border-2 border-primary/30 rounded-full animate-ping" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-blue-500 bg-clip-text text-transparent">
            setuka
          </h1>
          <p className="text-muted-foreground animate-pulse">
            Securing your journey...
          </p>
        </div>

        {/* Loading Animation */}
        <div className="flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100" />
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-200" />
        </div>
      </div>
    </div>
  )
}
