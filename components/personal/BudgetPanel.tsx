"use client"

import { useState } from "react"
import { Plus, Pencil, Check, X } from "lucide-react"
import { toast } from "sonner"
import { EXPENSE_CATEGORIES, categoryMeta } from "@/lib/categories"
import { formatINR } from "@/lib/format"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export type BudgetEntry = {
  category: string
  spent: number
  limit: number
}

function BudgetRow({
  entry,
  onSave,
}: {
  entry: BudgetEntry
  onSave: (category: string, amount: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(entry.limit))
  const [saving, setSaving] = useState(false)

  const pct = entry.limit > 0 ? Math.min((entry.spent / entry.limit) * 100, 100) : 0
  const barColor =
    pct >= 100 ? "bg-destructive" : pct >= 70 ? "bg-warning" : "bg-success"
  const cat = categoryMeta(entry.category)

  async function save() {
    const num = Number(value)
    if (!Number.isFinite(num) || num < 0) {
      toast.error("Enter a valid amount.")
      return
    }
    setSaving(true)
    await onSave(entry.category, num)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <span>{cat.icon}</span>
          <span>{cat.label}</span>
        </span>
        {editing ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">₹</span>
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-7 w-24 text-xs"
              min="0"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false) }}
            />
            <button type="button" onClick={save} disabled={saving} className="text-success hover:opacity-80">
              <Check className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-muted-foreground hover:opacity-80">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={pct >= 100 ? "font-semibold text-destructive" : ""}>
              {formatINR(entry.spent)} of {formatINR(entry.limit)}
            </span>
            <button type="button" onClick={() => setEditing(true)} className="hover:text-foreground">
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-right text-[10px] text-muted-foreground">
        {pct.toFixed(0)}% used
      </p>
    </div>
  )
}

export function BudgetPanel({ initialBudgets }: { initialBudgets: BudgetEntry[] }) {
  const [budgets, setBudgets] = useState<BudgetEntry[]>(initialBudgets)
  const [adding, setAdding] = useState(false)
  const [newCategory, setNewCategory] = useState("")
  const [newAmount, setNewAmount] = useState("")
  const [saving, setSaving] = useState(false)

  const usedCategories = new Set(budgets.map((b) => b.category))
  const available = EXPENSE_CATEGORIES.filter((c) => !usedCategories.has(c.value))

  async function upsert(category: string, amount: number) {
    const res = await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, amount }),
    })
    if (!res.ok) { toast.error("Could not save budget."); return }

    if (amount === 0) {
      setBudgets((prev) => prev.filter((b) => b.category !== category))
      toast.success("Budget removed.")
    } else {
      setBudgets((prev) => {
        const existing = prev.find((b) => b.category === category)
        if (existing) return prev.map((b) => b.category === category ? { ...b, limit: amount } : b)
        return [...prev, { category, spent: 0, limit: amount }].sort((a, b) => a.category.localeCompare(b.category))
      })
      toast.success("Budget saved.")
    }
  }

  async function addNew() {
    const num = Number(newAmount)
    if (!newCategory) { toast.error("Select a category."); return }
    if (!Number.isFinite(num) || num <= 0) { toast.error("Enter a valid amount."); return }
    setSaving(true)
    await upsert(newCategory, num)
    setSaving(false)
    setAdding(false)
    setNewCategory("")
    setNewAmount("")
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Monthly budgets</h2>
        {available.length > 0 && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-primary hover:opacity-80"
          >
            <Plus className="h-3.5 w-3.5" /> Add budget
          </button>
        )}
      </div>

      {budgets.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">
          No budgets set. Add one to track your monthly spending.
        </p>
      )}

      <div className="space-y-5">
        {budgets.map((b) => (
          <BudgetRow key={b.category} entry={b} onSave={upsert} />
        ))}
      </div>

      {adding && (
        <div className="rounded-lg border bg-accent/30 p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">New budget</p>
          <div className="flex gap-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Category…</option>
              {available.map((c) => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </select>
            <div className="relative w-28">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <Input
                type="number"
                placeholder="Limit"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="pl-6"
                min="1"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addNew} disabled={saving}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewCategory(""); setNewAmount("") }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}
