"use client"

import { useState } from "react"
import { Plus, Pencil, Check, X, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { EXPENSE_CATEGORIES, categoryMeta } from "@/lib/categories"
import { formatINR } from "@/lib/format"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"

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
    pct >= 100
      ? "from-destructive/80 to-destructive"
      : pct >= 75
      ? "from-warning/80 to-warning"
      : "from-success/80 to-success"
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
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-right text-[10px] text-muted-foreground">
        {pct.toFixed(0)}% used
      </p>
    </div>
  )
}

function TotalBudgetSection({
  totalSpent,
  totalBudget,
  onSave,
}: {
  totalSpent: number
  totalBudget: number | null
  onSave: (amount: number | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(totalBudget !== null ? String(totalBudget) : "")
  const [saving, setSaving] = useState(false)

  const pct = totalBudget && totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0
  const isOver = totalBudget !== null && totalSpent > totalBudget
  const isNear = !isOver && pct >= 80
  const barColor = isOver
    ? "from-destructive/80 to-destructive"
    : isNear
    ? "from-warning/80 to-warning"
    : "from-primary/70 to-primary"

  async function save() {
    const raw = value.trim()
    if (raw === "" || raw === "0") {
      setSaving(true)
      await onSave(null)
      setSaving(false)
      setEditing(false)
      return
    }
    const num = Number(raw)
    if (!Number.isFinite(num) || num <= 0) {
      toast.error("Enter a valid amount.")
      return
    }
    setSaving(true)
    await onSave(num)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Total monthly budget</span>
        {editing ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">₹</span>
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-7 w-28 text-xs"
              min="0"
              placeholder="e.g. 10000"
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
          <button
            type="button"
            onClick={() => { setValue(totalBudget !== null ? String(totalBudget) : ""); setEditing(true) }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
            {totalBudget !== null ? "Edit" : "Set limit"}
          </button>
        )}
      </div>

      {totalBudget !== null ? (
        <>
          <div className="flex items-baseline justify-between text-xs">
            <span className={isOver ? "font-semibold text-destructive" : "text-muted-foreground"}>
              {formatINR(totalSpent)} spent
            </span>
            <span className="text-muted-foreground">of {formatINR(totalBudget)}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted/60">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% used</span>
            {isOver && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-destructive">
                <AlertTriangle className="h-3 w-3" />
                Over budget by {formatINR(totalSpent - totalBudget)}
              </span>
            )}
            {isNear && !isOver && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-warning">
                <AlertTriangle className="h-3 w-3" />
                Approaching limit
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Set a total limit to track your overall monthly spending.
        </p>
      )}
    </div>
  )
}

export function BudgetPanel({
  initialBudgets,
  initialTotalBudget,
  initialTotalSpent,
}: {
  initialBudgets: BudgetEntry[]
  initialTotalBudget: number | null
  initialTotalSpent: number
}) {
  const [budgets, setBudgets] = useState<BudgetEntry[]>(initialBudgets)
  const [totalBudget, setTotalBudget] = useState<number | null>(initialTotalBudget)
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

  async function saveTotalBudget(amount: number | null) {
    const res = await fetch("/api/budgets/total", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    })
    if (!res.ok) { toast.error("Could not save total budget."); return }
    setTotalBudget(amount)
    toast.success(amount === null ? "Total budget removed." : "Total budget saved.")
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
    <div className="rounded-xl border bg-card/65 backdrop-blur-md p-5 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold">Monthly budgets</h2>

      <TotalBudgetSection
        totalSpent={initialTotalSpent}
        totalBudget={totalBudget}
        onSave={saveTotalBudget}
      />

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">By category</p>
        {available.length > 0 && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-primary hover:opacity-80 transition-opacity font-medium"
          >
            <Plus className="h-3.5 w-3.5" /> Add budget
          </button>
        )}
      </div>

      {budgets.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">
          No category budgets set yet.
        </p>
      )}

      <div className="space-y-5">
        {budgets.map((b) => (
          <BudgetRow key={b.category} entry={b} onSave={upsert} />
        ))}
      </div>

      {adding && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 animate-in fade-in-50 slide-in-from-top-2 duration-200">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">New budget</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <NativeSelect
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="flex-1 bg-background"
            >
              <option value="">Category…</option>
              {available.map((c) => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </NativeSelect>
            <div className="relative w-full sm:w-36">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <Input
                type="number"
                placeholder="Limit"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="pl-7 bg-background"
                min="1"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button size="sm" onClick={addNew} disabled={saving} className="bg-primary hover:bg-primary/90">Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewCategory(""); setNewAmount("") }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}
