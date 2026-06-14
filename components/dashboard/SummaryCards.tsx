import Link from "next/link"
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
      borderClass: "border-t-2 border-t-success",
    },
    {
      label: "Total you owe",
      value: inr(totalOwing),
      valueClass: "text-warning",
      icon: ArrowUpRight,
      iconClass: "bg-warning/10 text-warning",
      borderClass: "border-t-2 border-t-warning",
    },
    {
      label: "Net balance",
      value: netBalance >= 0 ? inr(netBalance) : `-${inr(-netBalance)}`,
      valueClass: netClass,
      icon: Scale,
      iconClass: "bg-primary/10 text-primary",
      borderClass: "border-t-2 border-t-primary",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((it) => {
        const Icon = it.icon
        const isNetBalance = it.label === "Net balance"
        const card = (
          <Card
            key={it.label}
            className={cn(
              "p-5 shadow-sm border bg-card/65 backdrop-blur-md relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5",
              it.borderClass,
              isNetBalance && "cursor-pointer hover:border-primary/50"
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{it.label}</p>
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", it.iconClass)}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className={cn("mt-3 text-2xl font-bold tracking-tight tabular-nums", it.valueClass)}>
              {it.value}
            </p>
          </Card>
        )
        return isNetBalance ? (
          <Link key={it.label} href="/balances" className="block">{card}</Link>
        ) : (
          <div key={it.label} className="block">{card}</div>
        )
      })}
    </div>
  )
}
