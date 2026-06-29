"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SettleUpModal, type Debt } from "@/components/balances/SettleUpModal"
import { formatMoney } from "@/lib/format"

type BalancesResponse = {
  debts: Debt[]
  memberBalances: { user: { id: string; name: string }; netBalance: number }[]
  isSettledUp: boolean
}

export function BalanceSummary({
  groupId,
  currency,
  currentUserId,
}: {
  groupId: string
  currency: string
  currentUserId: string
}) {
  const router = useRouter()
  const [data, setData] = useState<BalancesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settling, setSettling] = useState<Debt | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/groups/${groupId}/ledger`, {
        cache: "no-store",
      })
      if (!res.ok) {
        setError("Could not load balances.")
        return
      }
      setData(await res.json())
    } catch {
      setError("Could not load balances.")
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    load()
  }, [load])

  // Refresh when any expense or settlement changes on this group page.
  useEffect(() => {
    const handler = (e: Event) => {
      const { groupId: gid } = (e as CustomEvent).detail ?? {}
      if (gid && gid !== groupId) return
      load()
    }
    window.addEventListener("fairshare:expense-changed", handler)
    return () => window.removeEventListener("fairshare:expense-changed", handler)
  }, [groupId, load])

  // Poll every 30 s to pick up changes from other users.
  useEffect(() => {
    const id = setInterval(load, 15_000)
    return () => clearInterval(id)
  }, [load])

  if (loading) {
    return (
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border bg-card shadow-sm p-4 text-sm text-destructive">
        {error ?? "Could not load balances."}
      </div>
    )
  }

  if (data.isSettledUp) {
    return (
      <div className="rounded-xl border bg-card shadow-sm p-6 text-center">
        <p className="text-sm font-medium">All settled up! 🎉</p>
        <p className="mt-1 text-xs text-muted-foreground">
          No outstanding balances in this group.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <h2 className="border-b px-4 py-3 text-sm font-medium text-muted-foreground">
        Balances
      </h2>
      <ul className="divide-y">
        {data.debts.map((debt, idx) => {
          const iOwe = debt.from.id === currentUserId
          const owedToMe = debt.to.id === currentUserId

          let label: React.ReactNode
          let amountClass: string
          if (iOwe) {
            label = (
              <>
                You owe <span className="font-semibold text-primary">{debt.to.name}</span>
              </>
            )
            amountClass = "text-warning"
          } else if (owedToMe) {
            label = (
              <>
                <span className="font-semibold text-primary">{debt.from.name}</span> owes you
              </>
            )
            amountClass = "text-success"
          } else {
            label = (
              <>
                <span className="font-semibold text-primary">{debt.from.name}</span> owes{" "}
                <span className="font-semibold text-primary">{debt.to.name}</span>
              </>
            )
            amountClass = "text-foreground"
          }

          return (
            <li
              key={`${debt.from.id}-${debt.to.id}-${idx}`}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 text-sm">
                <p className="truncate">{label}</p>
                <p className={`text-base font-semibold ${amountClass}`}>
                  {formatMoney(debt.amount, currency)}
                </p>
              </div>
              {iOwe && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSettling(debt)}
                >
                  Settle up
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      {settling && (
        <SettleUpModal
          groupId={groupId}
          debt={settling}
          currency={currency}
          onClose={() => setSettling(null)}
          onSuccess={() => {
            setSettling(null)
            toast.success("Settlement recorded.")
            load()
            router.refresh()
            window.dispatchEvent(
              new CustomEvent("fairshare:expense-changed", { detail: { groupId } })
            )
          }}
        />
      )}
    </div>
  )
}
