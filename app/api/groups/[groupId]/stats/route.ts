import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireGroupMember } from "@/lib/auth-helpers"

type Params = { params: { groupId: string } }

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

// GET /api/groups/[groupId]/stats — spending summary for the group.
// All figures derive from non-deleted expenses only.
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await requireGroupMember(params.groupId, session.user.id)
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    throw e
  }

  const groupId = params.groupId
  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = startOfMonth(
    new Date(now.getFullYear(), now.getMonth() - 1, 1)
  )

  const [members, byCategoryRaw, totalAgg, thisMonthAgg, lastMonthAgg, paidByUser] =
    await Promise.all([
      prisma.groupMember.findMany({
        where: { groupId },
        select: { user: { select: { id: true, name: true } } },
      }),
      prisma.expense.groupBy({
        by: ["category"],
        where: { groupId, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { groupId, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { groupId, deletedAt: null, date: { gte: thisMonthStart } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: {
          groupId,
          deletedAt: null,
          date: { gte: lastMonthStart, lt: thisMonthStart },
        },
        _sum: { amount: true },
      }),
      // Amount each member has PAID (as payer).
      prisma.expense.groupBy({
        by: ["payerId"],
        where: { groupId, deletedAt: null },
        _sum: { amount: true },
      }),
    ])

  // Amount each member OWES = sum of their split shares across non-deleted expenses.
  const owesRows = await prisma.expenseSplit.groupBy({
    by: ["userId"],
    where: { expense: { groupId, deletedAt: null } },
    _sum: { amount: true },
  })

  const paidMap = new Map(
    paidByUser.map((p) => [p.payerId, p._sum.amount?.toNumber() ?? 0])
  )
  const owesMap = new Map(
    owesRows.map((o) => [o.userId, o._sum.amount?.toNumber() ?? 0])
  )

  const byMember = members.map((m) => ({
    userId: m.user.id,
    name: m.user.name,
    paid: paidMap.get(m.user.id) ?? 0,
    owes: owesMap.get(m.user.id) ?? 0,
  }))

  const byCategory = byCategoryRaw
    .map((c) => ({ category: c.category, amount: c._sum.amount?.toNumber() ?? 0 }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  return NextResponse.json({
    totalSpend: totalAgg._sum.amount?.toNumber() ?? 0,
    byCategory,
    byMember,
    thisMonth: thisMonthAgg._sum.amount?.toNumber() ?? 0,
    lastMonth: lastMonthAgg._sum.amount?.toNumber() ?? 0,
  })
}
