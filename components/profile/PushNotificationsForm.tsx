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

export function PushNotificationsForm() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return
    setSupported(true)
    setPermission(Notification.permission)
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => null)
  }, [])

  if (!supported) return null

  async function enable() {
    if (busy) return
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== "granted") {
        toast.error("Permission denied. Enable notifications in your browser settings.")
        return
      }
      const reg = await navigator.serviceWorker.ready
      const keyRes = await fetch("/api/notifications/vapid-public-key")
      if (!keyRes.ok) { toast.error("Push notifications are not available right now."); return }
      const { publicKey } = await keyRes.json()
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      })
      const json = sub.toJSON()
      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth } }),
      })
      setSubscribed(true)
      localStorage.removeItem("notif-prompt-dismissed")
      toast.success("Push notifications enabled!")
    } catch (err) {
      console.error("[PushNotif]", err)
      toast.error("Something went wrong. Try again.")
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    if (busy) return
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
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
    } catch {
      toast.error("Something went wrong. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Push Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Receive alerts on this device when someone adds an expense, pays you, or sends a friend request.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${subscribed ? "bg-green-500/10" : "bg-muted"}`}>
              {subscribed
                ? <Bell className="h-4 w-4 text-green-600" />
                : <BellOff className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div>
              <p className="text-sm font-medium">
                {subscribed ? "Notifications are on" : "Notifications are off"}
              </p>
              <p className="text-xs text-muted-foreground">
                {permission === "denied"
                  ? "Blocked by browser — enable in site settings to proceed."
                  : subscribed
                  ? "You will receive push alerts on this device."
                  : "You won't receive any push alerts on this device."}
              </p>
            </div>
          </div>

          {permission === "denied" ? (
            <span className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive">
              Blocked
            </span>
          ) : subscribed ? (
            <button
              onClick={disable}
              disabled={busy}
              className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
            >
              {busy ? "Disabling…" : "Disable"}
            </button>
          ) : (
            <button
              onClick={enable}
              disabled={busy}
              className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Enabling…" : "Enable"}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
