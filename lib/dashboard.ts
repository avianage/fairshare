import { prisma } from "@/lib/prisma"
import { computeGroupBalances } from "@/lib/balances"
import { getGlobalDebts } from "@/lib/globalBalances"
import { directExpenseVisibilityWhere } from "@/lib/directExpenses"

export type DashboardData = {
  totalOwed: number
  totalOwing: number
  netBalance: number
  groups: {
    id: string
    name: string
    emoji: string | null
    memberCount: number
    userBalance: number
    lastActivityAt: Date
  }[]
  recentActivity: {
    type: "expense" | "settlement"
    groupName: string
    description: string
    amount: number
    date: Date
    category?: string
    involvedUsers: { name: string }[]
  }[]
}

/**
 * Cross-group balances + recent activity for a user. Shared by the dashboard
 * API route and the dashboard server page so both stay in sync. Only ever
 * touches groups the user is CURRENTLY a member of.
 */
export async function getDashboardData(userId: string): Promise<DashboardData> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, group: { deletedAt: null } },
    select: {
      group: {
        select: {
          id: true,
          name: true,
          emoji: true,
          updatedAt: true,
          _count: { select: { members: true } },
        },
      },
    },
  })

  const groupIds = memberships.map((m) => m.group.id)

  // Per-group net for group cards + gross per-person totals for summary cards.
  const [balancesByGroup, globalDebts] = await Promise.all([
    Promise.all(groupIds.map((gid) => computeGroupBalances(gid))),
    getGlobalDebts(userId),
  ])

  const groups = memberships.map((m, i) => {
    const net = balancesByGroup[i].net[userId] ?? 0
    return {
      id: m.group.id,
      name: m.group.name,
      emoji: m.group.emoji,
      memberCount: m.group._count.members,
      userBalance: Math.round(net * 100) / 100,
      lastActivityAt: m.group.updatedAt,
    }
  })

  // Gross totals: sum each counterparty's balance independently so "you owe A ₹100"
  // and "B owes you ₹30" both appear rather than collapsing to a single net figure.
  const totalOwed = Math.round(globalDebts.owedToYou.reduce((s, r) => s + r.amount, 0) * 100) / 100
  const totalOwing = Math.round(globalDebts.youOwe.reduce((s, r) => s + r.amount, 0) * 100) / 100

  // Recent activity is scoped to groupIds → never includes left groups.
  const [expenses, settlements, directExpenses, directSettlements] = await Promise.all([
    groupIds.length
      ? prisma.expense.findMany({
          where: { groupId: { in: groupIds }, deletedAt: null },
          select: {
            description: true,
            amount: true,
            date: true,
            category: true,
            group: { select: { name: true } },
            payer: { select: { name: true } },
            splits: { select: { user: { select: { name: true } } } },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 10,
        })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.settlement.findMany({
          where: { groupId: { in: groupIds } },
          select: {
            amount: true,
            createdAt: true,
            group: { select: { name: true } },
            sender: { select: { name: true } },
            receiver: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
    // Direct (non-group) expenses the user participates in.
    prisma.expense.findMany({
      where: directExpenseVisibilityWhere(userId),
      select: {
        description: true,
        amount: true,
        date: true,
        category: true,
        payer: { select: { name: true } },
        splits: { select: { user: { select: { name: true } } } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
    // Direct settlements the user is a party to.
    prisma.settlement.findMany({
      where: { groupId: null, OR: [{ senderId: userId }, { receiverId: userId }] },
      select: {
        amount: true,
        createdAt: true,
        sender: { select: { name: true } },
        receiver: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ])

  const recentActivity: DashboardData["recentActivity"] = [
    ...expenses.map((e) => ({
      type: "expense" as const,
      groupName: e.group?.name ?? "",
      description: e.description,
      amount: e.amount.toNumber(),
      date: e.date,
      category: e.category,
      involvedUsers: [
        { name: e.payer.name },
        ...e.splits.map((s) => ({ name: s.user.name })),
      ],
    })),
    ...directExpenses.map((e) => ({
      type: "expense" as const,
      groupName: "Direct",
      description: e.description,
      amount: e.amount.toNumber(),
      date: e.date,
      category: e.category,
      involvedUsers: [
        { name: e.payer.name },
        ...e.splits.map((s) => ({ name: s.user.name })),
      ],
    })),
    ...directSettlements.map((s) => ({
      type: "settlement" as const,
      groupName: "Direct",
      description: `${s.sender.name} paid ${s.receiver.name}`,
      amount: s.amount.toNumber(),
      date: s.createdAt,
      involvedUsers: [{ name: s.sender.name }, { name: s.receiver.name }],
    })),
    ...settlements.map((s) => ({
      type: "settlement" as const,
      groupName: s.group?.name ?? "",
      description: `${s.sender.name} paid ${s.receiver.name}`,
      amount: s.amount.toNumber(),
      date: s.createdAt,
      involvedUsers: [{ name: s.sender.name }, { name: s.receiver.name }],
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)

  return {
    totalOwed,
    totalOwing,
    netBalance: Math.round((totalOwed - totalOwing) * 100) / 100,
    groups,
    recentActivity,
  }
}
