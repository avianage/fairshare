"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, AlertTriangle, Settings2, ChevronDown, Wallet } from "lucide-react"
import { toast } from "sonner"
import { BudgetModel } from "@prisma/client"
import { EXPENSE_CATEGORIES, categoryMeta } from "@/lib/categories"
import { formatINR } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"

export type BudgetEntry = {
  category: string
  spent: number
  limit: number
}

type PendingSave = { category: string; amount: number; newSum: number }
type PendingTotalReduce = { newTotal: number; categorySum: number; categories: BudgetEntry[] }

// ─── Helpers ────────────────────────────────────────────────────────────────

function currentMonthLabel() {
  return new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })
}

// ─── BudgetEditDialog ────────────────────────────────────────────────────────

function BudgetEditDialog({
  title,
  subtitle,
  initialValue,
  allowRemove,
  saving,
  onSave,
  onRemove,
  onClose,
}: {
  title: string
  subtitle?: string
  initialValue: string
  allowRemove?: boolean
  saving: boolean
  onSave: (value: string) => void
  onRemove?: () => void
  onClose: () => void
}) {
  const [value, setValue] = useState(initialValue)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-2xl border bg-card p-6 shadow-xl space-y-5 animate-in fade-in-50 zoom-in-95 duration-200">
        <div>
          <p className="text-base font-semibold">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>

        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground select-none">₹</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave(value)
              if (e.key === "Escape") onClose()
            }}
            placeholder="0"
            autoFocus
            className="w-full rounded-xl border bg-background pl-8 pr-4 py-3 text-2xl font-bold tabular-nums tracking-tight outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={() => onSave(value)} disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save"}
          </Button>
          {allowRemove && onRemove && (
            <Button onClick={onRemove} disabled={saving} variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove budget
            </Button>
          )}
          <Button onClick={onClose} disabled={saving} variant="outline" size="sm" className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── BudgetRow ───────────────────────────────────────────────────────────────

function BudgetRow({
  entry,
  onSave,
}: {
  entry: BudgetEntry
  onSave: (category: string, amount: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const remaining = entry.limit > 0 ? entry.limit - entry.spent : 0
  const pct = entry.limit > 0 ? Math.max((remaining / entry.limit) * 100, 0) : 0
  const isOver = entry.spent > entry.limit && entry.limit > 0
  const isNear = !isOver && pct <= 20 && entry.limit > 0
  const cat = categoryMeta(entry.category)

  const barColor = isOver ? "bg-destructive" : isNear ? "bg-warning" : "bg-primary"
  const statusColor = isOver ? "text-destructive" : isNear ? "text-warning" : "text-muted-foreground"

  async function save(value: string) {
    const num = Number(value)
    if (!Number.isFinite(num) || num < 0) { toast.error("Enter a valid amount."); return }
    setSaving(true)
    await onSave(entry.category, num)
    setSaving(false)
    setEditing(false)
  }

  async function remove() {
    setSaving(true)
    await onSave(entry.category, 0)
    setSaving(false)
    setEditing(false)
  }

  return (
    <>
      {editing && (
        <BudgetEditDialog
          title={`${cat.icon} ${cat.label}`}
          subtitle="Set monthly limit for this category"
          initialValue={String(entry.limit)}
          allowRemove
          saving={saving}
          onSave={save}
          onRemove={remove}
          onClose={() => setEditing(false)}
        />
      )}

      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full text-left rounded-xl border bg-card p-4 space-y-3 hover:border-primary/30 hover:bg-muted/20 transition-all"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="text-xl leading-none">{cat.icon}</span>
            <span className="text-sm font-semibold">{cat.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-semibold tabular-nums ${isOver ? "text-destructive" : "text-foreground"}`}>
              {isOver ? `−${formatINR(Math.abs(remaining))}` : formatINR(remaining)}
            </span>
            <Pencil className="h-3 w-3 text-muted-foreground/50" />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] ${statusColor}`}>
              {isOver ? "Over budget" : isNear ? "Approaching limit" : `${pct.toFixed(0)}% remaining`}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {formatINR(entry.spent)} <span className="opacity-50">of</span> {formatINR(entry.limit)}
            </span>
          </div>
        </div>
      </button>
    </>
  )
}

// ─── TotalBudgetSection ──────────────────────────────────────────────────────

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
  const [saving, setSaving] = useState(false)

  const remaining = totalBudget !== null ? totalBudget - totalSpent : 0
  const pct = totalBudget && totalBudget > 0 ? Math.max((remaining / totalBudget) * 100, 0) : 0
  const isOver = totalBudget !== null && totalSpent > totalBudget
  const isNear = !isOver && totalBudget !== null && pct <= 20

  const barColor = isOver ? "bg-destructive" : isNear ? "bg-warning" : "bg-primary"
  const amountColor = isOver ? "text-destructive" : isNear ? "text-warning" : "text-foreground"

  async function save(value: string) {
    const raw = value.trim()
    if (raw === "" || raw === "0") {
      setSaving(true); await onSave(null); setSaving(false); setEditing(false); return
    }
    const num = Number(raw)
    if (!Number.isFinite(num) || num <= 0) { toast.error("Enter a valid amount."); return }
    setSaving(true); await onSave(num); setSaving(false); setEditing(false)
  }

  async function remove() {
    setSaving(true); await onSave(null); setSaving(false); setEditing(false)
  }

  return (
    <>
      {editing && (
        <BudgetEditDialog
          title="Monthly budget"
          subtitle={currentMonthLabel()}
          initialValue={totalBudget !== null ? String(totalBudget) : ""}
          allowRemove={totalBudget !== null}
          saving={saving}
          onSave={save}
          onRemove={remove}
          onClose={() => setEditing(false)}
        />
      )}

      <div className="rounded-2xl border bg-gradient-to-br from-card to-muted/20 p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-1.5">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total budget</p>
              <p className="text-[11px] text-muted-foreground/70">{currentMonthLabel()}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-all"
          >
            <Pencil className="h-3 w-3" />
            {totalBudget !== null ? "Edit" : "Set budget"}
          </button>
        </div>

        {totalBudget !== null ? (
          <>
            {/* Big remaining amount */}
            <div>
              <p className={`text-3xl font-bold tabular-nums tracking-tight ${amountColor}`}>
                {isOver ? `−${formatINR(Math.abs(remaining))}` : formatINR(remaining)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isOver ? "over budget" : "remaining"} · {formatINR(totalSpent)} spent of {formatINR(totalBudget)}
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-medium ${isOver ? "text-destructive" : isNear ? "text-warning" : "text-muted-foreground"}`}>
                  {isOver ? "Over budget" : isNear ? "Approaching limit" : `${pct.toFixed(0)}% remaining`}
                </span>
                <span className="text-[11px] text-muted-foreground">{formatINR(totalBudget)} total</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 gap-2 text-center">
            <p className="text-sm text-muted-foreground">No total budget set</p>
            <p className="text-xs text-muted-foreground/60">Set a monthly limit to track your overall spending</p>
            <Button size="sm" variant="outline" className="mt-1" onClick={() => setEditing(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Set budget
            </Button>
          </div>
        )}
      </div>
    </>
  )
}

// ─── BudgetOverflowDialog ────────────────────────────────────────────────────

function BudgetOverflowDialog({
  pending, currentTotal, onConfirm, onCancel, confirming,
}: {
  pending: PendingSave
  currentTotal: number
  onConfirm: (newTotal: number) => Promise<void>
  onCancel: () => void
  confirming: boolean
}) {
  const [mode, setMode] = useState<"suggest" | "custom">("suggest")
  const [customValue, setCustomValue] = useState("")

  async function handleConfirm() {
    if (mode === "suggest") {
      await onConfirm(pending.newSum)
    } else {
      const num = Number(customValue)
      if (!Number.isFinite(num) || num <= 0) { toast.error("Enter a valid amount."); return }
      if (num < pending.newSum) { toast.error(`Amount must be at least ${formatINR(pending.newSum)} to fit all categories.`); return }
      await onConfirm(num)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-xl space-y-4 animate-in fade-in-50 zoom-in-95 duration-200">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-warning/15 p-2 shrink-0">
            <AlertTriangle className="h-4 w-4 text-warning" />
          </div>
          <div>
            <p className="text-sm font-semibold">Total budget exceeded</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Your categories would total{" "}
              <span className="font-semibold text-foreground">{formatINR(pending.newSum)}</span>,
              exceeding your total of{" "}
              <span className="font-semibold text-foreground">{formatINR(currentTotal)}</span>.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {[
            { id: "suggest" as const, label: `Set to ${formatINR(pending.newSum)}`, sub: "Exactly covers all categories" },
            { id: "custom" as const, label: "Enter a custom amount", sub: null },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                mode === opt.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <div className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                mode === opt.id ? "border-primary" : "border-muted-foreground/50"
              }`}>
                {mode === opt.id && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <div className="flex-1">
                <p className={`font-medium ${mode === opt.id ? "text-primary" : ""}`}>{opt.label}</p>
                {opt.sub && <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>}
                {opt.id === "custom" && mode === "custom" && (
                  <div className="relative mt-2" onClick={(e) => e.stopPropagation()}>
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      placeholder={String(pending.newSum)}
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      className="pl-7 h-8 text-sm"
                      min={pending.newSum}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleConfirm} disabled={confirming} className="flex-1">
            {confirming ? "Saving…" : "Update & Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} disabled={confirming}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

// ─── TotalReduceDialog ───────────────────────────────────────────────────────

function TotalReduceDialog({
  pending, onSaveAdjusted, onRemoveAll, onCancel, confirming,
}: {
  pending: PendingTotalReduce
  onSaveAdjusted: (adjusted: Record<string, number>) => Promise<void>
  onRemoveAll: () => Promise<void>
  onCancel: () => void
  confirming: boolean
}) {
  const [limits, setLimits] = useState<Record<string, number>>(
    Object.fromEntries(pending.categories.map((b) => [b.category, b.limit]))
  )

  const currentSum = Object.values(limits).reduce((s, v) => s + v, 0)
  const isOver = currentSum > pending.newTotal
  const overBy = currentSum - pending.newTotal

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl space-y-5 animate-in fade-in-50 zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-warning/15 p-2 shrink-0">
            <AlertTriangle className="h-4 w-4 text-warning" />
          </div>
          <div>
            <p className="text-sm font-semibold">Adjust category budgets</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Slide categories down to fit within your new total of{" "}
              <span className="font-semibold text-foreground">{formatINR(pending.newTotal)}</span>.
            </p>
          </div>
        </div>

        {/* Live total indicator */}
        <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
          isOver ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
        }`}>
          <span>Category total</span>
          <div className="text-right">
            <span className="tabular-nums font-bold">{formatINR(currentSum)}</span>
            <span className="opacity-60 mx-1">/</span>
            <span className="tabular-nums">{formatINR(pending.newTotal)}</span>
            {isOver && <span className="ml-2 text-xs opacity-80">(over by {formatINR(overBy)})</span>}
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-5">
          {pending.categories.map((b) => {
            const cat = categoryMeta(b.category)
            const val = limits[b.category] ?? 0
            const pct = b.limit > 0 ? (val / b.limit) * 100 : 0
            return (
              <div key={b.category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </span>
                  <span className={`text-sm font-semibold tabular-nums ${val === 0 ? "text-muted-foreground line-through" : ""}`}>
                    {formatINR(val)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={b.limit}
                  step={100}
                  value={val}
                  onChange={(e) => setLimits((prev) => ({ ...prev, [b.category]: Number(e.target.value) }))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>₹0</span>
                  <span>{pct.toFixed(0)}% of {formatINR(b.limit)}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t">
          <Button onClick={() => onSaveAdjusted(limits)} disabled={confirming || isOver} size="sm" className="w-full">
            {confirming ? "Saving…" : isOver ? `Still over by ${formatINR(overBy)}` : "Save adjusted budgets"}
          </Button>
          <Button onClick={onRemoveAll} disabled={confirming} variant="destructive" size="sm" className="w-full">
            {confirming ? "Removing…" : "Remove all category budgets"}
          </Button>
          <Button onClick={onCancel} disabled={confirming} variant="outline" size="sm" className="w-full">
            Go back
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Model options ───────────────────────────────────────────────────────────

const MODEL_OPTIONS: { value: BudgetModel; label: string; note: string }[] = [
  {
    value: BudgetModel.NET_PAYMENT,
    label: "Net Payment",
    note: "Counts the full amount you paid, reduced as others settle with you.",
  },
  {
    value: BudgetModel.PERSONAL_SHARE,
    label: "Personal Share",
    note: "Counts only your fixed split portion of each expense.",
  },
]

// ─── BudgetPanel (main export) ───────────────────────────────────────────────

export function BudgetPanel({
  initialBudgets,
  initialTotalBudget,
  initialTotalSpent,
  initialBudgetModel,
}: {
  initialBudgets: BudgetEntry[]
  initialTotalBudget: number | null
  initialTotalSpent: number
  initialBudgetModel: BudgetModel
}) {
  const router = useRouter()
  const [budgets, setBudgets] = useState<BudgetEntry[]>(initialBudgets)
  const [totalBudget, setTotalBudget] = useState<number | null>(initialTotalBudget)
  const [budgetModel, setBudgetModel] = useState<BudgetModel>(initialBudgetModel)
  const [adding, setAdding] = useState(false)
  const [newCategory, setNewCategory] = useState("")
  const [newAmount, setNewAmount] = useState("")
  const [saving, setSaving] = useState(false)
  const [overflowPending, setOverflowPending] = useState<PendingSave | null>(null)
  const [totalReducePending, setTotalReducePending] = useState<PendingTotalReduce | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [showModelMenu, setShowModelMenu] = useState(false)

  const usedCategories = new Set(budgets.map((b) => b.category))
  const available = EXPENSE_CATEGORIES.filter((c) => !usedCategories.has(c.value))
  const activeModel = MODEL_OPTIONS.find((m) => m.value === budgetModel)!

  function checkOverflow(category: string, amount: number): number | null {
    if (totalBudget === null || amount === 0) return null
    const sumWithout = budgets.reduce((s, b) => s + (b.category === category ? 0 : b.limit), 0)
    const newSum = sumWithout + amount
    return newSum > totalBudget ? newSum : null
  }

  async function doUpsert(category: string, amount: number) {
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
        const next = existing
          ? prev.map((b) => b.category === category ? { ...b, limit: amount } : b)
          : [...prev, { category, spent: 0, limit: amount }].sort((a, b) => a.category.localeCompare(b.category))
        if (totalBudget === null) {
          const newSum = next.reduce((s, b) => s + b.limit, 0)
          doSaveTotalBudget(newSum)
        }
        return next
      })
      toast.success("Budget saved.")
    }
  }

  async function upsert(category: string, amount: number) {
    const overflowSum = checkOverflow(category, amount)
    if (overflowSum !== null) {
      setOverflowPending({ category, amount, newSum: overflowSum })
      return
    }
    await doUpsert(category, amount)
  }

  async function handleOverflowConfirm(newTotal: number) {
    if (!overflowPending) return
    setConfirming(true)
    await doSaveTotalBudget(newTotal)
    await doUpsert(overflowPending.category, overflowPending.amount)
    setConfirming(false)
    setOverflowPending(null)
    setAdding(false)
    setNewCategory("")
    setNewAmount("")
  }

  async function saveTotalBudget(amount: number | null) {
    if (amount !== null && budgets.length > 0) {
      const categorySum = budgets.reduce((s, b) => s + b.limit, 0)
      if (amount < categorySum) {
        setTotalReducePending({ newTotal: amount, categorySum, categories: budgets })
        return
      }
    }
    await doSaveTotalBudget(amount)
  }

  async function doSaveTotalBudget(amount: number | null) {
    const res = await fetch("/api/budgets/total", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    })
    if (!res.ok) { toast.error("Could not save total budget."); return }
    setTotalBudget(amount)
    toast.success(amount === null ? "Total budget removed." : "Total budget saved.")
  }

  async function handleRemoveAllCategories() {
    if (!totalReducePending) return
    setConfirming(true)
    await Promise.all(budgets.map((b) =>
      fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: b.category, amount: 0 }),
      })
    ))
    setBudgets([])
    await doSaveTotalBudget(totalReducePending.newTotal)
    setConfirming(false)
    setTotalReducePending(null)
    toast.success("Category budgets removed and total budget updated.")
  }

  async function handleSaveAdjustedCategories(adjusted: Record<string, number>) {
    if (!totalReducePending) return
    setConfirming(true)
    await Promise.all(
      Object.entries(adjusted).map(([category, amount]) =>
        fetch("/api/budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, amount }),
        })
      )
    )
    setBudgets((prev) =>
      prev.map((b) => adjusted[b.category] !== undefined ? { ...b, limit: adjusted[b.category] } : b)
        .filter((b) => b.limit > 0)
    )
    await doSaveTotalBudget(totalReducePending.newTotal)
    setConfirming(false)
    setTotalReducePending(null)
    toast.success("Category budgets adjusted and total budget updated.")
  }

  async function saveModel(model: BudgetModel) {
    const prev = budgetModel
    setBudgetModel(model)
    setShowModelMenu(false)
    const res = await fetch("/api/budgets/total", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budgetModel: model }),
    })
    if (!res.ok) {
      setBudgetModel(prev)
      toast.error("Could not save preference.")
      return
    }
    router.refresh()
  }

  async function addNew() {
    const num = Number(newAmount)
    if (!newCategory) { toast.error("Select a category."); return }
    if (!Number.isFinite(num) || num <= 0) { toast.error("Enter a valid amount."); return }
    const willOverflow = checkOverflow(newCategory, num) !== null
    setSaving(true)
    await upsert(newCategory, num)
    setSaving(false)
    if (!willOverflow) {
      setAdding(false)
      setNewCategory("")
      setNewAmount("")
    }
  }

  return (
    <>
      {overflowPending && totalBudget !== null && (
        <BudgetOverflowDialog
          pending={overflowPending}
          currentTotal={totalBudget}
          onConfirm={handleOverflowConfirm}
          onCancel={() => setOverflowPending(null)}
          confirming={confirming}
        />
      )}
      {totalReducePending && (
        <TotalReduceDialog
          pending={totalReducePending}
          onSaveAdjusted={handleSaveAdjustedCategories}
          onRemoveAll={handleRemoveAllCategories}
          onCancel={() => setTotalReducePending(null)}
          confirming={confirming}
        />
      )}

      <div className="space-y-6">
        {/* Total budget hero */}
        <TotalBudgetSection
          totalSpent={initialTotalSpent}
          totalBudget={totalBudget}
          onSave={saveTotalBudget}
        />

        {/* Category budgets */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">By category</p>
            <div className="flex items-center gap-2">
              {/* Model picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModelMenu((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-all"
                >
                  <Settings2 className="h-3 w-3" />
                  {activeModel.label}
                  <ChevronDown className={`h-3 w-3 transition-transform ${showModelMenu ? "rotate-180" : ""}`} />
                </button>
                {showModelMenu && (
                  <div className="absolute right-0 top-full mt-1.5 z-10 w-64 rounded-xl border bg-card shadow-lg p-1 animate-in fade-in-50 zoom-in-95 duration-150">
                    {MODEL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => saveModel(opt.value)}
                        className={`w-full flex flex-col items-start rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${
                          budgetModel === opt.value ? "bg-primary/5" : ""
                        }`}
                      >
                        <span className={`text-sm font-medium ${budgetModel === opt.value ? "text-primary" : ""}`}>
                          {opt.label} {budgetModel === opt.value && "✓"}
                        </span>
                        <span className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{opt.note}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {available.length > 0 && !adding && (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              )}
            </div>
          </div>

          {/* Add form */}
          {adding && (
            <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 space-y-3 animate-in fade-in-50 slide-in-from-top-2 duration-200">
              <p className="text-xs font-semibold text-primary">New category budget</p>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <NativeSelect
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 bg-background"
                >
                  <option value="">Select category…</option>
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
                    onKeyDown={(e) => { if (e.key === "Enter") addNew() }}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" onClick={addNew} disabled={saving}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewCategory(""); setNewAmount("") }}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Category list */}
          {budgets.length === 0 && !adding ? (
            <div className="rounded-xl border border-dashed py-10 text-center space-y-2">
              <p className="text-sm font-medium text-muted-foreground">No category budgets yet</p>
              <p className="text-xs text-muted-foreground/60">Break down your budget by category to track where your money goes</p>
              {available.length > 0 && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => setAdding(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add first category
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {budgets.map((b) => (
                <BudgetRow key={b.category} entry={b} onSave={upsert} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
