"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff } from "lucide-react"
import { toast } from "sonner"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function PushSubscriber() {
  const [subscribed, setSubscribed] = useState(false)
  const [supported, setSupported] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return
    setSupported(true)

    // Check if already subscribed
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub)
      })
    }).catch(() => null)
  }, [])

  if (!supported) return null

  async function toggle() {
    if (busy) return
    setBusy(true)

    try {
      const reg = await navigator.serviceWorker.ready

      if (subscribed) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch("/api/notifications/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await sub.unsubscribe()
        }
        setSubscribed(false)
        toast.success("Push notifications disabled.")
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== "granted") {
          toast.error("Notification permission denied.")
          setBusy(false)
          return
        }

        const keyRes = await fetch("/api/notifications/vapid-public-key")
        if (!keyRes.ok) {
          toast.error("Push notifications not available.")
          setBusy(false)
          return
        }
        const { publicKey } = await keyRes.json()

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
        })

        const json = sub.toJSON()
        await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          }),
        })

        setSubscribed(true)
        toast.success("Push notifications enabled!")
      }
    } catch {
      toast.error("Something went wrong. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={subscribed ? "Disable notifications" : "Enable notifications"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-card/50 text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground hover:border-primary/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:opacity-50"
      aria-label={subscribed ? "Disable push notifications" : "Enable push notifications"}
    >
      {subscribed ? <Bell className="h-4 w-4 fill-current" /> : <BellOff className="h-4 w-4" />}
    </button>
  )
}
