"use client"

import { useState } from "react"
import { toast } from "sonner"
import { getApiError } from "@/lib/api-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { CategorySelect } from "@/components/expenses/CategorySelect"
import {
  SplitTypeSelector,
  type SplitState,
} from "@/components/expenses/SplitTypeSelector"

type Member = { id: string; name: string }

function today() {
  // yyyy-mm-dd in local time for the date input default.
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10)
}

export function ExpenseForm({
  groupId,
  members,
  currentUserId,
  onSuccess,
  onCancel,
}: {
  groupId: string
  members: Member[]
  currentUserId: string
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const defaultPayer = members.some((m) => m.id === currentUserId)
    ? currentUserId
    : members[0]?.id

  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [payerId, setPayerId] = useState(defaultPayer)
  const [date, setDate] = useState(today())
  const [category, setCategory] = useState("OTHER")
  const [notes, setNotes] = useState("")
  const [split, setSplit] = useState<SplitState>({
    splitType: "EQUAL",
    values: {},
    valid: true,
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const amountNum = Number(amount)
  const validAmount = amountNum > 0 && amountNum <= 999999.99

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!validAmount) {
      setError("Enter an amount between 0.01 and 999999.99.")
      return
    }
    if (!split.valid) {
      setError("Check the split — the allocation doesn't add up yet.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          amount: Math.round(amountNum * 100) / 100,
          payerId,
          date: new Date(date).toISOString(),
          category,
          notes: notes.trim() || undefined,
          splitType: split.splitType,
          // Server recomputes the split from these values — never trusted as-is.
          ...(split.splitType !== "EQUAL" ? { values: split.values } : {}),
          // For EQUAL splits, only send memberIds if a subset was selected.
          ...(split.splitType === "EQUAL" && split.equalMemberIds && split.equalMemberIds.length < members.length
            ? { memberIds: split.equalMemberIds }
            : {}),
        }),
      })

      if (!res.ok) {
        const msg = await getApiError(res, "Could not save the expense.")
        setError(msg)
        toast.error(msg)
        setSubmitting(false)
        return
      }

      toast.success("Expense added.")
      onSuccess?.()
    } catch {
      setError("Something went wrong. Please try again.")
      toast.error("Something went wrong. Please try again.")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Dinner at the beach shack"
          maxLength={100}
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
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
        <div className="space-y-2">
          <Label htmlFor="payer">Paid by</Label>
          <NativeSelect
            id="payer"
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === currentUserId ? `${m.name} (you)` : m.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <CategorySelect value={category} onChange={setCategory} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything worth remembering"
          maxLength={1000}
        />
      </div>

      <div className="space-y-2">
        <Label>Split</Label>
        <SplitTypeSelector
          members={members}
          amount={validAmount ? amountNum : 0}
          onChange={setSplit}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="sticky bottom-0 bg-card pt-2 flex gap-3">
        <Button
          type="submit"
          disabled={submitting || !description.trim() || !validAmount || !split.valid}
        >
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
