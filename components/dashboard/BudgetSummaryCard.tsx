import Link from "next/link"
import { PiggyBank } from "lucide-react"
import { formatINR } from "@/lib/format"

export function BudgetSummaryCard({
  totalSpent,
  totalBudget,
}: {
  totalSpent: number
  totalBudget: number | null
}) {
  const remaining = totalBudget !== null ? totalBudget - totalSpent : 0
  const pct = totalBudget && totalBudget > 0 ? Math.max((remaining / totalBudget) * 100, 0) : 0
  const isOver = totalBudget !== null && totalSpent > totalBudget
  const isNear = !isOver && totalBudget !== null && pct <= 20
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
            <span className={`text-lg font-bold tabular-nums ${isOver ? "text-destructive" : isNear ? "text-warning" : ""}`}>
              {isOver ? `−${formatINR(Math.abs(remaining))}` : formatINR(remaining)}
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
            <span className={`text-[11px] ${isOver ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              {isOver ? "Over budget" : `${pct.toFixed(0)}% remaining`}
            </span>
            {isNear && !isOver && (
              <span className="text-[11px] font-medium text-warning">Approaching limit</span>
            )}
          </div>
        </div>
      )}
    </Link>
  )
}
