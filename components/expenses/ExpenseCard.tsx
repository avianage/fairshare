"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { categoryMeta } from "@/lib/categories"
import { formatMoney, formatRelativeTime } from "@/lib/format"
import { ReceiptManager } from "@/components/expenses/ReceiptManager"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

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
        onClick={() => setOpen((o) => !o)}
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

      {open && (
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
            <div className="mt-3 border-t pt-3">
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Delete expense
              </button>
            </div>
          )}
        </div>
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
