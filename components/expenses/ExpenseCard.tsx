"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil } from "lucide-react"
import { categoryMeta } from "@/lib/categories"
import { formatMoney, formatRelativeTime } from "@/lib/format"
import { EXPENSE_CATEGORIES } from "@/lib/categories"
import { ReceiptManager } from "@/components/expenses/ReceiptManager"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type ExpenseSplit = { user: { id: string; name: string }; amount: number }
export type Expense = {
  id: string
  description: string
  amount: number
  category: string
  splitType: string
  notes: string | null
  receiptUrl: string | null
  date: string | Date
  payer: { id: string; name: string; avatar: string | null }
  splits: ExpenseSplit[]
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

function EditExpenseForm({
  expense,
  groupId,
  onSave,
  onCancel,
}: {
  expense: Expense
  groupId: string
  onSave: () => void
  onCancel: () => void
}) {
  const [description, setDescription] = useState(expense.description)
  const [amount, setAmount] = useState(String(expense.amount))
  const [category, setCategory] = useState(expense.category)
  const [notes, setNotes] = useState(expense.notes ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const amountNum = Number(amount)
    if (!amountNum || amountNum <= 0) {
      toast.error("Enter a valid amount.")
      return
    }
    setSaving(true)
    const res = await fetch(`/api/groups/${groupId}/expenses/${expense.id}`, {
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
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast.error(data?.error ?? "Could not update the expense.")
      return
    }
    toast.success("Expense updated.")
    onSave()
  }

  return (
    <form onSubmit={handleSave} className="space-y-3 border-t px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Edit expense</p>

      <div className="space-y-1.5">
        <Label htmlFor="edit-desc" className="text-xs">Description</Label>
        <Input
          id="edit-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={100}
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-amount" className="text-xs">Amount</Label>
          <Input
            id="edit-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max="999999.99"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-category" className="text-xs">Category</Label>
          <select
            id="edit-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={selectClass}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="edit-notes" className="text-xs">Notes</Label>
        <Input
          id="edit-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
          maxLength={1000}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving || !description.trim()}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export function ExpenseCard({
  expense,
  currency,
  groupId,
  currentUserId,
  isAdmin,
}: {
  expense: Expense
  currency: string
  groupId: string
  currentUserId: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const cat = categoryMeta(expense.category)
  const canManage = isAdmin || expense.payer.id === currentUserId

  async function deleteExpense() {
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/groups/${groupId}/expenses/${expense.id}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? "Could not delete the expense.")
        setDeleting(false)
        return
      }
      toast.success("Expense deleted.")
      setConfirmingDelete(false)
      setDeleting(false)
      router.refresh()
    } catch {
      toast.error("Something went wrong.")
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setEditing(false) }}
        className="flex w-full items-center gap-4 p-4 text-left"
        aria-expanded={open}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-lg"
          title={cat.label}
          aria-hidden
        >
          {cat.icon}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{expense.description}</p>
          <p className="truncate text-xs text-muted-foreground">
            {expense.payer.name} paid · {formatRelativeTime(expense.date)}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-semibold">{formatMoney(expense.amount, currency)}</p>
          <p className="text-xs text-muted-foreground">
            {expense.splits.length}-way split
          </p>
        </div>
      </button>

      {open && !editing && (
        <div className="border-t px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Split
          </p>
          <ul className="space-y-1.5">
            {expense.splits.map((s) => (
              <li
                key={s.user.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-foreground">
                  {s.user.name}
                  {s.user.id === expense.payer.id && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      (payer)
                    </span>
                  )}
                </span>
                <span className="tabular-nums">
                  {formatMoney(s.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
          {expense.notes && (
            <p className="mt-3 rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">
              {expense.notes}
            </p>
          )}

          <ReceiptManager
            groupId={groupId}
            expenseId={expense.id}
            receiptUrl={expense.receiptUrl}
            canManage={canManage}
          />

          {canManage && (
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Delete expense
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            </div>
          )}
        </div>
      )}

      {open && editing && (
        <EditExpenseForm
          expense={expense}
          groupId={groupId}
          onSave={() => { setEditing(false); router.refresh() }}
          onCancel={() => setEditing(false)}
        />
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this expense?"
        description={`"${expense.description}" will be removed from the group's balances.`}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={deleteExpense}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
