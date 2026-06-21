import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { computeGroupBalances } from "@/lib/balances"
import { formatINR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export default async function GroupsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const memberships = await prisma.groupMember.findMany({
    where: { userId, group: { deletedAt: null } },
    select: {
      role: true,
      group: {
        select: {
          id: true,
          name: true,
          emoji: true,
          currency: true,
          updatedAt: true,
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { group: { updatedAt: "desc" } },
  })

  const balanceResults = await Promise.all(
    memberships.map((m) => computeGroupBalances(m.group.id))
  )
  const balanceMap = new Map(
    memberships.map((m, i) => [m.group.id, Math.round((balanceResults[i].net[userId] ?? 0) * 100) / 100])
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="hidden md:block">
          <h1 className="text-2xl font-semibold">Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Groups you share expenses with.
          </p>
        </div>
        <Button asChild className="md:ml-0 ml-auto">
          <Link href="/groups/new">New group</Link>
        </Button>
      </div>

      {/* Non-group expenses pseudo-group card */}
      <Link
        href="/direct-expenses"
        className="mb-6 flex items-center gap-3 rounded-xl border border-dashed bg-card/50 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      >
        <span className="text-2xl" aria-hidden>💸</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Non-group expenses</p>
          <p className="text-xs text-muted-foreground">Individual expenses between you and others</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      {memberships.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            You&apos;re not in any groups yet.
          </p>
          <Button asChild className="mt-4">
            <Link href="/groups/new">Create your first group</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map(({ role, group }) => {
            const userBalance = balanceMap.get(group.id) ?? 0
            const owes = userBalance < 0
            const even = Math.abs(userBalance) < 0.01
            return (
              <li key={group.id}>
                <Link
                  href={`/groups/${group.id}`}
                  className={cn(
                    "flex h-full flex-col rounded-xl border bg-card/65 backdrop-blur-md p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/30",
                    even ? "border-border/60" : owes ? "border-l-4 border-l-warning" : "border-l-4 border-l-success"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-2xl" aria-hidden>
                      {group.emoji ?? "👥"}
                    </span>
                    <span className="truncate font-semibold tracking-tight">{group.name}</span>
                    {role === "ADMIN" && (
                      <span className="ml-auto shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="mt-6 flex items-center justify-between text-xs">
                    <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground font-medium">
                      {group._count.members}{" "}
                      {group._count.members === 1 ? "member" : "members"}
                    </span>
                    <span className={cn(
                      "rounded-md px-2.5 py-1 font-semibold",
                      even
                        ? "bg-muted text-muted-foreground"
                        : owes
                          ? "bg-warning/10 text-warning"
                          : "bg-success/10 text-success"
                    )}>
                      {even
                        ? "Settled up"
                        : owes
                          ? `You owe ${formatINR(-userBalance)}`
                          : `Owed ${formatINR(userBalance)}`}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
