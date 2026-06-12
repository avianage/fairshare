import { prisma } from "@/lib/prisma"
import {
  buildRawDebts,
  simplifyDebts,
  type RawDebt,
  type SimplifiedDebt,
} from "@/lib/splitEngine"

export type MemberInfo = { id: string; name: string; avatar: string | null }

export type GroupBalances = {
  /** Minimal set of transfers that settles everyone. */
  simplified: SimplifiedDebt[]
  /** userId → net balance. Positive = others owe them; negative = they owe. */
  net: Record<string, number>
  /** Lookup for member display info. */
  members: Map<string, MemberInfo>
}

/**
 * Compute the current debt graph for a group from its non-deleted expenses and
 * its settlements. A settlement (sender paid receiver) is modeled as a reverse
 * raw debt from receiver → sender, which cancels out the sender's original debt.
 *
 * Shared by the balances and settle-up routes so both agree on what is owed.
 */
export async function computeGroupBalances(
  groupId: string
): Promise<GroupBalances> {
  const [expenses, settlements, memberRows] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId, deletedAt: null }, // never include soft-deleted expenses
      select: {
        payerId: true,
        splits: { select: { userId: true, amount: true } },
      },
    }),
    prisma.settlement.findMany({
      where: { groupId },
      select: { senderId: true, receiverId: true, amount: true },
    }),
    prisma.groupMember.findMany({
      where: { groupId },
      select: { user: { select: { id: true, name: true, avatar: true } } },
    }),
  ])

  const rawDebts = buildRawDebts(
    expenses.map((e) => ({
      payerId: e.payerId,
      splits: e.splits.map((s) => ({ userId: s.userId, amount: Number(s.amount) })),
    }))
  )

  // Settlement reduces the sender's debt to the receiver → reverse raw debt.
  const settlementDebts: RawDebt[] = settlements.map((s) => ({
    fromUserId: s.receiverId,
    toUserId: s.senderId,
    amount: Number(s.amount),
  }))

  const all = [...rawDebts, ...settlementDebts]
  const simplified = simplifyDebts(all)

  // Net balance per member (positive = creditor). Seed every member at 0.
  const net: Record<string, number> = {}
  for (const m of memberRows) net[m.user.id] = 0
  for (const { fromUserId, toUserId, amount } of all) {
    net[fromUserId] = (net[fromUserId] ?? 0) - amount
    net[toUserId] = (net[toUserId] ?? 0) + amount
  }
  for (const k of Object.keys(net)) net[k] = Math.round(net[k] * 100) / 100

  const members = new Map(memberRows.map((m) => [m.user.id, m.user]))
  return { simplified, net, members }
}
