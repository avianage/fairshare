import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { InstallPrompt } from "@/components/InstallPrompt"
import { ThemedToaster } from "@/components/ThemedToaster"
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Fairshare",
  description: "Split expenses fairly with friends and groups",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fairshare",
  },
  // mobile-web-app-capable isn't a first-class metadata field; add it manually.
  other: { "mobile-web-app-capable": "yes" },
}

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <ThemedToaster />
        <InstallPrompt />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
