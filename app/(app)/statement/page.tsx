import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { StatementTable } from "./StatementTable"

export const metadata = { title: "Statement · Fairshare" }

export default async function StatementPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const memberships = await prisma.groupMember.findMany({
    where: { userId: session.user.id },
    select: { group: { select: { id: true, name: true, deletedAt: true } } },
  })
  const groups = memberships
    .map((m) => ({
      id: m.group.id,
      name: m.group.name,
      deleted: !!m.group.deletedAt,
    }))
    .sort((a, b) => Number(a.deleted) - Number(b.deleted))

  return (
    <div className="space-y-6">
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold">Statement</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete history of all your expenses and settlements.
        </p>
      </div>
      <StatementTable groups={groups} />
    </div>
  )
}
