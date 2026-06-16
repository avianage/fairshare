import { categoryMeta } from "@/lib/categories"
import { formatINR as inr, formatRelativeTime } from "@/lib/format"

type Activity = {
  type: "expense" | "settlement"
  groupName: string
  description: string
  amount: number
  date: string | Date
  category?: string
  involvedUsers: { name: string }[]
}

export function ActivityFeed({ activity }: { activity: Activity[] }) {
  if (activity.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-8 text-center">
        <p className="text-sm font-medium">No activity yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Expenses and settlements across your groups will show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="relative border bg-card/65 backdrop-blur-md rounded-xl p-5 shadow-sm overflow-hidden">
      <div className="absolute top-8 bottom-8 left-9.5 w-0.5 bg-border/70" />
      <ul className="space-y-6 relative z-10">
        {activity.map((a, i) => {
          const names = a.involvedUsers.map((u) => u.name)
          const unique = [...new Set(names)]
          const who =
            unique.length > 3
              ? `${unique.slice(0, 3).join(", ")} +${unique.length - 3}`
              : unique.join(", ")

          const isSettlement = a.type === "settlement"

          return (
            <li key={i} className="flex gap-4 group items-start">
              <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base transition-all duration-300 group-hover:scale-110 shadow-sm ${
                isSettlement ? "bg-success/15 border border-success/30 text-success" : "bg-primary/10 border border-primary/20 text-primary"
              }`}>
                {isSettlement ? "💸" : categoryMeta(a.category ?? "OTHER").icon}
              </span>
              
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
                  {a.description}
                </p>
                <p className="truncate text-xs text-muted-foreground mt-0.5">
                  <span className="font-medium text-foreground/80">{a.groupName}</span> · {who}
                </p>
              </div>

              <div className="shrink-0 text-right pt-0.5">
                <p className={`text-sm font-bold tabular-nums ${isSettlement ? "text-success" : "text-foreground"}`}>
                  {inr(a.amount)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatRelativeTime(a.date)}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
