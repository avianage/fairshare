import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getGlobalDebts } from "@/lib/globalBalances"
import { formatINR } from "@/lib/format"
import { UserDebtRow } from "@/components/balances/UserDebtRow"
import { Confetti } from "@/components/balances/Confetti"
import { cn } from "@/lib/utils"

export const metadata = { title: "Ledger · Fairshare" }

export default async function LedgerPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { owedToYou, youOwe, netBalance } = await getGlobalDebts(session.user.id)
  const settled = Math.abs(netBalance) < 0.01

  return (
    <div className="space-y-8">
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold">Ledger</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your net balances across every group and direct expense.
        </p>
      </div>

      {/* Hero summary */}
      <div className="relative overflow-hidden rounded-2xl border bg-card p-8 text-center shadow-sm">
        {settled && <Confetti />}
        <p className="text-sm text-muted-foreground">
          {settled
            ? "You're all square"
            : netBalance > 0
              ? "You are owed"
              : "You owe"}
        </p>
        <p
          className={cn(
            "mt-1 text-4xl font-bold tabular-nums sm:text-5xl",
            settled
              ? "text-muted-foreground"
              : netBalance > 0
                ? "text-success"
                : "text-warning"
          )}
        >
          {settled
            ? "All settled up ✓"
            : formatINR(Math.abs(netBalance))}
        </p>
      </div>

      {/* Two columns */}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            They owe you
          </h2>
          {owedToYou.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No one owes you right now.
            </p>
          ) : (
            <ul className="space-y-2">
              {owedToYou.map((d) => (
                <li key={d.userId}>
                  <UserDebtRow {...d} tone="owed" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">You owe</h2>
          {youOwe.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              You don&apos;t owe anyone right now.
            </p>
          ) : (
            <ul className="space-y-2">
              {youOwe.map((d) => (
                <li key={d.userId}>
                  <UserDebtRow {...d} tone="owe" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
