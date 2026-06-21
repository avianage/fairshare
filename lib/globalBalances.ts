import { prisma } from "@/lib/prisma"
import { directExpenseVisibilityWhere } from "@/lib/directExpenses"
import { buildRawDebts, simplifyDebts, type RawDebt } from "@/lib/splitEngine"

export type ContextualDebt = {
  groupId: string | null
  groupName: string | null // null = direct expenses
  amount: number           // positive = userId owes counterpartyId in this context
}

/**
 * Per-context (per-group + direct) bilateral net between two users.
 * Only returns contexts with a meaningful balance (≥ ₹0.01).
 * Positive amount = userId owes counterpartyId.
 * Negative amount = counterpartyId owes userId.
 */
export async function getContextualDebts(
  userId: string,
  counterpartyId: string
): Promise<ContextualDebt[]> {
  const [expenses, settlements] = await Promise.all([
    prisma.expense.findMany({
      where: {
        deletedAt: null,
        AND: [
          { splits: { some: { userId } } },
          { splits: { some: { userId: counterpartyId } } },
        ],
      },
      select: {
        groupId: true,
        group: { select: { name: true } },
        payerId: true,
        splits: {
          where: { userId: { in: [userId, counterpartyId] } },
          select: { userId: true, amount: true },
        },
      },
    }),
    prisma.settlement.findMany({
      where: {
        senderId: { in: [userId, counterpartyId] },
        receiverId: { in: [userId, counterpartyId] },
      },
      select: { senderId: true, receiverId: true, amount: true, groupId: true },
    }),
  ])

  const nets = new Map<string | null, number>()
  const groupNames = new Map<string | null, string | null>()
  const bump = (key: string | null, delta: number) =>
    nets.set(key, (nets.get(key) ?? 0) + delta)

  for (const e of expenses) {
    const key = e.groupId
    if (!groupNames.has(key)) groupNames.set(key, e.group?.name ?? null)
    const userSplit = e.splits.find((s) => s.userId === userId)
    const cpSplit = e.splits.find((s) => s.userId === counterpartyId)
    if (e.payerId === counterpartyId && userSplit) bump(key, Number(userSplit.amount))
    else if (e.payerId === userId && cpSplit) bump(key, -Number(cpSplit.amount))
  }

  for (const s of settlements) {
    const amt = Number(s.amount)
    const key = s.groupId
    if (s.senderId === userId && s.receiverId === counterpartyId) bump(key, -amt)
    else if (s.senderId === counterpartyId && s.receiverId === userId) bump(key, amt)
  }

  const result: ContextualDebt[] = []
  for (const [groupId, net] of nets.entries()) {
    const rounded = Math.round(net * 100) / 100
    if (Math.abs(rounded) < 0.01) continue
    result.push({ groupId, groupName: groupNames.get(groupId) ?? null, amount: rounded })
  }

  // Direct first, then groups alphabetically
  return result.sort((a, b) => {
    if (a.groupId === null) return -1
    if (b.groupId === null) return 1
    return (a.groupName ?? "").localeCompare(b.groupName ?? "")
  })
}

export type DebtUser = {
  userId: string
  name: string
  avatar: string | null
  amount: number
}

export type DebtContext = {
  groupId: string | null
  groupName: string | null // null = direct expenses
  amount: number           // positive = they owe you
}

export type BilateralEntry = {
  userId: string
  name: string
  avatar: string | null
  total: number
  contexts: DebtContext[]
}

export type GlobalDebts = {
  owedToYou: DebtUser[]
  youOwe: DebtUser[]
  netBalance: number // positive = you are owed; negative = you owe
}

/**
 * Net debts for `userId` across BOTH group and direct expenses (and their
 * settlements), reduced to a minimal set of transfers.
 *
 * Security: only the requesting user's perspective is returned. We compute the
 * full debt graph for the groups they belong to (group expenses involve other
 * members) plus their direct expenses, but the response only ever contains rows
 * where `userId` is one side of the debt — never debts between two other people.
 */
export async function getGlobalDebts(userId: string): Promise<GlobalDebts> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  })
  const groupIds = memberships.map((m) => m.groupId)

  // Only expenses/settlements the user is actually part of. We compute each
  // counterparty's BILATERAL net (same rules as getPairwiseBalance) rather than
  // a global simplifyDebts — global simplification can re-route a debt to a
  // counterparty the user shares no expense with, whose detail page would then
  // 404. Bilateral netting keeps the list consistent with /balances/[userId].
  const [groupExpenses, directExpenses, settlements] = await Promise.all([
    groupIds.length
      ? prisma.expense.findMany({
          where: {
            groupId: { in: groupIds },
            deletedAt: null,
            OR: [{ payerId: userId }, { splits: { some: { userId } } }],
          },
          select: {
            payerId: true,
            splits: { select: { userId: true, amount: true } },
          },
        })
      : Promise.resolve([]),
    prisma.expense.findMany({
      where: directExpenseVisibilityWhere(userId),
      select: {
        payerId: true,
        splits: { select: { userId: true, amount: true } },
      },
    }),
    // Every settlement the user is a party to (group or direct).
    prisma.settlement.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      select: { senderId: true, receiverId: true, amount: true },
    }),
  ])

  // counterparty → net (positive = they owe you).
  const net = new Map<string, number>()
  const bump = (id: string, delta: number) =>
    net.set(id, (net.get(id) ?? 0) + delta)

  for (const e of [...groupExpenses, ...directExpenses]) {
    if (e.payerId === userId) {
      // Others owe you their share.
      for (const s of e.splits) {
        if (s.userId === userId) continue
        bump(s.userId, Number(s.amount))
      }
    } else {
      // You owe the payer your share (if you participated).
      const mine = e.splits.find((s) => s.userId === userId)
      if (mine) bump(e.payerId, -Number(mine.amount))
    }
  }
  for (const s of settlements) {
    const amt = Number(s.amount)
    if (s.senderId === userId) bump(s.receiverId, amt) // you paid them
    else if (s.receiverId === userId) bump(s.senderId, -amt)
  }

  // Drop near-zero balances; collect counterparties for name/avatar lookup.
  const entries = [...net.entries()]
    .map(([id, v]) => [id, Math.round(v * 100) / 100] as const)
    .filter(([, v]) => Math.abs(v) >= 0.01)

  const users = entries.length
    ? await prisma.user.findMany({
        where: { id: { in: entries.map(([id]) => id) } },
        select: { id: true, name: true, avatar: true },
      })
    : []
  const userMap = new Map(users.map((u) => [u.id, u]))

  const toRow = (id: string, amount: number): DebtUser => {
    const u = userMap.get(id)
    return {
      userId: id,
      name: u?.name ?? "Unknown",
      avatar: u?.avatar ?? null,
      amount: Math.round(Math.abs(amount) * 100) / 100,
    }
  }

  const owedToYou = entries.filter(([, v]) => v > 0).map(([id, v]) => toRow(id, v))
  const youOwe = entries.filter(([, v]) => v < 0).map(([id, v]) => toRow(id, v))

  const totalOwed = owedToYou.reduce((a, r) => a + r.amount, 0)
  const totalOwe = youOwe.reduce((a, r) => a + r.amount, 0)
  const netBalance = Math.round((totalOwed - totalOwe) * 100) / 100

  return { owedToYou, youOwe, netBalance }
}

/**
 * Same as getGlobalDebts but also returns per-group/direct context breakdown
 * for each counterparty, so the UI can show "Group A: ₹200 / Direct: ₹50".
 */
export async function getGlobalDebtsWithContext(
  userId: string
): Promise<{ owedToYou: BilateralEntry[]; youOwe: BilateralEntry[]; netBalance: number }> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  })
  const groupIds = memberships.map((m) => m.groupId)

  const [groupExpenses, directExpenses, settlements] = await Promise.all([
    groupIds.length
      ? prisma.expense.findMany({
          where: {
            groupId: { in: groupIds },
            deletedAt: null,
            OR: [{ payerId: userId }, { splits: { some: { userId } } }],
          },
          select: {
            groupId: true,
            group: { select: { name: true } },
            payerId: true,
            splits: { select: { userId: true, amount: true } },
          },
        })
      : Promise.resolve([]),
    prisma.expense.findMany({
      where: directExpenseVisibilityWhere(userId),
      select: {
        payerId: true,
        splits: { select: { userId: true, amount: true } },
      },
    }),
    prisma.settlement.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      select: { senderId: true, receiverId: true, amount: true, groupId: true },
    }),
  ])

  // counterparty → contextKey → { net, groupId, groupName }
  type CtxValue = { net: number; groupId: string | null; groupName: string | null }
  const ctxMap = new Map<string, Map<string, CtxValue>>()

  const bump = (counterparty: string, groupId: string | null, groupName: string | null, delta: number) => {
    if (!ctxMap.has(counterparty)) ctxMap.set(counterparty, new Map())
    const key = groupId ?? "__direct__"
    const inner = ctxMap.get(counterparty)!
    if (!inner.has(key)) inner.set(key, { net: 0, groupId, groupName })
    inner.get(key)!.net += delta
  }

  for (const e of groupExpenses) {
    const gid = e.groupId!
    const gname = e.group?.name ?? null
    if (e.payerId === userId) {
      for (const s of e.splits) {
        if (s.userId !== userId) bump(s.userId, gid, gname, Number(s.amount))
      }
    } else {
      const mine = e.splits.find((s) => s.userId === userId)
      if (mine) bump(e.payerId, gid, gname, -Number(mine.amount))
    }
  }
  for (const e of directExpenses) {
    if (e.payerId === userId) {
      for (const s of e.splits) {
        if (s.userId !== userId) bump(s.userId, null, null, Number(s.amount))
      }
    } else {
      const mine = e.splits.find((s) => s.userId === userId)
      if (mine) bump(e.payerId, null, null, -Number(mine.amount))
    }
  }
  for (const s of settlements) {
    const amt = Number(s.amount)
    if (s.senderId === userId) bump(s.receiverId, s.groupId ?? null, null, amt)
    else if (s.receiverId === userId) bump(s.senderId, s.groupId ?? null, null, -amt)
  }

  // Collect counterparties with meaningful net balance
  const allIds: string[] = []
  const rows: { id: string; total: number; contexts: DebtContext[] }[] = []
  for (const [cpId, inner] of ctxMap.entries()) {
    const contexts: DebtContext[] = []
    let total = 0
    for (const { net, groupId, groupName } of inner.values()) {
      const r = Math.round(net * 100) / 100
      if (Math.abs(r) >= 0.01) {
        contexts.push({ groupId, groupName, amount: r })
        total += r
      }
    }
    total = Math.round(total * 100) / 100
    if (Math.abs(total) >= 0.01) {
      allIds.push(cpId)
      rows.push({ id: cpId, total, contexts })
    }
  }

  const users = allIds.length
    ? await prisma.user.findMany({
        where: { id: { in: allIds } },
        select: { id: true, name: true, avatar: true },
      })
    : []
  const userMap = new Map(users.map((u) => [u.id, u]))

  const toEntry = (row: (typeof rows)[0]): BilateralEntry => ({
    userId: row.id,
    name: userMap.get(row.id)?.name ?? "Unknown",
    avatar: userMap.get(row.id)?.avatar ?? null,
    total: Math.abs(row.total),
    contexts: row.contexts
      .map((c) => ({ ...c, amount: Math.abs(c.amount) }))
      .sort((a, b) => {
        if (a.groupId === null) return -1
        if (b.groupId === null) return 1
        return (a.groupName ?? "").localeCompare(b.groupName ?? "")
      }),
  })

  const owedToYou = rows.filter((r) => r.total > 0).map(toEntry)
  const youOwe = rows.filter((r) => r.total < 0).map(toEntry)
  const netBalance = Math.round(
    (owedToYou.reduce((a, r) => a + r.total, 0) -
      youOwe.reduce((a, r) => a + r.total, 0)) *
      100
  ) / 100

  return { owedToYou, youOwe, netBalance }
}

/**
 * The user's DIRECT-expense balance, netted per counterparty (so a mutual debt
 * cancels) and split into owed-to-you vs you-owe totals. Includes direct
 * settlements. Used by the dashboard to fold direct activity into the summary
 * cards without disturbing the per-group figures.
 */
export async function getDirectBalanceTotals(
  userId: string
): Promise<{ owed: number; owing: number }> {
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

  // counterparty → net (positive = they owe you).
  const net = new Map<string, number>()
  const bump = (id: string, delta: number) => net.set(id, (net.get(id) ?? 0) + delta)

  for (const e of expenses) {
    for (const s of e.splits) {
      if (s.userId === e.payerId) continue
      const amt = Number(s.amount)
      if (e.payerId === userId) bump(s.userId, amt) // they owe you
      else if (s.userId === userId) bump(e.payerId, -amt) // you owe the payer
    }
  }
  for (const s of settlements) {
    const amt = Number(s.amount)
    if (s.senderId === userId) bump(s.receiverId, amt) // you paid them → reduces what you owe
    else if (s.receiverId === userId) bump(s.senderId, -amt)
  }

  let owed = 0
  let owing = 0
  for (const v of net.values()) {
    const r = Math.round(v * 100) / 100
    if (r > 0) owed += r
    else if (r < 0) owing += -r
  }
  return { owed: Math.round(owed * 100) / 100, owing: Math.round(owing * 100) / 100 }
}

export type SharedExpense = {
  id: string
  description: string
  amount: number
  date: Date
  groupId: string | null
  groupName: string | null // null = direct expense
  payer: { id: string; name: string }
  yourShare: number
  theirShare: number
}

export type PairwiseBalance = {
  expenses: SharedExpense[]
  /** Net across group + direct: positive = they owe you; negative = you owe them. */
  net: number
  /**
   * Net from DIRECT (non-group) activity only. This is what a direct settlement
   * may pay off — group debts must be settled within their group, or the global
   * and per-group views would disagree.
   */
  directNet: number
}

/**
 * All expenses (group + direct) shared between `userId` and `otherId`, plus the
 * net bilateral balance (accounting for settlements between just these two).
 *
 * Security: every returned expense has `userId` in its splits, so the caller is
 * always a participant — it can't be used to view expenses they aren't part of.
 */
export async function getPairwiseBalance(
  userId: string,
  otherId: string
): Promise<PairwiseBalance> {
  const rows = await prisma.expense.findMany({
    where: {
      deletedAt: null,
      // Both users must be participants (in the splits) of the expense.
      AND: [
        { splits: { some: { userId } } },
        { splits: { some: { userId: otherId } } },
      ],
    },
    select: {
      id: true,
      description: true,
      amount: true,
      date: true,
      payerId: true,
      groupId: true,
      group: { select: { name: true } },
      payer: { select: { id: true, name: true } },
      splits: { select: { userId: true, amount: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  })

  let net = 0 // positive = otherId owes userId (group + direct)
  let directNet = 0 // direct (groupId null) only
  const expenses: SharedExpense[] = rows.map((e) => {
    const yourShare = Number(
      e.splits.find((s) => s.userId === userId)?.amount ?? 0
    )
    const theirShare = Number(
      e.splits.find((s) => s.userId === otherId)?.amount ?? 0
    )
    // The non-payer owes the payer their share.
    let delta = 0
    if (e.payerId === userId) delta = theirShare
    else if (e.payerId === otherId) delta = -yourShare
    net += delta
    if (e.groupId === null) directNet += delta

    return {
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      date: e.date,
      groupId: e.groupId,
      groupName: e.group?.name ?? null,
      payer: e.payer,
      yourShare,
      theirShare,
    }
  })

  // Settlements strictly between these two users (group or direct) net it down.
  const settlements = await prisma.settlement.findMany({
    where: {
      senderId: { in: [userId, otherId] },
      receiverId: { in: [userId, otherId] },
    },
    select: { senderId: true, receiverId: true, amount: true, groupId: true },
  })
  for (const s of settlements) {
    const amt = Number(s.amount)
    // sender paid receiver → reduces sender's debt to receiver.
    let delta = 0
    if (s.senderId === userId && s.receiverId === otherId) delta = amt
    else if (s.senderId === otherId && s.receiverId === userId) delta = -amt
    net += delta
    if (s.groupId === null) directNet += delta
  }

  return {
    expenses,
    net: Math.round(net * 100) / 100,
    directNet: Math.round(directNet * 100) / 100,
  }
}

export type SimplifiedPayment = {
  fromUserId: string
  fromName: string
  fromAvatar: string | null
  toUserId: string
  toName: string
  toAvatar: string | null
  amount: number
}

/**
 * Runs the same greedy min-transfer simplification used by group ledgers,
 * but across ALL of the user's groups + direct expenses combined.
 * Needs the full multi-party debt graph (all members, not just the user)
 * so that cross-person rerouting works correctly.
 */
export async function getSimplifiedGlobalPayments(
  userId: string
): Promise<SimplifiedPayment[]> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  })
  const groupIds = memberships.map((m) => m.groupId)

  const [groupExpenses, directExpenses, groupSettlements, directSettlements] =
    await Promise.all([
      groupIds.length
        ? prisma.expense.findMany({
            where: { groupId: { in: groupIds }, deletedAt: null },
            select: {
              payerId: true,
              splits: { select: { userId: true, amount: true } },
            },
          })
        : Promise.resolve([]),
      prisma.expense.findMany({
        where: directExpenseVisibilityWhere(userId),
        select: {
          payerId: true,
          splits: { select: { userId: true, amount: true } },
        },
      }),
      groupIds.length
        ? prisma.settlement.findMany({
            where: { groupId: { in: groupIds } },
            select: { senderId: true, receiverId: true, amount: true },
          })
        : Promise.resolve([]),
      prisma.settlement.findMany({
        where: {
          groupId: null,
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
        select: { senderId: true, receiverId: true, amount: true },
      }),
    ])

  const rawDebts = buildRawDebts(
    [...groupExpenses, ...directExpenses].map((e) => ({
      payerId: e.payerId,
      splits: e.splits.map((s) => ({ userId: s.userId, amount: Number(s.amount) })),
    }))
  )

  // Settlement reduces sender's debt: reverse it as a raw debt.
  const settlementDebts: RawDebt[] = [
    ...groupSettlements,
    ...directSettlements,
  ].map((s) => ({
    fromUserId: s.receiverId,
    toUserId: s.senderId,
    amount: Number(s.amount),
  }))

  const simplified = simplifyDebts([...rawDebts, ...settlementDebts])

  // Only keep transfers that involve the user or where both parties share
  // expenses with the user (they appeared in the graph because of the user).
  const relevant = simplified.filter(
    (d) => d.fromUserId === userId || d.toUserId === userId
  )

  if (relevant.length === 0) return []

  const allIds = [
    ...new Set(relevant.flatMap((d) => [d.fromUserId, d.toUserId])),
  ]
  const users = await prisma.user.findMany({
    where: { id: { in: allIds } },
    select: { id: true, name: true, avatar: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u]))

  return relevant.map((d) => ({
    fromUserId: d.fromUserId,
    fromName: userMap.get(d.fromUserId)?.name ?? "Unknown",
    fromAvatar: userMap.get(d.fromUserId)?.avatar ?? null,
    toUserId: d.toUserId,
    toName: userMap.get(d.toUserId)?.name ?? "Unknown",
    toAvatar: userMap.get(d.toUserId)?.avatar ?? null,
    amount: d.amount,
  }))
}
