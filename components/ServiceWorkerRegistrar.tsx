"use client"

import { useEffect } from "react"

const PWA_DISABLED = process.env.NEXT_PUBLIC_DISABLE_PWA === "true"

async function unregisterAll() {
  const regs = await navigator.serviceWorker.getRegistrations()
  await Promise.all(regs.map((reg) => reg.unregister()))
  if ("caches" in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    if (PWA_DISABLED) {
      // Actively tear down any worker/caches left behind from a session where
      // PWA was previously enabled (e.g. a different browser profile), rather
      // than just skipping registration — a stale worker keeps controlling the
      // tab and re-fetching pages under its own caching rules otherwise.
      unregisterAll().catch((err) => console.error("[SW] cleanup failed:", err))
      return
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => console.log("[SW] registered, scope:", reg.scope))
      .catch((err) => console.error("[SW] registration failed:", err))
  }, [])

  return null
}
