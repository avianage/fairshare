"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getApiError } from "@/lib/api-error"
import { formatINR } from "@/lib/format"
import { Button } from "@/components/ui/button"
import type { ContextualDebt } from "@/lib/globalBalances"

function ContextLabel({ groupId, groupName }: { groupId: string | null; groupName: string | null }) {
  if (groupId === null) return <span>Direct expenses</span>
  return <span>{groupName ?? "Group"}</span>
}

export function GlobalSettleModal({
  counterpartyId,
  counterpartyName,
  onClose,
}: {
  counterpartyId: string
  counterpartyName: string
  onClose: () => void
}) {
  const router = useRouter()
  const [debts, setDebts] = useState<ContextualDebt[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string | null>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stable key for a context row
  const rowKey = (d: ContextualDebt) => d.groupId ?? "__direct__"

  useEffect(() => {
    fetch(`/api/global-settle?with=${counterpartyId}`)
      .then((r) => r.json())
      .then((data: ContextualDebt[]) => {
        // Only show contexts where you owe them
        const owing = data.filter((d) => d.amount > 0)
        setDebts(owing)
        // Pre-select all by default
        setSelected(new Set(owing.map((d) => d.groupId)))
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        setError("Could not load debt breakdown.")
      })
  }, [counterpartyId])

  function toggle(groupId: string | null) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const selectedDebts = debts.filter((d) => selected.has(d.groupId))
  const total = selectedDebts.reduce((s, d) => s + d.amount, 0)
  const canSubmit = selectedDebts.length > 0 && !submitting

  async function confirm() {
    setError(null)
    setSubmitting(true)
    const res = await fetch("/api/global-settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        counterpartyId,
        contexts: selectedDebts.map((d) => ({
          groupId: d.groupId,
          amount: d.amount,
        })),
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const msg = await getApiError(res, "Could not record settlement.")
      setError(msg)
      toast.error(msg)
      return
    }
    toast.success("Settlement recorded")
    onClose()
    router.refresh()
    window.dispatchEvent(new CustomEvent("fairshare:expense-changed", { detail: {} }))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Settle up with {counterpartyName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select which balances to clear. Full amount per context.
        </p>

        <div className="mt-5 space-y-2">
          {loading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : debts.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nothing to settle right now.
            </p>
          ) : (
            debts.map((d) => {
              const key = rowKey(d)
              const checked = selected.has(d.groupId)
              return (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={checked}
                    onChange={() => toggle(d.groupId)}
                  />
                  <span className="flex-1 text-sm font-medium">
                    <ContextLabel groupId={d.groupId} groupName={d.groupName} />
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-warning">
                    {formatINR(d.amount)}
                  </span>
                </label>
              )
            })
          )}
        </div>

        {debts.length > 0 && !loading && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-sm text-muted-foreground">Total to pay</span>
            <span className="font-semibold tabular-nums">{formatINR(Math.round(total * 100) / 100)}</span>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!canSubmit || debts.length === 0 || loading}>
            {submitting ? "Recording…" : "Confirm payment"}
          </Button>
        </div>
      </div>
    </div>
  )
}
