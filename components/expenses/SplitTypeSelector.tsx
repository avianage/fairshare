"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"

export type SplitType = "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES"
type Member = { id: string; name: string }

export type SplitState = {
  splitType: SplitType
  values: Record<string, number>
  /** True when the current allocation is valid for submission. */
  valid: boolean
}

const TABS: { type: SplitType; label: string }[] = [
  { type: "EQUAL", label: "Equal" },
  { type: "EXACT", label: "Exact" },
  { type: "PERCENTAGE", label: "%" },
  { type: "SHARES", label: "Shares" },
]

function money(n: number) {
  return n.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  })
}

export function SplitTypeSelector({
  members,
  amount,
  onChange,
}: {
  members: Member[]
  amount: number
  onChange: (state: SplitState) => void
}) {
  const [splitType, setSplitType] = useState<SplitType>("EQUAL")
  // Raw string inputs keyed by member id (one map per type).
  const [exact, setExact] = useState<Record<string, string>>({})
  const [pct, setPct] = useState<Record<string, string>>({})
  const [shares, setShares] = useState<Record<string, string>>(() =>
    Object.fromEntries(members.map((m) => [m.id, "1"]))
  )

  const num = (s: string | undefined) => {
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  // Keep the shares map in step with the member list: default new members to "1"
  // and drop removed ones. Keyed by member ids so it doesn't loop on every render.
  const memberKey = members.map((m) => m.id).join("|")
  useEffect(() => {
    setShares((prev) => {
      const next: Record<string, string> = {}
      for (const m of members) next[m.id] = prev[m.id] ?? "1"
      const sameSize = Object.keys(prev).length === members.length
      const allPresent = members.every((m) => prev[m.id] !== undefined)
      return sameSize && allPresent ? prev : next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberKey])

  // Derived totals for the active type.
  const exactTotal = members.reduce((a, m) => a + num(exact[m.id]), 0)
  const pctTotal = members.reduce((a, m) => a + num(pct[m.id]), 0)
  const sharesTotal = members.reduce((a, m) => a + num(shares[m.id]), 0)

  // Recompute the canonical {splitType, values, valid} and bubble it up.
  useEffect(() => {
    let values: Record<string, number> = {}
    let valid = true

    if (splitType === "EQUAL") {
      values = {}
      valid = members.length > 0
    } else if (splitType === "EXACT") {
      values = Object.fromEntries(members.map((m) => [m.id, num(exact[m.id])]))
      valid = amount > 0 && Math.abs(exactTotal - amount) <= 0.01
    } else if (splitType === "PERCENTAGE") {
      values = Object.fromEntries(members.map((m) => [m.id, num(pct[m.id])]))
      valid = amount > 0 && Math.abs(pctTotal - 100) <= 0.01
    } else if (splitType === "SHARES") {
      values = Object.fromEntries(members.map((m) => [m.id, num(shares[m.id])]))
      valid =
        amount > 0 &&
        sharesTotal > 0 &&
        members.every((m) => {
          const v = num(shares[m.id])
          return Number.isInteger(v) && v > 0
        })
    }

    onChange({ splitType, values, valid })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitType, amount, exactTotal, pctTotal, sharesTotal, JSON.stringify(exact), JSON.stringify(pct), JSON.stringify(shares)])

  const exactRemaining = Math.round((amount - exactTotal) * 100) / 100
  const pctRemaining = Math.round((100 - pctTotal) * 100) / 100

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex rounded-md border bg-muted/50 p-0.5 text-sm">
        {TABS.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => setSplitType(t.type)}
            className={`flex-1 rounded px-2 py-1.5 font-medium transition-colors ${
              splitType === t.type
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {splitType === "EQUAL" && (
        <p className="rounded-md border border-primary/20 bg-accent px-3 py-2 text-sm text-accent-foreground">
          Split equally among {members.length}{" "}
          {members.length === 1 ? "person" : "people"}
          {amount > 0 && (
            <span className="font-medium">
              {" "}
              · {money(amount / members.length)} each
            </span>
          )}
        </p>
      )}

      {splitType === "EXACT" && (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-sm">{m.name}</span>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={exact[m.id] ?? ""}
                onChange={(e) =>
                  setExact((p) => ({ ...p, [m.id]: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>
          ))}
          <p
            className={`text-sm ${
              Math.abs(exactRemaining) > 0.01 ? "text-destructive" : "text-success"
            }`}
          >
            {Math.abs(exactRemaining) > 0.01
              ? `Remaining to allocate: ${money(exactRemaining)}`
              : "Allocated in full ✓"}
          </p>
        </div>
      )}

      {splitType === "PERCENTAGE" && (
        <div className="space-y-2">
          {members.map((m) => {
            const computed = (num(pct[m.id]) / 100) * amount
            return (
              <div key={m.id} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm">{m.name}</span>
                <div className="relative flex-1">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max="100"
                    value={pct[m.id] ?? ""}
                    onChange={(e) =>
                      setPct((p) => ({ ...p, [m.id]: e.target.value }))
                    }
                    placeholder="0"
                    className="pr-7"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                  {amount > 0 ? money(computed) : "—"}
                </span>
              </div>
            )
          })}
          <p
            className={`text-sm ${
              Math.abs(pctRemaining) > 0.01 ? "text-destructive" : "text-success"
            }`}
          >
            {Math.abs(pctRemaining) > 0.01
              ? `Remaining: ${pctRemaining}%`
              : "Totals 100% ✓"}
          </p>
        </div>
      )}

      {splitType === "SHARES" && (
        <div className="space-y-2">
          {members.map((m) => {
            const s = num(shares[m.id])
            const computed = sharesTotal > 0 ? (s / sharesTotal) * amount : 0
            return (
              <div key={m.id} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm">{m.name}</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="1"
                  value={shares[m.id] ?? ""}
                  onChange={(e) =>
                    setShares((p) => ({ ...p, [m.id]: e.target.value }))
                  }
                  placeholder="1"
                />
                <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                  {amount > 0 ? money(computed) : "—"}
                </span>
              </div>
            )
          })}
          <p className="text-sm text-muted-foreground">
            {sharesTotal} total {sharesTotal === 1 ? "share" : "shares"}
          </p>
        </div>
      )}
    </div>
  )
}
