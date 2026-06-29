import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { auth } from "@/lib/auth"
import { getDirectContacts } from "@/lib/directExpenses"
import { formatINR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { AutoRefresh } from "@/components/ui/AutoRefresh"

export default async function DirectExpensesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const contacts = await getDirectContacts(session.user.id)

  const active = contacts.filter((c) => Math.abs(c.net) >= 0.01)
  const settled = contacts.filter((c) => Math.abs(c.net) < 0.01)

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <Link
        href="/groups"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Groups
      </Link>

      <div className="hidden md:block border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Non-group Expenses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Individual expenses between you and others, not tied to any group.
        </p>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">No individual expenses yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use the + button to add an expense with a person or anyone.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Outstanding
              </h2>
              <ul className="divide-y rounded-xl border bg-card shadow-sm">
                {active.map(({ user, net }) => {
                  const theyOwe = net > 0
                  return (
                    <li key={user.id}>
                      <Link
                        href={`/direct-expenses/${user.id}`}
                        className="flex items-center gap-4 px-4 py-3.5 hover:bg-accent/40 transition-colors"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{user.name}</p>
                          <p className={cn(
                            "text-xs font-medium",
                            theyOwe ? "text-success" : "text-warning"
                          )}>
                            {theyOwe
                              ? `owes you ${formatINR(net)}`
                              : `you owe ${formatINR(-net)}`}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {settled.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Settled up
              </h2>
              <ul className="divide-y rounded-xl border bg-card shadow-sm">
                {settled.map(({ user }) => (
                  <li key={user.id}>
                    <Link
                      href={`/direct-expenses/${user.id}`}
                      className="flex items-center gap-4 px-4 py-3.5 hover:bg-accent/40 transition-colors"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-muted-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground">All settled up</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
