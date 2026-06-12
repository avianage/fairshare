"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ExpenseCard, type Expense } from "@/components/expenses/ExpenseCard"
import {
  ExpenseFilters,
  EMPTY_FILTERS,
  type ExpenseFilterState,
} from "@/components/groups/ExpenseFilters"
import { formatMoney } from "@/lib/format"

function buildQuery(f: ExpenseFilterState) {
  const p = new URLSearchParams({ limit: "50" })
  if (f.category) p.set("category", f.category)
  if (f.from) p.set("from", f.from)
  if (f.to) p.set("to", f.to)
  if (f.q) p.set("q", f.q)
  return p.toString()
}

function isEmpty(f: ExpenseFilterState) {
  return !f.category && !f.from && !f.to && !f.q
}

/**
 * Filterable expense list for a group. Seeds from the server-rendered list, then
 * refetches from /api/groups/:id/expenses whenever filters change.
 */
export function GroupExpenses({
  groupId,
  currency,
  currentUserId,
  isAdmin,
  initialExpenses,
  initialTotal,
}: {
  groupId: string
  currency: string
  currentUserId: string
  isAdmin: boolean
  initialExpenses: Expense[]
  initialTotal: number
}) {
  const [filters, setFilters] = useState<ExpenseFilterState>(EMPTY_FILTERS)
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [filteredTotal, setFilteredTotal] = useState<number>(initialTotal)
  const [loading, setLoading] = useState(false)
  const firstRun = useRef(true)

  const load = useCallback(
    async (f: ExpenseFilterState) => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/groups/${groupId}/expenses?${buildQuery(f)}`,
          { cache: "no-store" }
        )
        if (res.ok) {
          const data = await res.json()
          setExpenses(data.expenses ?? [])
          setFilteredTotal(data.filteredTotal ?? 0)
        }
      } finally {
        setLoading(false)
      }
    },
    [groupId]
  )

  // Skip the fetch on first mount with empty filters (server already provided data).
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      if (isEmpty(filters)) return
    }
    load(filters)
  }, [filters, load])

  const filtered = !isEmpty(filters)

  return (
    <div className="space-y-4">
      <ExpenseFilters value={filters} onChange={setFilters} />

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {filtered ? "Filtered total" : "Total"}
        </span>
        <span className="font-semibold tabular-nums">
          {formatMoney(filteredTotal, currency)}
        </span>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : expenses.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          {filtered ? "No expenses match these filters." : "No expenses yet."}
        </div>
      ) : (
        <ul className="space-y-3">
          {expenses.map((e) => (
            <li key={e.id}>
              <ExpenseCard
                expense={e}
                currency={currency}
                groupId={groupId}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
