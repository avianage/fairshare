import { ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react"
import { Card } from "@/components/ui/card"
import { formatINR as inr } from "@/lib/format"
import { cn } from "@/lib/utils"

export function SummaryCards({
  totalOwed,
  totalOwing,
  netBalance,
}: {
  totalOwed: number
  totalOwing: number
  netBalance: number
}) {
  const netClass =
    netBalance > 0
      ? "text-success"
      : netBalance < 0
        ? "text-warning"
        : "text-foreground"

  const items = [
    {
      label: "Total owed to you",
      value: inr(totalOwed),
      valueClass: "text-success",
      icon: ArrowDownLeft,
      iconClass: "bg-success/10 text-success",
    },
    {
      label: "Total you owe",
      value: inr(totalOwing),
      valueClass: "text-warning",
      icon: ArrowUpRight,
      iconClass: "bg-warning/10 text-warning",
    },
    {
      label: "Net balance",
      value: netBalance >= 0 ? inr(netBalance) : `-${inr(-netBalance)}`,
      valueClass: netClass,
      icon: Scale,
      iconClass: "bg-primary/10 text-primary",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((it) => {
        const Icon = it.icon
        return (
          <Card key={it.label} className="p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{it.label}</p>
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  it.iconClass
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className={cn("mt-2 text-2xl font-semibold tabular-nums", it.valueClass)}>
              {it.value}
            </p>
          </Card>
        )
      })}
    </div>
  )
}
