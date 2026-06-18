"use client"

import { useState } from "react"
import { toast } from "sonner"
import { getApiError } from "@/lib/api-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/format"

export type Person = { id: string; name: string; avatar: string | null }
export type Debt = { from: Person; to: Person; amount: number }

export function SettleUpModal({
  groupId,
  debt,
  currency,
  onClose,
  onSuccess,
}: {
  groupId: string
  debt: Debt
  currency: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [amount, setAmount] = useState(debt.amount.toFixed(2))
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const amountNum = Number(amount)
  const valid = amountNum > 0 && amountNum <= debt.amount + 0.01

  async function confirm() {
    setError(null)
    if (!(amountNum > 0)) {
      setError("Enter an amount greater than zero.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: debt.from.id,
          receiverId: debt.to.id,
          amount: Math.round(amountNum * 100) / 100,
          note: note.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const msg = await getApiError(res, "Could not record the settlement.")
        setError(msg)
        toast.error(msg)
        setSubmitting(false)
        return
      }
      onSuccess()
    } catch {
      setError("Something went wrong. Please try again.")
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Settle up</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{debt.from.name}</span>{" "}
          pays{" "}
          <span className="font-medium text-foreground">{debt.to.name}</span>.
          Outstanding: {formatMoney(debt.amount, currency)}.
        </p>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settle-amount">Amount</Label>
            <Input
              id="settle-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max={debt.amount.toFixed(2)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settle-note">Note (optional)</Label>
            <Input
              id="settle-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. paid via UPI"
              maxLength={500}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={submitting || !valid}>
              {submitting ? "Recording…" : "Confirm payment"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
