import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { Toaster } from "@/components/ui/toaster"
import { SessionProvider } from "@/lib/session-context"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

export const metadata: Metadata = {
  title: "Setuka - Smart Tourist Safety Monitoring",
  description: "AI-powered safety monitoring and incident response system for tourists. Travel safely with real-time alerts, emergency assistance, and blockchain-secured digital identity.",
  generator: "v0.app",
  manifest: "/manifest.json",
  keywords: "tourist safety, travel security, emergency response, AI monitoring",
  authors: [{ name: "Setuka Team" }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Setuka",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/SetUva-logo.png", sizes: "192x192", type: "image/png" },
      { url: "/SetUva-logo.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/SetUva-logo.png", sizes: "192x192", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Setuka - Smart Tourist Safety Monitoring",
    description: "AI-powered safety monitoring and incident response system for tourists",
    type: "website",
    locale: "en_US",
    siteName: "Setuka",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1f2937",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="Setuka" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Setuka" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#1f2937" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* iOS Specific Meta Tags */}
        <meta name="apple-touch-fullscreen" content="yes" />
        <meta name="apple-mobile-web-app-orientations" content="portrait" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="format-detection" content="address=no" />
        <meta name="format-detection" content="email=no" />
        <meta name="apple-itunes-app" content="app-id=, app-argument=" />

        {/* Viewport for iOS */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />

        {/* Icons */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/SetUva-logo.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/SetUva-logo.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/SetUva-logo.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/SetUva-logo.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/SetUva-logo.png" />
        <link rel="mask-icon" href="/SetUva-logo.png" color="#1f2937" />

        {/* iOS Splash Screens */}
        <link rel="apple-touch-startup-image" href="/SetUva-logo.png" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)" />
        <link rel="apple-touch-startup-image" href="/SetUva-logo.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" />
        <link rel="apple-touch-startup-image" href="/SetUva-logo.png" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/SetUva-logo.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/SetUva-logo.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" />
        <link rel="apple-touch-startup-image" href="/SetUva-logo.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)" />
      </head>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={true}
          disableTransitionOnChange={false}
        >
          <SessionProvider>
            <Suspense fallback={null}>{children}</Suspense>
          </SessionProvider>
          <Analytics />
          <Toaster />
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw-enhanced.js')
                    .then(function(registration) {
                      console.log('Enhanced SW registered: ', registration);
                      
                      // Register for periodic sync if supported
                      if ('periodicSync' in registration) {
                        return registration.periodicSync.register('location-tracking', {
                          minInterval: 30 * 1000 // 30 seconds
                        });
                      }
                    })
                    .then(function() {
                      console.log('Periodic sync registered for location tracking');
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
