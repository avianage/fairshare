import { prisma } from "@/lib/prisma"
import {
  directExpenseInclude,
  serializeDirectExpense,
  type DirectExpenseWithRelations,
} from "@/lib/expense-shape"
import {
  buildRawDebts,
  simplifyDebts,
  type RawDebt,
  type SimplifiedDebt,
} from "@/lib/splitEngine"

/**
 * Where-clause for direct expenses (groupId = null, not soft-deleted) in which
 * `userId` participates — either as the payer or via a DirectParticipant row.
 * This is the single source of truth for "can this user see this expense".
 */
export function directExpenseVisibilityWhere(userId: string) {
  return {
    groupId: null,
    deletedAt: null,
    OR: [{ payerId: userId }, { participants: { some: { userId } } }],
  }
}

/**
 * All direct expenses the user participates in, newest first, with payer,
 * participants and split amounts. Returns serialized (Decimal→number) rows.
 */
export async function getDirectExpensesForUser(userId: string) {
  const rows = await prisma.expense.findMany({
    where: directExpenseVisibilityWhere(userId),
    include: directExpenseInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  })
  return rows.map(serializeDirectExpense)
}

/**
 * All unique people the current user has direct expenses with, along with the
 * bilateral net balance (positive = they owe you, negative = you owe them).
 * Accounts for direct settlements. Sorted by absolute balance descending.
 */
export async function getDirectContacts(userId: string) {
  const [expenses, settlements] = await Promise.all([
    prisma.expense.findMany({
      where: directExpenseVisibilityWhere(userId),
      select: {
        payerId: true,
        splits: { select: { userId: true, amount: true } },
      },
    }),
    prisma.settlement.findMany({
      where: { groupId: null, OR: [{ senderId: userId }, { receiverId: userId }] },
      select: { senderId: true, receiverId: true, amount: true },
    }),
  ])

  const net = new Map<string, number>()
  const bump = (id: string, delta: number) => net.set(id, (net.get(id) ?? 0) + delta)

  for (const e of expenses) {
    if (e.payerId === userId) {
      for (const s of e.splits) {
        if (s.userId !== userId) bump(s.userId, Number(s.amount))
      }
    } else {
      const mine = e.splits.find((s) => s.userId === userId)
      if (mine) bump(e.payerId, -Number(mine.amount))
    }
  }
  for (const s of settlements) {
    const amt = Number(s.amount)
    if (s.senderId === userId) bump(s.receiverId, amt)
    else if (s.receiverId === userId) bump(s.senderId, -amt)
  }

  const counterpartyIds = [...net.keys()]
  if (counterpartyIds.length === 0) return []

  const users = await prisma.user.findMany({
    where: { id: { in: counterpartyIds } },
    select: { id: true, name: true, avatar: true },
  })

  return users
    .map((u) => ({ user: u, net: Math.round((net.get(u.id) ?? 0) * 100) / 100 }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
}

/**
 * Net debts arising from the user's direct expenses AND direct settlements.
 * Expands each expense into pairwise debts (buildRawDebts), models each direct
 * settlement as a reverse debt (sender paid receiver), then nets everything down
 * to the minimal set of transfers (simplifyDebts).
 */
export async function computeDirectDebts(
  userId: string
): Promise<SimplifiedDebt[]> {
  const [rows, settlements] = await Promise.all([
    prisma.expense.findMany({
      where: directExpenseVisibilityWhere(userId),
      include: directExpenseInclude,
    }) as Promise<DirectExpenseWithRelations[]>,
    prisma.settlement.findMany({
      where: { groupId: null, OR: [{ senderId: userId }, { receiverId: userId }] },
      select: { senderId: true, receiverId: true, amount: true },
    }),
  ])

  const expenseDebts = buildRawDebts(
    rows.map((e) => ({
      payerId: e.payerId,
      splits: e.splits.map((s) => ({
        userId: s.user.id,
        amount: s.amount.toNumber(),
      })),
    }))
  )

  // A settlement (sender paid receiver) cancels the sender's debt → reverse debt.
  const settlementDebts: RawDebt[] = settlements.map((s) => ({
    fromUserId: s.receiverId,
    toUserId: s.senderId,
    amount: Number(s.amount),
  }))

  return simplifyDebts([...expenseDebts, ...settlementDebts])
}
