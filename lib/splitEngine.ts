/**
 * Split engine — pure functions that divide a total among members.
 *
 * All amounts are plain numbers with at most 2 decimal places (currency units,
 * e.g. rupees). Internally every function works in integer *cents* so the parts
 * always sum back to the original total with no floating-point drift. The DB
 * stores the persisted amounts as Decimal(12,2); these functions only decide
 * how the total is partitioned.
 */

export type SplitResult = Record<string, number> // userId → amount owed

export type SplitType = "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES"

export type SplitInput = {
  type: SplitType
  totalAmount: number
  memberIds: string[]
  values?: Record<string, number> // per-user: exact amount / percentage / share count
}

// ── helpers ────────────────────────────────────────────────────────────────

/** Convert a currency amount to integer cents, rounding half-up. */
function toCents(amount: number): number {
  return Math.round(amount * 100)
}

/** Convert integer cents back to a 2-decimal currency number. */
function fromCents(cents: number): number {
  return cents / 100
}

/**
 * Distribute `totalCents` across weights using the largest-remainder method,
 * so the parts always sum exactly to `totalCents`. `weights[i]` is the relative
 * weight for `ids[i]` (e.g. equal=1 each, percentage points, or share counts).
 * Leftover cents go to the entries with the largest fractional remainder, ties
 * broken by original order (so the first/payer absorbs ties first).
 */
function distributeByWeight(
  totalCents: number,
  ids: string[],
  weights: number[]
): SplitResult {
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  if (totalWeight <= 0) {
    throw new Error("Total weight must be greater than zero")
  }

  const exact = ids.map((_, i) => (totalCents * weights[i]) / totalWeight)
  const floors = exact.map((v) => Math.floor(v))
  let allocated = floors.reduce((a, b) => a + b, 0)
  let leftover = totalCents - allocated

  // Order indices by descending fractional remainder, then ascending index.
  const order = ids
    .map((_, i) => i)
    .sort((a, b) => {
      const fr = exact[b] - floors[b] - (exact[a] - floors[a])
      return fr !== 0 ? fr : a - b
    })

  const centsPer = [...floors]
  for (let k = 0; k < leftover; k++) {
    centsPer[order[k % order.length]] += 1
  }

  const result: SplitResult = {}
  ids.forEach((id, i) => {
    result[id] = fromCents(centsPer[i])
  })
  return result
}

// ── EQUAL ──────────────────────────────────────────────────────────────────

/**
 * Split `totalAmount` equally among `memberIds`. Any sub-cent remainder is
 * given to the first member (typically the payer), matching Fairshare's
 * convention that the payer absorbs the rounding penny.
 */
export function calculateEqualSplit(
  totalAmount: number,
  memberIds: string[]
): SplitResult {
  if (memberIds.length === 0) {
    throw new Error("Cannot split among zero members")
  }

  const totalCents = toCents(totalAmount)
  const base = Math.floor(totalCents / memberIds.length)
  const remainder = totalCents - base * memberIds.length

  const result: SplitResult = {}
  for (const id of memberIds) result[id] = fromCents(base)
  // Give the leftover cents to the first member (typically the payer).
  result[memberIds[0]] = fromCents(base + remainder)
  return result
}

// ── EXACT (Phase 4) ──────────────────────────────────────────────────────────

/**
 * Use caller-supplied exact amounts. Validates that they sum to `totalAmount`
 * (to the cent). Returns a normalized copy rounded to whole cents.
 */
export function calculateExactSplit(
  totalAmount: number,
  amounts: Record<string, number>
): SplitResult {
  const ids = Object.keys(amounts)
  if (ids.length === 0) throw new Error("No amounts provided")

  const result: SplitResult = {}
  let sumCents = 0
  for (const id of ids) {
    const cents = toCents(amounts[id])
    if (cents < 0) throw new Error("Amounts cannot be negative")
    result[id] = fromCents(cents)
    sumCents += cents
  }

  if (sumCents !== toCents(totalAmount)) {
    throw new Error(
      `Exact splits must sum to the total (got ${fromCents(sumCents)}, expected ${totalAmount})`
    )
  }
  return result
}

// ── PERCENTAGE (Phase 4) ─────────────────────────────────────────────────────

/**
 * Split by percentage. `percentages` must sum to 100. Cents are distributed by
 * largest remainder so the parts sum exactly to `totalAmount`.
 */
export function calculatePercentageSplit(
  totalAmount: number,
  percentages: Record<string, number>
): SplitResult {
  const ids = Object.keys(percentages)
  if (ids.length === 0) throw new Error("No percentages provided")

  const weights = ids.map((id) => percentages[id])
  if (weights.some((w) => w < 0)) {
    throw new Error("Percentages cannot be negative")
  }

  // Allow tiny float error in the sum-to-100 check.
  const sum = weights.reduce((a, b) => a + b, 0)
  if (Math.abs(sum - 100) > 0.01) {
    throw new Error(`Percentages must sum to 100 (got ${sum})`)
  }

  return distributeByWeight(toCents(totalAmount), ids, weights)
}

// ── SHARES (Phase 4) ─────────────────────────────────────────────────────────

/**
 * Split by integer shares (e.g. {a: 2, b: 1} → a owes twice b). Cents are
 * distributed by largest remainder so the parts sum exactly to `totalAmount`.
 */
export function calculateSharesSplit(
  totalAmount: number,
  shares: Record<string, number>
): SplitResult {
  const ids = Object.keys(shares)
  if (ids.length === 0) throw new Error("No shares provided")

  const weights = ids.map((id) => shares[id])
  if (weights.some((w) => w < 0 || !Number.isFinite(w))) {
    throw new Error("Shares must be non-negative numbers")
  }

  return distributeByWeight(toCents(totalAmount), ids, weights)
}

// ── UNIFIED DISPATCHER ───────────────────────────────────────────────────────

/**
 * Single entry point used by the API: given a split type, total, members, and
 * (for non-equal types) per-member values, return userId → amount owed. Always
 * recompute server-side from this — never trust client-computed split amounts.
 *
 * Guards: EXACT values must sum to the total, PERCENTAGE to 100, SHARES must be
 * non-zero. Rounding remainder is absorbed by the first member.
 */
export function calculateSplits(input: SplitInput): SplitResult {
  const { type, totalAmount, memberIds, values = {} } = input

  if (memberIds.length === 0) {
    throw new Error("Cannot split among zero members")
  }

  if (type === "EQUAL") return calculateEqualSplit(totalAmount, memberIds)

  if (type === "EXACT") {
    const sum = memberIds.reduce((a, id) => a + (values[id] ?? 0), 0)
    if (Math.abs(sum - totalAmount) > 0.01) {
      throw new Error("EXACT splits must sum to total amount")
    }
    return Object.fromEntries(
      memberIds.map((id) => [id, Math.round((values[id] ?? 0) * 100) / 100])
    )
  }

  if (type === "PERCENTAGE") {
    const sum = memberIds.reduce((a, id) => a + (values[id] ?? 0), 0)
    if (Math.abs(sum - 100) > 0.01) {
      throw new Error("Percentages must sum to 100")
    }
    const result: SplitResult = {}
    for (const id of memberIds) {
      result[id] = Math.round(((values[id] ?? 0) / 100) * totalAmount * 100) / 100
    }
    // Absorb the rounding remainder into the first member.
    const total = memberIds.reduce((a, id) => a + result[id], 0)
    const diff = Math.round((totalAmount - total) * 100) / 100
    if (Math.abs(diff) > 0) {
      result[memberIds[0]] = Math.round((result[memberIds[0]] + diff) * 100) / 100
    }
    return result
  }

  if (type === "SHARES") {
    const totalShares = memberIds.reduce((a, id) => a + (values[id] ?? 1), 0)
    if (totalShares === 0) throw new Error("Total shares cannot be zero")
    const result: SplitResult = {}
    for (const id of memberIds) {
      result[id] =
        Math.round(((values[id] ?? 1) / totalShares) * totalAmount * 100) / 100
    }
    const total = memberIds.reduce((a, id) => a + result[id], 0)
    const diff = Math.round((totalAmount - total) * 100) / 100
    if (Math.abs(diff) > 0) {
      result[memberIds[0]] = Math.round((result[memberIds[0]] + diff) * 100) / 100
    }
    return result
  }

  throw new Error("Invalid split type")
}

// ── RESCALE (edit amount, keep proportions) ──────────────────────────────────

/**
 * Recompute splits for a new total while preserving the EXISTING proportions
 * between members (their current split amounts act as weights). This lets an
 * amount edit keep the original intent — equal stays equal, a 70/30 exact split
 * stays 70/30 — without having to persist the original percentages/shares.
 * Falls back to an equal split if the current amounts sum to zero.
 */
export function rescaleSplit(
  newTotal: number,
  current: Array<{ userId: string; amount: number }>
): SplitResult {
  const ids = current.map((c) => c.userId)
  if (ids.length === 0) throw new Error("Cannot rescale an empty split")
  const weights = current.map((c) => c.amount)
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  if (totalWeight <= 0) return calculateEqualSplit(newTotal, ids)
  return distributeByWeight(toCents(newTotal), ids, weights)
}

// ── DEBTS & SETTLE-UP ────────────────────────────────────────────────────────

export type RawDebt = { fromUserId: string; toUserId: string; amount: number }
export type SimplifiedDebt = {
  fromUserId: string
  toUserId: string
  amount: number
}

/**
 * Expand expenses into pairwise debts: every non-payer participant owes the
 * payer their split amount.
 *
 * Shape-agnostic: it only reads `payerId` + `splits`, so it works for group
 * expenses AND direct (groupId=null) expenses. Callers may pass both kinds in
 * the same array to compute a user's combined balances.
 */
export function buildRawDebts(
  expenses: Array<{
    payerId: string
    splits: Array<{ userId: string; amount: number }>
  }>
): RawDebt[] {
  return expenses.flatMap((expense) =>
    expense.splits
      .filter((s) => s.userId !== expense.payerId)
      .map((s) => ({
        fromUserId: s.userId,
        toUserId: expense.payerId,
        amount: Number(s.amount),
      }))
  )
}

/**
 * Net out a set of raw debts and produce the minimal set of transfers that
 * settles everyone, using a greedy largest-debtor/largest-creditor match.
 * Amounts below 1 cent are treated as settled (float-noise tolerance).
 */
export function simplifyDebts(debts: RawDebt[]): SimplifiedDebt[] {
  const net = new Map<string, number>()
  for (const { fromUserId, toUserId, amount } of debts) {
    net.set(fromUserId, (net.get(fromUserId) ?? 0) - amount)
    net.set(toUserId, (net.get(toUserId) ?? 0) + amount)
  }

  const creditors = [...net.entries()]
    .filter(([, b]) => b > 0.01)
    .map(([userId, balance]) => ({ userId, balance }))
  const debtors = [...net.entries()]
    .filter(([, b]) => b < -0.01)
    .map(([userId, balance]) => ({ userId, balance: -balance }))

  creditors.sort((a, b) => b.balance - a.balance)
  debtors.sort((a, b) => b.balance - a.balance)

  const result: SimplifiedDebt[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].balance, creditors[j].balance)
    if (pay > 0.01) {
      result.push({
        fromUserId: debtors[i].userId,
        toUserId: creditors[j].userId,
        amount: Math.round(pay * 100) / 100,
      })
    }
    debtors[i].balance -= pay
    creditors[j].balance -= pay
    if (debtors[i].balance < 0.01) i++
    if (creditors[j].balance < 0.01) j++
  }
  return result
}
