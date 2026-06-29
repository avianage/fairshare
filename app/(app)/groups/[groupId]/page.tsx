import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { AddExpense } from "@/components/expenses/AddExpense"
import { BalanceSummary } from "@/components/balances/BalanceSummary"
import { SpendingSummary } from "@/components/groups/SpendingSummary"
import { GroupExpenses } from "@/components/groups/GroupExpenses"
import { AddMemberModal } from "@/components/groups/AddMemberModal"
import { AddFriendButton } from "@/components/groups/AddFriendButton"
import { expenseInclude, serializeExpense } from "@/lib/expense-shape"

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: { groupId: string }
  searchParams?: { welcome?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  // Membership check — never reveal groups the user doesn't belong to.
  const membership = await prisma.groupMember.findUnique({
    where: {
      userId_groupId: { userId: session.user.id, groupId: params.groupId },
    },
    select: { role: true },
  })
  if (!membership) notFound()

  const group = await prisma.group.findFirst({
    where: { id: params.groupId, deletedAt: null },
    select: {
      id: true,
      name: true,
      emoji: true,
      description: true,
      currency: true,
      members: {
        select: {
          role: true,
          user: { select: { id: true, name: true, email: true, avatar: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  })
  if (!group) notFound()

  // Most recent expenses (never include soft-deleted rows).
  const expenseRows = await prisma.expense.findMany({
    where: { groupId: group.id, deletedAt: null },
    include: expenseInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 20,
  })
  const expenses = expenseRows.map(serializeExpense)
  const totalAgg = await prisma.expense.aggregate({
    where: { groupId: group.id, deletedAt: null },
    _sum: { amount: true },
  })
  const initialTotal = totalAgg._sum.amount ? totalAgg._sum.amount.toNumber() : 0
  const members = group.members.map((m) => ({ id: m.user.id, name: m.user.name }))

  const otherMemberIds = group.members
    .map((m) => m.user.id)
    .filter((id) => id !== session.user.id)

  const [friendships, sentRequests, receivedRequests] = await Promise.all([
    prisma.friendship.findMany({
      where: { userId: session.user.id, friendId: { in: otherMemberIds } },
      select: { friendId: true },
    }),
    prisma.friendRequest.findMany({
      where: { senderId: session.user.id, receiverId: { in: otherMemberIds } },
      select: { id: true, receiverId: true },
    }),
    prisma.friendRequest.findMany({
      where: { senderId: { in: otherMemberIds }, receiverId: session.user.id },
      select: { id: true, senderId: true },
    }),
  ])

  const friendSet = new Set(friendships.map((f) => f.friendId))
  const sentMap = new Map(sentRequests.map((r) => [r.receiverId, r.id]))
  const receivedMap = new Map(receivedRequests.map((r) => [r.senderId, r.id]))

  type FriendStatus = "self" | "friend" | "request_sent" | "request_received" | "none"
  const memberStatus = new Map<string, { status: FriendStatus; requestId?: string }>()
  for (const m of group.members) {
    const uid = m.user.id
    if (uid === session.user.id) {
      memberStatus.set(uid, { status: "self" })
    } else if (friendSet.has(uid)) {
      memberStatus.set(uid, { status: "friend" })
    } else if (sentMap.has(uid)) {
      memberStatus.set(uid, { status: "request_sent", requestId: sentMap.get(uid) })
    } else if (receivedMap.has(uid)) {
      memberStatus.set(uid, { status: "request_received", requestId: receivedMap.get(uid) })
    } else {
      memberStatus.set(uid, { status: "none" })
    }
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            {group.emoji ?? "👥"}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{group.name}</h1>
            {group.description && (
              <p className="mt-0.5 text-sm text-muted-foreground break-words">
                {group.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px] lg:items-start">
        {/* Members sidebar */}
        <aside className="order-2 h-fit rounded-xl border bg-card p-4 shadow-sm lg:order-2 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Members ({group.members.length})
              </h2>
              {membership.role === "ADMIN" && (
                <AddMemberModal groupId={group.id} autoOpen={searchParams?.welcome === "1"} />
              )}
            </div>
            <ul className="space-y-2">
              {group.members.map((m) => {
                const ms = memberStatus.get(m.user.id)!
                return (
                  <li key={m.user.id} className="group flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(m.user.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.user.email}
                      </p>
                    </div>
                    {m.role === "ADMIN" && (
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Admin
                      </span>
                    )}
                    {ms.status !== "self" && (
                      <AddFriendButton
                        memberId={m.user.id}
                        initialStatus={ms.status}
                        initialRequestId={ms.requestId}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
          <Button variant="outline" asChild className="w-full">
            <Link href={`/groups/${group.id}/settings`}>Settings</Link>
          </Button>
        </aside>

        {/* Expense area */}
        <section className="order-1 space-y-4 lg:order-1 min-w-0">
          <BalanceSummary
            groupId={group.id}
            currency={group.currency}
            currentUserId={session.user.id}
          />

          <SpendingSummary groupId={group.id} />

          <AddExpense
            groupId={group.id}
            members={members}
            currentUserId={session.user.id}
          />

          <GroupExpenses
            groupId={group.id}
            currency={group.currency}
            currentUserId={session.user.id}
            isAdmin={membership.role === "ADMIN"}
            initialExpenses={expenses}
            initialTotal={initialTotal}
          />
        </section>
      </div>
    </div>
  )
}
