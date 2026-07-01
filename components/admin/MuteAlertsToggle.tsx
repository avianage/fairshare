"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, BellOff } from "lucide-react"
import { cn } from "@/lib/utils"

export function MuteAlertsToggle({ initialMuted }: { initialMuted: boolean }) {
  const router = useRouter()
  const [muted, setMuted] = useState(initialMuted)
  const [isLoading, setIsLoading] = useState(false)

  async function toggle() {
    const next = !muted
    setMuted(next)
    setIsLoading(true)
    try {
      const res = await fetch("/api/admin/mute-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted: next }),
      })
      if (!res.ok) throw new Error("failed")
      router.refresh()
    } catch {
      setMuted(!next) // revert on failure
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isLoading}
      title={
        muted
          ? "Security alert push notifications are muted for you. Click to unmute."
          : "Mute security alert push notifications for yourself (the audit log is unaffected)."
      }
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors self-start sm:self-auto disabled:opacity-60",
        muted
          ? "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {muted ? <BellOff className="h-4 w-4 shrink-0" /> : <Bell className="h-4 w-4 shrink-0" />}
      <span className="whitespace-nowrap">{muted ? "Alerts muted" : "Mute alerts"}</span>
    </button>
  )
}
