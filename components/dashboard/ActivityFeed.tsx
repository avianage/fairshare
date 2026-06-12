import { categoryMeta } from "@/lib/categories"
import { formatINR as inr, formatRelativeTime } from "@/lib/format"

type Activity = {
  type: "expense" | "settlement"
  groupName: string
  description: string
  amount: number
  date: string | Date
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
    <ul className="divide-y rounded-xl border bg-card">
      {activity.map((a, i) => {
        const names = a.involvedUsers.map((u) => u.name)
        // De-dupe names while keeping order (payer often appears in splits too).
        const unique = [...new Set(names)]
        const who =
          unique.length > 3
            ? `${unique.slice(0, 3).join(", ")} +${unique.length - 3}`
            : unique.join(", ")

        return (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-base">
              {a.type === "settlement" ? "💸" : categoryMeta("OTHER").icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.description}</p>
              <p className="truncate text-xs text-muted-foreground">
                {a.groupName} · {who}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold">{inr(a.amount)}</p>
              <p className="text-xs text-muted-foreground">
                {formatRelativeTime(a.date)}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
