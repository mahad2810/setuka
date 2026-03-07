"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, Eye, EyeOff, Fingerprint, QrCode, ArrowLeft } from "lucide-react"

interface AuthFormsProps {
  onBack: () => void
  onSuccess: (user: { name: string; email: string; digitalId: string }) => void
}

export function AuthForms({ onBack, onSuccess }: AuthFormsProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    nationality: "",
    passportNumber: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      // Store token in localStorage
      localStorage.setItem('token', data.token)
      
      onSuccess({
        name: data.user.name,
        email: data.user.email,
        digitalId: data.user.digitalId,
      })
    } catch (error) {
      console.error('Login error:', error)
      // You can add toast notifications here
      alert(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          nationality: formData.nationality,
          passportNumber: formData.passportNumber,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed')
      }

      // Store token in localStorage
      localStorage.setItem('token', data.token)
      
      onSuccess({
        name: data.user.name,
        email: data.user.email,
        digitalId: data.user.digitalId,
      })
    } catch (error) {
      console.error('Signup error:', error)
      // You can add toast notifications here
      alert(error instanceof Error ? error.message : 'Signup failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-blue-500/5 to-purple-500/10" />
      <div className="absolute top-20 left-10 w-32 h-32 bg-emerald-400/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative z-10 p-4 flex flex-col min-h-screen">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 pt-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="bg-card/30 backdrop-blur-md border border-border/50 hover:bg-card/50"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Welcome to Setuka</h1>
            <p className="text-sm text-muted-foreground">Secure your digital travel identity</p>
          </div>
        </div>

        {/* Auth Forms */}
        <div className="flex-1 flex items-center justify-center pb-8">
          <Card className="card-elevated rounded-2xl p-8 w-full max-w-md shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <Tabs defaultValue="login" className="space-y-8">
              <TabsList className="grid w-full grid-cols-2 bg-card/30 backdrop-blur-md border border-border/50 h-12 gap-1">
                <TabsTrigger 
                  value="login" 
                  className="text-sm font-medium truncate min-w-0 px-2 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  Login
                </TabsTrigger>
                <TabsTrigger 
                  value="signup" 
                  className="text-sm font-medium truncate min-w-0 px-2 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-6">
                <div className="text-center space-y-3">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)] p-2">
                    <img 
                      src="/SetUva-logo.png" 
                      alt="Setuka Logo" 
                      className="w-12 h-12 object-cover rounded-xl"
                    />
                  </div>
                  <h2 className="text-xl font-bold">Welcome Back</h2>
                  <p className="text-sm text-muted-foreground">Access your digital tourist ID</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="tourist@example.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="bg-card/30 backdrop-blur-md border border-border/50 h-11 focus:border-emerald-500/50 transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={(e) => handleInputChange("password", e.target.value)}
                        className="bg-card/30 backdrop-blur-md border border-border/50 h-11 pr-10 focus:border-emerald-500/50 transition-colors"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 h-11 font-medium shadow-lg" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Authenticating..." : "Login to SetUva"}
                  </Button>

                  <div className="bg-card/30 backdrop-blur-md border border-border/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Fingerprint className="w-4 h-4" />
                      <span>Your data is encrypted and blockchain-secured</span>
                    </div>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-6">
                <div className="text-center space-y-3">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)] p-2">
                    <img 
                      src="/SetUva-logo.png" 
                      alt="Setuka Logo" 
                      className="w-12 h-12 object-cover rounded-xl"
                    />
                  </div>
                  <h2 className="text-xl font-bold">Create Your Digital ID</h2>
                  <p className="text-sm text-muted-foreground">Join the future of secure travel</p>
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        className="bg-card/30 backdrop-blur-md border border-border/50 h-11 focus:border-blue-500/50 transition-colors"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-sm font-medium">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        className="bg-card/30 backdrop-blur-md border border-border/50 h-11 focus:border-blue-500/50 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium">Phone (Optional)</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        className="bg-card/30 backdrop-blur-md border border-border/50 h-11 focus:border-blue-500/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nationality" className="text-sm font-medium">Nationality (Optional)</Label>
                      <Input
                        id="nationality"
                        type="text"
                        placeholder="e.g., American, Indian, British"
                        value={formData.nationality}
                        onChange={(e) => handleInputChange("nationality", e.target.value)}
                        className="bg-card/30 backdrop-blur-md border border-border/50 h-11 focus:border-blue-500/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="passport" className="text-sm font-medium">Passport Number (Optional)</Label>
                    <Input
                      id="passport"
                      type="text"
                      placeholder="A12345678"
                      value={formData.passportNumber}
                      onChange={(e) => handleInputChange("passportNumber", e.target.value)}
                      className="bg-card/30 backdrop-blur-md border border-border/50 h-11 focus:border-blue-500/50 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-sm font-medium">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Create password"
                        value={formData.password}
                        onChange={(e) => handleInputChange("password", e.target.value)}
                        className="bg-card/30 backdrop-blur-md border border-border/50 h-11 focus:border-blue-500/50 transition-colors"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="Confirm password"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                        className="bg-card/30 backdrop-blur-md border border-border/50 h-11 focus:border-blue-500/50 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 h-11 font-medium shadow-lg" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating Digital ID..." : "Create Digital Tourist ID"}
                  </Button>

                  <div className="bg-card/30 backdrop-blur-md border border-border/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <QrCode className="w-4 h-4" />
                      <span>Your ID will be blockchain-verified and secure</span>
                    </div>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  )
}
