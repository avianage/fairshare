"use client"

import { useEffect, useState } from "react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatINR } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"

type Timeframe = "week" | "month" | "all"

type InsightsData = {
  totalSpent: number
  byCategory: { category: string; label: string; icon: string; amount: number }[]
  byGroup: { groupId: string | null; name: string; emoji: string | null; amount: number }[]
}

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
]

function formatCompact(v: number) {
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1).replace(/\.0$/, "")}Cr`
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1).replace(/\.0$/, "")}L`
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(1).replace(/\.0$/, "")}k`
  return `₹${v}`
}

export function InsightsClient() {
  const [timeframe, setTimeframe] = useState<Timeframe>("month")
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    setData(null)
    fetch(`/api/insights?timeframe=${timeframe}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [timeframe])

  return (
    <div className="space-y-6">
      {/* Timeframe filter */}
      <div className="flex rounded-lg border bg-muted/50 p-1 text-sm w-fit">
        {TIMEFRAMES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTimeframe(t.value)}
            className={`rounded px-3 py-1.5 font-medium transition-colors ${
              timeframe === t.value
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Could not load insights. Please try again.
        </div>
      )}

      {/* Total spent */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Your total spending</p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-36" />
        ) : (
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {formatINR(data?.totalSpent ?? 0)}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Your exact share across all expenses — not what you fronted
        </p>
      </div>

      {/* Category breakdown */}
      {loading ? (
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-52 w-full" />
        </div>
      ) : data && data.byCategory.length > 0 ? (
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Spending by category</h2>
          <div className="h-56 w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.byCategory.map((c) => ({ ...c, name: c.label }))}
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <XAxis
                  dataKey="icon"
                  tick={{ fontSize: 16 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={formatCompact}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--accent))" }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v) => formatINR(Number(v))}
                  labelFormatter={(_l, p) =>
                    (p?.[0]?.payload as { name?: string })?.name ?? ""
                  }
                />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {/* Group breakdown */}
      {loading ? (
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
          <Skeleton className="h-4 w-28" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      ) : data && data.byGroup.length > 0 ? (
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Spending by group</h2>
          <div className="space-y-3">
            {data.byGroup.map((g) => {
              const pct = data.totalSpent > 0 ? (g.amount / data.totalSpent) * 100 : 0
              return (
                <div key={g.groupId ?? "personal"} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium truncate pr-4">
                      <span>{g.emoji ?? "💸"}</span>
                      {g.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatINR(g.amount)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {!loading && !error && data?.totalSpent === 0 && (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No spending recorded for this period.
        </div>
      )}
    </div>
  )
}
