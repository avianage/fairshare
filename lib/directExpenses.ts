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
