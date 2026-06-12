import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"

export default async function GroupsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const memberships = await prisma.groupMember.findMany({
    where: { userId: session.user.id, group: { deletedAt: null } },
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Groups you share expenses with.
          </p>
        </div>
        <Button asChild>
          <Link href="/groups/new">New group</Link>
        </Button>
      </div>

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
          {memberships.map(({ role, group }) => (
            <li key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    {group.emoji ?? "👥"}
                  </span>
                  <span className="truncate font-medium">{group.name}</span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {group._count.members}{" "}
                    {group._count.members === 1 ? "member" : "members"}
                  </span>
                  <span className="flex items-center gap-2">
                    <span>{group.currency}</span>
                    {role === "ADMIN" && (
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                        Admin
                      </span>
                    )}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
