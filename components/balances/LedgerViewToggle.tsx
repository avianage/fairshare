"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

export function LedgerViewToggle() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isGlobal = searchParams.get("view") !== "group"

  useEffect(() => {
    const refresh = () => router.refresh()
    window.addEventListener("fairshare:friendship-changed", refresh)
    const interval = setInterval(refresh, 30_000)
    return () => {
      window.removeEventListener("fairshare:friendship-changed", refresh)
      clearInterval(interval)
    }
  }, [router])

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card p-1 w-fit text-sm">
      <button
        type="button"
        onClick={() => router.push("/ledger")}
        className={cn(
          "rounded-md px-3 py-1.5 transition-colors",
          isGlobal
            ? "bg-primary text-primary-foreground font-medium shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Global
      </button>
      <button
        type="button"
        onClick={() => router.push("/ledger?view=group")}
        className={cn(
          "rounded-md px-3 py-1.5 transition-colors",
          !isGlobal
            ? "bg-primary text-primary-foreground font-medium shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Group-specific
      </button>
    </div>
  )
}
