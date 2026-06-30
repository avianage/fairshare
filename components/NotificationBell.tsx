"use client"

import { useEffect, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { Bell, BellOff, Receipt, Handshake, UserPlus, Users, Check, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"

interface Notification {
  id: string
  type: string
  title: string
  body: string
  url: string | null
  read: boolean
  createdAt: string
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

function typeIcon(type: string) {
  switch (type) {
    case "expense_added": return <Receipt className="h-4 w-4 text-blue-500" />
    case "settlement": return <Handshake className="h-4 w-4 text-green-500" />
    case "friend_request": return <UserPlus className="h-4 w-4 text-purple-500" />
    case "friend_accepted": return <UserPlus className="h-4 w-4 text-green-500" />
    case "group_join": return <Users className="h-4 w-4 text-orange-500" />
    default: return <Bell className="h-4 w-4 text-muted-foreground" />
  }
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Mobile drawer states
  const [isMobile, setIsMobile] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Push subscription state
  const [pushSupported, setPushSupported] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, 15_000)

    const handler = () => fetchNotifications()
    window.addEventListener("fairshare:expense-changed", handler)

    return () => {
      clearInterval(id)
      window.removeEventListener("fairshare:expense-changed", handler)
    }
  }, [fetchNotifications])

  // Check screen size and set mounted state on client side
  useEffect(() => {
    setMounted(true)
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    
    // Check push support
    if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator) {
      setPushSupported(true)
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => setPushSubscribed(!!sub))
      }).catch(() => null)
    }

    return () => {
      window.removeEventListener("resize", checkMobile)
    }
  }, [])

  // Slide-up drawer animation trigger
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
      const timer = setTimeout(() => {
        setShowDrawer(true)
      }, 10)
      return () => {
        clearTimeout(timer)
      }
    } else {
      document.body.style.overflow = ""
      setShowDrawer(false)
    }
  }, [mobileOpen])

  const handleCloseDrawer = useCallback(() => {
    setShowDrawer(false)
    document.body.style.overflow = ""
    const timer = setTimeout(() => {
      setMobileOpen(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.read) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      })
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    if (n.url) {
      if (isMobile) {
        handleCloseDrawer()
      } else {
        setOpen(false)
      }
      router.push(n.url)
    }
  }

  async function togglePush() {
    if (pushBusy) return
    setPushBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      if (pushSubscribed) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch("/api/notifications/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await sub.unsubscribe()
        }
        setPushSubscribed(false)
        toast.success("Push notifications disabled.")
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== "granted") { toast.error("Notification permission denied."); return }
        const keyRes = await fetch("/api/notifications/vapid-public-key")
        if (!keyRes.ok) { toast.error("Push notifications not available."); return }
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
        setPushSubscribed(true)
        toast.success("Push notifications enabled!")
      }
    } catch {
      toast.error("Something went wrong. Try again.")
    } finally {
      setPushBusy(false)
    }
  }

  const renderMobileDrawer = () => {
    if (!mounted || !mobileOpen) return null

    return createPortal(
      <div
        className={`fixed inset-0 z-[100] flex h-full w-full flex-col bg-background transition-transform duration-300 ease-out pb-safe ${
          showDrawer ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4 shadow-sm bg-card">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 active:scale-95 transition-all"
              >
                <Check className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
            {pushSupported && (
              <button
                onClick={togglePush}
                disabled={pushBusy}
                title={pushSubscribed ? "Disable push notifications" : "Enable push notifications"}
                className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground active:scale-95 transition-all disabled:opacity-50"
                aria-label={pushSubscribed ? "Disable push notifications" : "Enable push notifications"}
              >
                {pushSubscribed ? <Bell className="h-4 w-4 fill-current text-primary" /> : <BellOff className="h-4 w-4" />}
              </button>
            )}
            <button
              onClick={handleCloseDrawer}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground active:scale-95 transition-all"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
              <div className="rounded-full bg-muted/40 p-4">
                <Bell className="h-12 w-12 opacity-40 text-muted-foreground" />
              </div>
              <p className="text-base font-semibold">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`flex w-full items-start gap-4 rounded-xl px-4 py-4 text-left transition-all active:bg-accent/80 border ${
                    !n.read ? "bg-primary/5 border-primary/15 shadow-sm" : "bg-card border-border hover:bg-accent/40"
                  }`}
                >
                  <div className="mt-0.5 shrink-0 rounded-xl bg-background p-2.5 border border-border shadow-sm">
                    {typeIcon(n.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className={`truncate text-sm ${!n.read ? "font-bold text-foreground" : "font-semibold text-muted-foreground"}`}>
                        {n.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-muted-foreground font-semibold">
                        {relativeTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground/95 leading-relaxed">{n.body}</p>
                  </div>
                  {!n.read && (
                    <span className="mt-3 shrink-0 block h-2.5 w-2.5 rounded-full bg-primary shadow-sm shadow-primary/45" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>,
      document.body
    )
  }

  if (mounted && isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-card/50 text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground hover:border-primary/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
        {renderMobileDrawer()}
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-card/50 text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground hover:border-primary/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Check className="h-3 w-3" />
                Mark all read
              </button>
            )}
            {pushSupported && (
              <button
                onClick={togglePush}
                disabled={pushBusy}
                title={pushSubscribed ? "Disable push notifications" : "Enable push notifications"}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                aria-label={pushSubscribed ? "Disable push notifications" : "Enable push notifications"}
              >
                {pushSubscribed ? <Bell className="h-3.5 w-3.5 fill-current" /> : <BellOff className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <Bell className="h-8 w-8 opacity-30" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent ${!n.read ? "bg-primary/5" : ""}`}
              >
                <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${!n.read ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[10px] text-muted-foreground">{relativeTime(n.createdAt)}</span>
                  {!n.read && <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-primary ml-auto" />}
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
