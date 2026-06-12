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
import { categoryMeta } from "@/lib/categories"
import { formatINR } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"

type Stats = {
  totalSpend: number
  byCategory: { category: string; amount: number }[]
  byMember: { userId: string; name: string; paid: number; owes: number }[]
  thisMonth: number
  lastMonth: number
}

function formatCompactINR(v: number) {
  if (v >= 10_000_000) {
    return `₹${(v / 10_000_000).toFixed(1).replace(/\.0$/, "")}Cr`
  }
  if (v >= 100_000) {
    return `₹${(v / 100_000).toFixed(1).replace(/\.0$/, "")}L`
  }
  if (v >= 1_000) {
    return `₹${(v / 1_000).toFixed(1).replace(/\.0$/, "")}k`
  }
  return `₹${v}`
}

export function SpendingSummary({ groupId }: { groupId: string }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/groups/${groupId}/stats`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setStats(d))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [groupId])

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        Could not load the spending summary.
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    )
  }

  if (stats.totalSpend === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
        No spending yet — add an expense to see the summary.
      </div>
    )
  }

  const chartData = stats.byCategory.map((c) => ({
    name: categoryMeta(c.category).label,
    icon: categoryMeta(c.category).icon,
    amount: c.amount,
  }))

  const topSpender = [...stats.byMember].sort((a, b) => b.paid - a.paid)[0]
  const momDelta = stats.thisMonth - stats.lastMonth
  const momUp = momDelta > 0

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Spending summary</h2>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatINR(stats.totalSpend)}
          </p>
        </div>
        <div className="flex gap-4 text-right text-sm">
          <div>
            <p className="text-xs text-muted-foreground">This month</p>
            <p className="font-semibold tabular-nums">{formatINR(stats.thisMonth)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last month</p>
            <p className="font-semibold tabular-nums">{formatINR(stats.lastMonth)}</p>
          </div>
        </div>
      </div>

      {/* Month-over-month + top spender chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        {stats.lastMonth > 0 && (
          <span
            className={
              momUp
                ? "rounded-full bg-warning/10 px-2 py-1 font-medium text-warning"
                : "rounded-full bg-success/10 px-2 py-1 font-medium text-success"
            }
          >
            {momUp ? "▲" : "▼"} {formatINR(Math.abs(momDelta))} vs last month
          </span>
        )}
        {topSpender && topSpender.paid > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-1 font-medium text-primary">
            Top spender: {topSpender.name} ({formatINR(topSpender.paid)})
          </span>
        )}
      </div>

      {/* Per-category bar chart */}
      <div className="h-56 w-full min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
              width={40}
              tickFormatter={formatCompactINR}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--accent))" }}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value) => formatINR(Number(value))}
              labelFormatter={(_label, payload) =>
                (payload?.[0]?.payload as { name?: string })?.name ?? ""
              }
            />
            <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
