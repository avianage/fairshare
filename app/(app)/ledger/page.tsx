import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import {
  getGlobalDebtsWithContext,
  getSimplifiedGlobalPayments,
  type BilateralEntry,
} from "@/lib/globalBalances"
import { formatINR } from "@/lib/format"
import { Confetti } from "@/components/balances/Confetti"
import { LedgerViewToggle } from "@/components/balances/LedgerViewToggle"
import { cn } from "@/lib/utils"
import Link from "next/link"

export const metadata = { title: "Ledger · Fairshare" }

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

function BilateralColumn({
  title,
  entries,
  tone,
}: {
  title: string
  entries: BilateralEntry[]
  tone: "owed" | "owe"
}) {
  if (entries.length === 0) return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        {tone === "owed" ? "No one owes you right now." : "You don't owe anyone right now."}
      </p>
    </section>
  )

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="space-y-2">
        {entries.map((e) => (
          <li key={e.userId} className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Link
              href={`/ledger/${e.userId}`}
              className="flex items-center gap-3 p-3 hover:bg-accent/40 transition-colors"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {e.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  (<img src={e.avatar} alt="" className="h-full w-full object-cover" />)
                ) : (
                  initials(e.name)
                )}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
              <span className={cn(
                "shrink-0 font-semibold tabular-nums",
                tone === "owed" ? "text-success" : "text-warning"
              )}>
                {formatINR(e.total)}
              </span>
            </Link>
            {e.contexts.length > 0 && (
              <div className="border-t divide-y divide-border/50">
                {e.contexts.map((ctx, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground"
                  >
                    <span className="truncate">
                      {ctx.groupId === null ? "Direct expenses" : (ctx.groupName ?? "Group")}
                    </span>
                    <span className={cn(
                      "shrink-0 ml-3 tabular-nums font-medium",
                      tone === "owed" ? "text-success/80" : "text-warning/80"
                    )}>
                      {formatINR(ctx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function LedgerPage(
  props: {
    searchParams: Promise<{ view?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const isGlobal = searchParams.view !== "group"

  const [{ owedToYou, youOwe, netBalance }, simplified] = await Promise.all([
    getGlobalDebtsWithContext(userId),
    isGlobal ? getSimplifiedGlobalPayments(userId) : Promise.resolve([]),
  ])
  const settled = Math.abs(netBalance) < 0.01

  return (
    <div className="space-y-8">
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold">Ledger</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your net balances across every group and direct expense.
        </p>
      </div>

      {/* View toggle */}
      <LedgerViewToggle />

      {/* Hero summary */}
      <div className="relative overflow-hidden rounded-2xl border bg-card p-8 text-center shadow-sm">
        {settled && <Confetti />}
        <p className="text-sm text-muted-foreground">
          {settled ? "You're all square" : netBalance > 0 ? "You are owed" : "You owe"}
        </p>
        <p className={cn(
          "mt-1 text-4xl font-bold tabular-nums sm:text-5xl",
          settled ? "text-muted-foreground" : netBalance > 0 ? "text-success" : "text-warning"
        )}>
          {settled ? "All settled up ✓" : formatINR(Math.abs(netBalance))}
        </p>
      </div>

      {/* Simplified payments — global mode only */}
      {isGlobal && !settled && simplified.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">Simplified payments</h2>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Minimum transfers needed to settle all balances
            </p>
          </div>
          <ul className="space-y-2">
            {simplified.map((p, i) => {
              const youAreFrom = p.fromUserId === userId
              const youAreTo = p.toUserId === userId
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-4 py-3",
                    youAreFrom
                      ? "border-warning/30 bg-warning/5"
                      : youAreTo
                        ? "border-success/30 bg-success/5"
                        : "bg-card"
                  )}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className={cn("font-medium", youAreFrom && "text-warning")}>
                      {youAreFrom ? "You" : p.fromName}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className={cn("font-medium", youAreTo && "text-success")}>
                      {youAreTo ? "You" : p.toName}
                    </span>
                  </div>
                  <span className={cn(
                    "text-sm font-semibold tabular-nums",
                    youAreFrom ? "text-warning" : youAreTo ? "text-success" : "text-foreground"
                  )}>
                    {formatINR(p.amount)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Bilateral breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        <BilateralColumn title="They owe you" entries={owedToYou} tone="owed" />
        <BilateralColumn title="You owe" entries={youOwe} tone="owe" />
      </div>
    </div>
  )
}
