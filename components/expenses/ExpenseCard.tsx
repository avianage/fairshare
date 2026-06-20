"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { categoryMeta } from "@/lib/categories"
import { formatMoney, formatRelativeTime } from "@/lib/format"

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
}: {
  expense: Expense
  currency: string
  // kept for call-site compatibility — no longer used
  groupId?: string | null
  currentUserId?: string
  isAdmin?: boolean
}) {
  const cat = categoryMeta(expense.category)

  return (
    <Link
      href={`/expenses/${expense.id}`}
      className="flex items-center gap-4 rounded-xl border bg-card p-4 hover:bg-accent/50 transition-colors"
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

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
