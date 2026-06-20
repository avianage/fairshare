import Link from "next/link"
import { AlertTriangle, PiggyBank } from "lucide-react"
import { formatINR } from "@/lib/format"

export function BudgetSummaryCard({
  totalSpent,
  totalBudget,
}: {
  totalSpent: number
  totalBudget: number | null
}) {
  const pct = totalBudget && totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0
  const isOver = totalBudget !== null && totalSpent > totalBudget
  const isNear = !isOver && pct >= 80
  const barColor = isOver
    ? "bg-destructive"
    : isNear
    ? "bg-warning"
    : "bg-primary"

  return (
    <Link
      href="/budgets"
      className="block rounded-xl border bg-card/65 backdrop-blur-md p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Monthly Budget</span>
        </div>
        <span className="text-xs text-muted-foreground">View →</span>
      </div>

      {totalBudget === null ? (
        <p className="text-sm text-muted-foreground">No budget set. Tap to set one.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className={`text-lg font-bold tabular-nums ${isOver ? "text-destructive" : ""}`}>
              {formatINR(totalSpent)}
            </span>
            <span className="text-xs text-muted-foreground">of {formatINR(totalBudget)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{pct.toFixed(0)}% used</span>
            {isOver && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                <AlertTriangle className="h-3 w-3" />
                Over by {formatINR(totalSpent - totalBudget)}
              </span>
            )}
            {isNear && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-warning">
                <AlertTriangle className="h-3 w-3" />
                Approaching limit
              </span>
            )}
          </div>
        </div>
      )}
    </Link>
  )
}
