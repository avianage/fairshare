"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil } from "lucide-react"
import { getApiError } from "@/lib/api-error"
import { EXPENSE_CATEGORIES } from "@/lib/categories"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

type Expense = {
  id: string
  description: string
  amount: number
  category: string
  notes: string | null
}

export function ExpenseActions({
  expense,
  groupId,
  backHref,
  canManage,
}: {
  expense: Expense
  groupId: string | null
  backHref: string
  canManage: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Edit state
  const [description, setDescription] = useState(expense.description)
  const [amount, setAmount] = useState(String(expense.amount))
  const [category, setCategory] = useState(expense.category)
  const [notes, setNotes] = useState(expense.notes ?? "")
  const [saving, setSaving] = useState(false)

  const apiUrl = groupId
    ? `/api/groups/${groupId}/expenses/${expense.id}`
    : `/api/expenses/${expense.id}`

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const amountNum = Number(amount)
    if (!amountNum || amountNum <= 0) { toast.error("Enter a valid amount."); return }
    setSaving(true)
    const res = await fetch(apiUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: description.trim(),
        amount: Math.round(amountNum * 100) / 100,
        category,
        notes: notes.trim() || null,
      }),
    })
    setSaving(false)
    if (!res.ok) { toast.error(await getApiError(res, "Could not update the expense.")); return }
    toast.success("Expense updated.")
    setEditing(false)
    router.refresh()
    window.dispatchEvent(
      new CustomEvent("fairshare:expense-changed", { detail: { groupId } })
    )
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(apiUrl, { method: "DELETE" })
    if (!res.ok) {
      toast.error(await getApiError(res, "Could not delete the expense."))
      setDeleting(false)
      return
    }
    toast.success("Expense deleted.")
    router.push(backHref)
  }

  if (!canManage) return null

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      {!editing ? (
        <div className="flex gap-3">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Edit expense</p>
          <div className="space-y-1.5">
            <Label htmlFor="ea-desc" className="text-xs">Description</Label>
            <Input id="ea-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={100} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ea-amount" className="text-xs">Amount</Label>
              <Input id="ea-amount" type="number" inputMode="decimal" step="0.01" min="0.01" max="999999.99" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ea-category" className="text-xs">Category</Label>
              <NativeSelect id="ea-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ea-notes" className="text-xs">Notes</Label>
            <Input id="ea-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" maxLength={1000} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving || !description.trim()}>{saving ? "Saving…" : "Save"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this expense?"
        description={`"${expense.description}" will be permanently removed and balances will recalculate. Any settlements already made for this expense will not be reversed.`}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
