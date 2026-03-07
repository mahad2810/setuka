'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Info } from 'lucide-react'

export default function PWADevNote() {
  const [isDev, setIsDev] = useState(false)

  useEffect(() => {
    setIsDev(process.env.NODE_ENV === 'development')
  }, [])

  if (!isDev) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Badge variant="outline" className="flex items-center gap-2 px-3 py-2 bg-background border border-border">
        <Info className="h-4 w-4" />
        <span>PWA features available in production build</span>
      </Badge>
    </div>
  )
}
