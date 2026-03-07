'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

export default function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const listenersAttached = useRef(false)

  useEffect(() => {
    if (listenersAttached.current) return

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallBanner(true)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setShowInstallBanner(false)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
      window.addEventListener('appinstalled', handleAppInstalled)
      listenersAttached.current = true
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
        window.removeEventListener('appinstalled', handleAppInstalled)
        listenersAttached.current = false
      }
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setShowInstallBanner(false)
      }
    } catch (error) {
      console.log('Install prompt failed:', error)
    }
  }

  const dismissBanner = () => {
    setShowInstallBanner(false)
  }

  if (!showInstallBanner || !deferredPrompt) {
    return null
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 rounded-lg shadow-lg flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <Download className="h-5 w-5" />
        <div>
          <p className="font-semibold text-sm">Install SetUva App</p>
          <p className="text-xs opacity-90">Get quick access and offline features</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          onClick={handleInstallClick}
          size="sm"
          variant="secondary"
          className="bg-white text-blue-800 hover:bg-gray-100"
        >
          Install
        </Button>
        <Button
          onClick={dismissBanner}
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
