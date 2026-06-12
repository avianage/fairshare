import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { formatINR } from "@/lib/format"
import { cn } from "@/lib/utils"

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export type UserDebtRowProps = {
  userId: string
  name: string
  avatar: string | null
  amount: number
  /** "owed" = they owe you (green); "owe" = you owe them (orange). */
  tone: "owed" | "owe"
}

export function UserDebtRow({ userId, name, avatar, amount, tone }: UserDebtRowProps) {
  return (
    <Link
      href={`/balances/${userId}`}
      className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(name)
        )}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      <span
        className={cn(
          "shrink-0 font-semibold tabular-nums",
          tone === "owed" ? "text-success" : "text-warning"
        )}
      >
        {formatINR(amount)}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
