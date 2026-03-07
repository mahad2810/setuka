"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { Shield, Bell, Globe, Smartphone, Zap, Lock, User, Settings, TrendingUp, Clock, MapPin, Heart, Star, ChevronRight, Download, CheckCircle, Menu, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { usePWAInstall } from "@/hooks/use-pwa-install"

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const router = useRouter()
  const { canInstall, isInstalled, isIOS, installApp, isMounted } = usePWAInstall()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleInstallApp = () => {
    if (isIOS) {
      // For iOS, show instructions
      alert('To install this app on iOS:\n\n1. Tap the Share button (square with arrow)\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" to confirm')
    } else {
      // For Android/Desktop, use the install prompt
      installApp()
    }
  }

  return (
    <div className="min-h-screen bg-background elderly-friendly">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-background border-b border-border' : 'bg-background'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <img
                src="/SetUva-logo.png"
                alt="SetUva Logo"
                className="w-8 h-8 object-cover rounded-xl"
              />
              <span className="text-xl font-bold bg-gradient-to-r from-emerald-500 to-blue-500 bg-clip-text text-transparent">
                SetUva
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm font-medium hover:text-primary transition-colors">How It Works</a>
              <a href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">Pricing</a>
              <a href="#contact" className="text-sm font-medium hover:text-primary transition-colors">Contact</a>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="h-9 w-9"
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>

            {/* Desktop Auth Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <ThemeToggle />
              <Button
                variant="ghost"
                onClick={() => router.push('/auth')}
                className="text-sm font-medium h-12 px-6"
              >
                Login
              </Button>
              <Button
                onClick={() => router.push('/auth')}
                className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white h-12 px-6"
              >
                Get Started
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-border bg-background">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <a href="#features" className="block px-3 py-2 text-sm font-medium hover:text-primary transition-colors">Features</a>
                <a href="#how-it-works" className="block px-3 py-2 text-sm font-medium hover:text-primary transition-colors">How It Works</a>
                <a href="#pricing" className="block px-3 py-2 text-sm font-medium hover:text-primary transition-colors">Pricing</a>
                <a href="#contact" className="block px-3 py-2 text-sm font-medium hover:text-primary transition-colors">Contact</a>
                <div className="pt-4 pb-2 border-t border-border space-y-2">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm font-medium">Theme</span>
                    <ThemeToggle />
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => router.push('/auth')}
                    className="w-full justify-start h-12"
                  >
                    Login
                  </Button>
                  <Button
                    onClick={() => router.push('/auth')}
                    className="w-full bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white h-12"
                  >
                    Get Started
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-12 px-4 sm:pt-32 sm:pb-16">
        <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8">
          {/* Hero Icon */}
          <div className="relative inline-block">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.3)] animate-pulse p-2">
              <img
                src="/SetUva-logo.png"
                alt="SetUva Logo"
                className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-2xl"
              />
            </div>
            <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 bg-emerald-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
            </div>
          </div>

          {/* Hero Text */}
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold bg-gradient-to-r from-emerald-500 to-blue-500 bg-clip-text text-transparent leading-tight">
              Travel Safely,<br />Explore Fearlessly
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed px-4">
              AI-powered safety monitoring and emergency response system for tourists.
              Get real-time alerts, emergency assistance, and peace of mind while exploring new destinations.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 sm:gap-6 max-w-lg mx-auto pt-6 sm:pt-8">
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-emerald-500">50K+</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Safe Travelers</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-blue-500">24/7</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Support</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-purple-500">150+</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Countries</div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-6 sm:pt-8 px-4">
            <Button
              onClick={() => router.push('/auth')}
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 shadow-[0_0_20px_rgba(16,185,129,0.3)] text-white font-medium px-6 sm:px-8 h-12"
            >
              Get Started Free
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              onClick={canInstall && !isInstalled ? handleInstallApp : () => router.push('/auth')}
              variant="outline"
              size="lg"
              className="border-border hover:bg-muted px-6 sm:px-8 h-12"
            >
              <Download className="w-4 h-4 mr-2" />
              {!isMounted ? 'Download App' : isInstalled ? 'App Installed ✓' : canInstall ? 'Download App' : 'Use Web App'}
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 sm:py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Why Choose SetUva?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto px-4">
              Advanced technology meets human care to ensure your safety while traveling
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Feature 1 */}
            <Card className="p-4 sm:p-6 card-elevated hover:shadow-lg transition-all duration-300">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 dark:bg-emerald-500 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 dark:text-white" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">Real-time Tracking</h3>
              <p className="text-muted-foreground text-sm">
                Advanced GPS monitoring with AI-powered risk assessment for your current location
              </p>
            </Card>

            {/* Feature 2 */}
            <Card className="p-4 sm:p-6 card-elevated hover:shadow-lg transition-all duration-300">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 dark:bg-red-500 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-white" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">Emergency SOS</h3>
              <p className="text-muted-foreground text-sm">
                One-tap emergency alerts to local authorities and your emergency contacts
              </p>
            </Card>



            {/* Feature 4 */}
            <Card className="p-4 sm:p-6 card-elevated hover:shadow-lg transition-all duration-300">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-500 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-white" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">Smart Alerts</h3>
              <p className="text-muted-foreground text-sm">
                Proactive notifications about safety conditions, weather, and local events
              </p>
            </Card>

            {/* Feature 5 */}
            <Card className="p-4 sm:p-6 card-elevated hover:shadow-lg transition-all duration-300">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">Global Coverage</h3>
              <p className="text-muted-foreground text-sm">
                Works in 150+ countries with local emergency services integration
              </p>
            </Card>

            {/* Feature 6 */}
            <Card className="p-4 sm:p-6 card-elevated hover:shadow-lg transition-all duration-300">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">Offline Support</h3>
              <p className="text-muted-foreground text-sm">
                Critical features work even without internet connection for remote areas
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-12 sm:py-16 px-4 bg-muted">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto px-4">
              Three simple steps to start your safe journey
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Step 1 */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-full flex items-center justify-center mx-auto">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold">Sign Up</h3>
              <p className="text-muted-foreground text-sm px-4">
                Create your account to access safety features and alerts
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold">Enable Tracking</h3>
              <p className="text-muted-foreground text-sm px-4">
                Allow location access for real-time safety monitoring and emergency response
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold">Travel Safely</h3>
              <p className="text-muted-foreground text-sm px-4">
                Explore with confidence knowing help is just one tap away
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-6 sm:space-y-8">
          <h2 className="text-2xl sm:text-3xl font-bold">Ready to Travel Safely?</h2>
          <p className="text-muted-foreground px-4">
            Join thousands of travelers who trust SetUva for their security and peace of mind
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            <Button
              onClick={() => router.push('/auth')}
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 shadow-[0_0_20px_rgba(16,185,129,0.3)] text-white font-medium px-6 sm:px-8 h-12"
            >
              Start Your Safe Journey
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold bg-gradient-to-r from-emerald-500 to-blue-500 bg-clip-text text-transparent">
                SetUva
              </span>
            </div>
            <div className="text-sm text-muted-foreground text-center sm:text-right">
              © 2025 SetUva. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}