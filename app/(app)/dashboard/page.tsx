import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getDashboardData } from "@/lib/dashboard"
import { getTotalMonthSpending } from "@/lib/budgets"
import { SummaryCards } from "@/components/dashboard/SummaryCards"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { BudgetSummaryCard } from "@/components/dashboard/BudgetSummaryCard"
import { Button } from "@/components/ui/button"
import { formatINR as inr } from "@/lib/format"
import { cn } from "@/lib/utils"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const now = new Date()
  const [data, totalMonthSpent, userRecord] = await Promise.all([
    getDashboardData(userId),
    getTotalMonthSpending(userId, now),
    prisma.user.findUnique({ where: { id: userId }, select: { totalMonthlyBudget: true } }),
  ])

  return (
    <div className="space-y-8">
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your balances across all groups.
        </p>
      </div>

      <SummaryCards
        totalOwed={data.totalOwed}
        totalOwing={data.totalOwing}
        netBalance={data.netBalance}
      />

      <BudgetSummaryCard
        totalSpent={totalMonthSpent}
        totalBudget={userRecord?.totalMonthlyBudget?.toNumber() ?? null}
      />

      {/* Groups */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Your groups
          </h2>
          <Button variant="outline" size="sm" asChild>
            <Link href="/groups">View all</Link>
          </Button>
        </div>

        {data.groups.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-8 text-center">
            <p className="text-sm font-medium">You&apos;re not in any groups yet</p>
            <Button asChild className="mt-3">
              <Link href="/groups/new">Create a group</Link>
            </Button>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.groups.map((g) => {
              const owes = g.userBalance < 0
              const even = Math.abs(g.userBalance) < 0.01
              return (
                <li key={g.id}>
                  <Link
                    href={`/groups/${g.id}`}
                    className={cn(
                      "flex h-full flex-col rounded-xl border bg-card/65 backdrop-blur-md p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/30",
                      even ? "border-border/60" : owes ? "border-l-4 border-l-warning" : "border-l-4 border-l-success"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-2xl" aria-hidden>
                        {g.emoji ?? "👥"}
                      </span>
                      <span className="truncate font-semibold tracking-tight">{g.name}</span>
                    </div>
                    <div className="mt-6 flex items-center justify-between text-xs">
                      <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground font-medium">
                        {g.memberCount}{" "}
                        {g.memberCount === 1 ? "member" : "members"}
                      </span>
                      <span
                        className={cn(
                          "rounded-md px-2.5 py-1 font-semibold",
                          even
                            ? "bg-muted text-muted-foreground"
                            : owes
                              ? "bg-warning/10 text-warning"
                              : "bg-success/10 text-success"
                        )}
                      >
                        {even
                          ? "Settled up"
                          : owes
                            ? `You owe ${inr(-g.userBalance)}`
                            : `Owed ${inr(g.userBalance)}`}
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Recent activity */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Recent activity
        </h2>
        <ActivityFeed activity={data.recentActivity} />
      </section>
    </div>
  )
}
