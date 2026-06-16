"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserSearch, type SearchUser } from "@/components/fab/UserSearch"
import {
  SplitTypeSelector,
  type SplitState,
} from "@/components/expenses/SplitTypeSelector"

function today() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10)
}

/**
 * Create a DIRECT (non-group) expense. `mode` controls how many other people
 * can be added: "person" = exactly one, "anyone" = many. The current user is
 * always a participant.
 */
export type DirectExpenseInitial = {
  description?: string
  amount?: number
  date?: string
  payerId?: string
  others?: SearchUser[]
}

export function DirectExpenseForm({
  currentUser,
  mode,
  initial,
  onSuccess,
  onCancel,
}: {
  currentUser: { id: string; name: string }
  mode: "person" | "anyone" | "solo"
  initial?: DirectExpenseInitial
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const [others, setOthers] = useState<SearchUser[]>(initial?.others ?? [])
  const [description, setDescription] = useState(initial?.description ?? "")
  const [amount, setAmount] = useState(
    initial?.amount != null ? String(initial.amount) : ""
  )
  const [payerId, setPayerId] = useState(initial?.payerId ?? currentUser.id)
  const [date, setDate] = useState(initial?.date ?? today())
  const [split, setSplit] = useState<SplitState>({
    splitType: "EQUAL",
    values: {},
    valid: true,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSolo = mode === "solo"
  const participants = [{ id: currentUser.id, name: isSolo ? currentUser.name : `${currentUser.name} (you)` }, ...others]
  const amountNum = Number(amount)
  const validAmount = amountNum > 0 && amountNum <= 999999.99
  const canSubmit =
    (isSolo || others.length >= 1) && description.trim() && validAmount && split.valid && !submitting

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isSolo && others.length === 0) {
      setError("Add at least one other person.")
      return
    }
    if (!validAmount) {
      setError("Enter an amount between 0.01 and 999999.99.")
      return
    }
    if (!split.valid) {
      setError("Check the split — it doesn't add up yet.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          amount: Math.round(amountNum * 100) / 100,
          payerId,
          participantIds: split.splitType === "EQUAL" && split.equalMemberIds && split.equalMemberIds.length < participants.length
            ? split.equalMemberIds
            : participants.map((p) => p.id),
          splitType: split.splitType,
          date: new Date(date).toISOString(),
          ...(split.splitType !== "EQUAL" ? { values: split.values } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        const msg = data?.error ?? "Could not save the expense."
        setError(msg)
        toast.error(msg)
        setSubmitting(false)
        return
      }
      toast.success("Expense added ✓")
      onSuccess?.()
    } catch {
      setError("Something went wrong.")
      toast.error("Something went wrong.")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isSolo && (
        <div className="space-y-2">
          <Label>{mode === "person" ? "With" : "Participants"}</Label>
          <UserSearch
            selected={others}
            onChange={setOthers}
            multi={mode === "anyone"}
            excludeIds={[currentUser.id]}
            showSuggestions
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="d-desc">Description</Label>
        <Input
          id="d-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Dinner, cab, movie…"
          maxLength={100}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="d-amount">Amount</Label>
          <Input
            id="d-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max="999999.99"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        {!isSolo && (
          <div className="space-y-2">
            <Label htmlFor="d-payer">Paid by</Label>
            <select
              id="d-payer"
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              className={selectClass}
            >
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="d-date">Date</Label>
        <Input
          id="d-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      {!isSolo && others.length >= 1 && (
        <div className="space-y-2">
          <Label>Split</Label>
          <SplitTypeSelector
            members={participants}
            amount={validAmount ? amountNum : 0}
            onChange={setSplit}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={!canSubmit}>
          {submitting ? "Saving…" : "Add expense"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
