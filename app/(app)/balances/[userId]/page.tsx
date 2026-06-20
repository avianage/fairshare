import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getPairwiseBalance } from "@/lib/globalBalances"
import { formatINR, formatRelativeTime } from "@/lib/format"
import { PairwiseSettleButton } from "@/components/balances/PairwiseSettleButton"
import { cn } from "@/lib/utils"

export default async function PairwiseBalancePage({
  params,
}: {
  params: { userId: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const otherId = params.userId
  if (otherId === session.user.id) notFound()

  const other = await prisma.user.findUnique({
    where: { id: otherId },
    select: { id: true, name: true, avatar: true },
  })
  if (!other) notFound()

  const { expenses, net, directNet } = await getPairwiseBalance(
    session.user.id,
    otherId
  )

  // No shared history → nothing this user is allowed to see about the other.
  if (expenses.length === 0) notFound()

  const settled = Math.abs(net) < 0.01
  const theyOwe = net > 0.01 // positive = they owe you
  // Only a DIRECT balance you owe can be settled here; group debts settle in-group.
  const owesDirect = directNet < -0.01

  return (
    <div className="space-y-6">
      <Link
        href="/balances"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to balances
      </Link>

      {/* Summary header */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{other.name}</h1>
          <p
            className={cn(
              "mt-1 text-sm font-medium",
              settled
                ? "text-muted-foreground"
                : theyOwe
                  ? "text-success"
                  : "text-warning"
            )}
          >
            {settled
              ? "You're all settled up"
              : theyOwe
                ? `${other.name} owes you ${formatINR(net)}`
                : `You owe ${other.name} ${formatINR(-net)}`}
          </p>
        </div>
        {!settled && !theyOwe && (
          <PairwiseSettleButton
            counterpartyId={other.id}
            counterpartyName={other.name}
          />
        )}
      </div>

      {/* Contributing expenses */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Shared expenses ({expenses.length})
        </h2>
        <ul className="divide-y rounded-xl border bg-card shadow-sm">
          {expenses.map((e) => {
            const youPaid = e.payer.id === session.user.id
            const href = `/expenses/${e.id}`
            return (
              <li key={e.id}>
                <Link
                  href={href}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.description}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span
                        className={cn(
                          "mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
                          e.groupName
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {e.groupName ?? "Direct"}
                      </span>
                      {youPaid ? "You paid" : `${e.payer.name} paid`} ·{" "}
                      {formatRelativeTime(e.date)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">
                      {formatINR(e.amount)}
                    </p>
                    <p
                      className={cn(
                        "text-xs tabular-nums",
                        youPaid ? "text-success" : "text-warning"
                      )}
                    >
                      {youPaid
                        ? `${other.name} owes ${formatINR(e.theirShare)}`
                        : `you owe ${formatINR(e.yourShare)}`}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
