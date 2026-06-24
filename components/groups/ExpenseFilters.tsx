"use client"

import { useEffect, useRef, useState } from "react"
import { X, Search } from "lucide-react"
import { EXPENSE_CATEGORIES } from "@/lib/categories"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { cn } from "@/lib/utils"

export type ExpenseFilterState = {
  category: string | null // null = ALL
  from: string // YYYY-MM-DD or ""
  to: string
  q: string
}

export const EMPTY_FILTERS: ExpenseFilterState = {
  category: null,
  from: "",
  to: "",
  q: "",
}

/**
 * Filter controls for a group's expense list. Search is debounced (300ms);
 * everything else applies immediately. `onChange` reports the full filter state.
 */
export function ExpenseFilters({
  value,
  onChange,
}: {
  value: ExpenseFilterState
  onChange: (next: ExpenseFilterState) => void
}) {
  const [qInput, setQInput] = useState(value.q)
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  // Keep local search box in sync when filters are cleared externally.
  useEffect(() => {
    setQInput(value.q)
  }, [value.q])

  function setQDebounced(next: string) {
    setQInput(next)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => onChange({ ...value, q: next.trim() }), 300)
  }

  const active =
    value.category !== null || value.from !== "" || value.to !== "" || value.q !== ""

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur-sm">
      {/* Category pills — wrap on both mobile and desktop */}
      <div className="flex flex-wrap gap-1.5">
        <Pill
          label="All"
          active={value.category === null}
          onClick={() => onChange({ ...value, category: null })}
        />
        {EXPENSE_CATEGORIES.map((c) => (
          <Pill
            key={c.value}
            label={`${c.icon} ${c.label}`}
            active={value.category === c.value}
            onClick={() => onChange({ ...value, category: c.value })}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qInput}
            onChange={(e) => setQDebounced(e.target.value)}
            placeholder="Search description…"
            className="pl-9 bg-background/50 focus:bg-background transition-colors duration-200"
          />
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <DatePicker
            value={value.from}
            max={value.to || undefined}
            onChange={(v) => onChange({ ...value, from: v })}
            placeholder="From date"
            aria-label="From date"
            className="w-full flex-1 min-w-0 sm:w-36 h-9"
          />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 px-0.5">to</span>
          <DatePicker
            value={value.to}
            min={value.from || undefined}
            onChange={(v) => onChange({ ...value, to: v })}
            placeholder="To date"
            aria-label="To date"
            className="w-full flex-1 min-w-0 sm:w-36 h-9"
          />
        </div>
        {active && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-all active:scale-95 sm:ml-auto"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}
      </div>
    </div>
  )
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm scale-105"
          : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground active:scale-95"
      )}
    >
      {label}
    </button>
  )
}
