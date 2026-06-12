import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getDashboardData } from "@/lib/dashboard"
import { SummaryCards } from "@/components/dashboard/SummaryCards"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { Button } from "@/components/ui/button"
import { formatINR as inr } from "@/lib/format"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const data = await getDashboardData(session.user.id)

  return (
    <div className="space-y-8">
      <div>
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
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.groups.map((g) => {
              const owes = g.userBalance < 0
              const even = Math.abs(g.userBalance) < 0.01
              return (
                <li key={g.id}>
                  <Link
                    href={`/groups/${g.id}`}
                    className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden>
                        {g.emoji ?? "👥"}
                      </span>
                      <span className="truncate font-medium">{g.name}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {g.memberCount}{" "}
                        {g.memberCount === 1 ? "member" : "members"}
                      </span>
                      <span
                        className={
                          even
                            ? "text-muted-foreground"
                            : owes
                              ? "font-medium text-warning"
                              : "font-medium text-success"
                        }
                      >
                        {even
                          ? "settled up"
                          : owes
                            ? `you owe ${inr(-g.userBalance)}`
                            : `owed ${inr(g.userBalance)}`}
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
