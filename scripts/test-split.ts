// Pure-math checks for the split engine. Run: node scripts/test-split.ts
import {
  calculateEqualSplit,
  calculateExactSplit,
  calculatePercentageSplit,
  calculateSharesSplit,
  calculateSplits,
  rescaleSplit,
  buildRawDebts,
  simplifyDebts,
  type RawDebt,
  type SplitResult,
} from "../lib/splitEngine.ts"

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  — " + detail : ""}`)
  ok ? pass++ : fail++
}

const cents = (n: number) => Math.round(n * 100)
function sumCents(r: SplitResult) {
  return Object.values(r).reduce((a, b) => a + cents(b), 0)
}
function allTwoDecimals(r: SplitResult) {
  return Object.values(r).every((v) => Number.isInteger(cents(v)))
}

// EQUAL: indivisible totals must still sum exactly, remainder to first member.
{
  const r = calculateEqualSplit(100, ["a", "b", "c"])
  check("equal 100/3 sums to 100", sumCents(r) === cents(100), JSON.stringify(r))
  check("equal 100/3 remainder to first", r.a === 33.34 && r.b === 33.33 && r.c === 33.33)
}
{
  const r = calculateEqualSplit(0.1, ["a", "b", "c"])
  check("equal 0.10/3 sums to 0.10", sumCents(r) === cents(0.1), JSON.stringify(r))
}
{
  const r = calculateEqualSplit(999999.99, ["a", "b", "c", "d", "e", "f", "g"])
  check("equal large/7 sums exactly", sumCents(r) === cents(999999.99))
  check("equal large/7 all 2dp", allTwoDecimals(r))
}

// EXACT: must equal the total or throw.
{
  const r = calculateExactSplit(50, { a: 20, b: 30 })
  check("exact valid sums to 50", sumCents(r) === cents(50))
  let threw = false
  try {
    calculateExactSplit(50, { a: 20, b: 25 })
  } catch {
    threw = true
  }
  check("exact mismatch throws", threw)
}

// PERCENTAGE: must sum to 100; cents distributed by largest remainder.
{
  const r = calculatePercentageSplit(100, { a: 33.33, b: 33.33, c: 33.34 })
  check("pct sums to 100.00", sumCents(r) === cents(100), JSON.stringify(r))
  const r2 = calculatePercentageSplit(10, { a: 50, b: 50 })
  check("pct 50/50 of 10", r2.a === 5 && r2.b === 5)
  let threw = false
  try {
    calculatePercentageSplit(100, { a: 50, b: 30 })
  } catch {
    threw = true
  }
  check("pct not summing to 100 throws", threw)
}

// SHARES: proportional, exact sum.
{
  const r = calculateSharesSplit(100, { a: 2, b: 1, c: 1 })
  check("shares 2:1:1 sums to 100", sumCents(r) === cents(100), JSON.stringify(r))
  check("shares 2:1:1 proportions", r.a === 50 && r.b === 25 && r.c === 25)
  const r2 = calculateSharesSplit(10, { a: 1, b: 1, c: 1 })
  check("shares 1:1:1 of 10 sums to 10", sumCents(r2) === cents(10), JSON.stringify(r2))
}

// ── calculateSplits dispatcher ───────────────────────────────────────────────
{
  const eq = calculateSplits({ type: "EQUAL", totalAmount: 100, memberIds: ["a", "b", "c"] })
  check("dispatch EQUAL sums to 100", sumCents(eq) === cents(100))

  const ex = calculateSplits({
    type: "EXACT",
    totalAmount: 50,
    memberIds: ["a", "b"],
    values: { a: 20, b: 30 },
  })
  check("dispatch EXACT exact values", ex.a === 20 && ex.b === 30)

  let threw = false
  try {
    calculateSplits({ type: "EXACT", totalAmount: 50, memberIds: ["a", "b"], values: { a: 20, b: 25 } })
  } catch {
    threw = true
  }
  check("dispatch EXACT mismatch throws", threw)

  const pc = calculateSplits({
    type: "PERCENTAGE",
    totalAmount: 100,
    memberIds: ["a", "b", "c"],
    values: { a: 33.33, b: 33.33, c: 33.34 },
  })
  check("dispatch PERCENTAGE sums to total", sumCents(pc) === cents(100), JSON.stringify(pc))

  let threwPct = false
  try {
    calculateSplits({ type: "PERCENTAGE", totalAmount: 100, memberIds: ["a", "b"], values: { a: 50, b: 30 } })
  } catch {
    threwPct = true
  }
  check("dispatch PERCENTAGE !=100 throws", threwPct)

  const sh = calculateSplits({
    type: "SHARES",
    totalAmount: 100,
    memberIds: ["a", "b", "c"],
    values: { a: 2, b: 1, c: 1 },
  })
  check("dispatch SHARES sums to total", sumCents(sh) === cents(100), JSON.stringify(sh))
  check("dispatch SHARES 2:1:1 proportions", sh.a === 50 && sh.b === 25 && sh.c === 25)

  // SHARES default of 1 for missing members, exact sum with remainder to first.
  const sh2 = calculateSplits({ type: "SHARES", totalAmount: 10, memberIds: ["a", "b", "c"], values: {} })
  check("dispatch SHARES default-1 sums to total", sumCents(sh2) === cents(10), JSON.stringify(sh2))
}

// ── rescaleSplit (edit amount, keep proportions) ─────────────────────────────
{
  const eq = rescaleSplit(200, [{ userId: "a", amount: 50 }, { userId: "b", amount: 50 }])
  check("rescale keeps equal split equal", eq.a === 100 && eq.b === 100, JSON.stringify(eq))

  const ratio = rescaleSplit(200, [{ userId: "a", amount: 70 }, { userId: "b", amount: 30 }])
  check("rescale preserves 70/30 ratio", ratio.a === 140 && ratio.b === 60, JSON.stringify(ratio))

  const r3 = rescaleSplit(100, [
    { userId: "a", amount: 33.33 },
    { userId: "b", amount: 33.33 },
    { userId: "c", amount: 33.34 },
  ])
  check("rescale sums exactly to total", sumCents(r3) === cents(100), JSON.stringify(r3))

  const zero = rescaleSplit(90, [{ userId: "a", amount: 0 }, { userId: "b", amount: 0 }])
  check("rescale falls back to equal on zero weights", zero.a === 45 && zero.b === 45, JSON.stringify(zero))
}

// ── DEBTS ────────────────────────────────────────────────────────────────────

// A pays 90 for [A,B,C] equal → B and C each owe A 30.
{
  const split = calculateEqualSplit(90, ["A", "B", "C"])
  const raw = buildRawDebts([
    { payerId: "A", splits: [
      { userId: "A", amount: split.A },
      { userId: "B", amount: split.B },
      { userId: "C", amount: split.C },
    ] },
  ])
  check("raw debts exclude payer", raw.length === 2 && raw.every((d) => d.toUserId === "A"))
  check("raw debts amounts = 30 each", raw.every((d) => d.amount === 30))
}

// Simplify: A→B 10, B→C 10  ⇒  A→C 10 (B nets to zero, dropped).
{
  const debts: RawDebt[] = [
    { fromUserId: "A", toUserId: "B", amount: 10 },
    { fromUserId: "B", toUserId: "C", amount: 10 },
  ]
  const s = simplifyDebts(debts)
  check(
    "simplify chains A→B→C into A→C",
    s.length === 1 && s[0].fromUserId === "A" && s[0].toUserId === "C" && s[0].amount === 10,
    JSON.stringify(s)
  )
}

// Settlement cancels a debt: B owes A 30, then a reverse debt (settlement) A←B 30 ⇒ settled.
{
  const debts: RawDebt[] = [
    { fromUserId: "B", toUserId: "A", amount: 30 }, // B owes A
    { fromUserId: "A", toUserId: "B", amount: 30 }, // settlement: B paid A (reverse)
  ]
  const s = simplifyDebts(debts)
  check("settlement fully cancels debt → no transfers", s.length === 0, JSON.stringify(s))
}

// Partial settlement leaves the remainder.
{
  const debts: RawDebt[] = [
    { fromUserId: "B", toUserId: "A", amount: 30 },
    { fromUserId: "A", toUserId: "B", amount: 10 }, // B paid 10
  ]
  const s = simplifyDebts(debts)
  check(
    "partial settlement leaves 20 owed",
    s.length === 1 && s[0].fromUserId === "B" && s[0].toUserId === "A" && s[0].amount === 20,
    JSON.stringify(s)
  )
}

// Conservation: simplified transfers preserve each person's net balance.
{
  const debts: RawDebt[] = [
    { fromUserId: "A", toUserId: "B", amount: 33.34 },
    { fromUserId: "C", toUserId: "B", amount: 33.33 },
    { fromUserId: "A", toUserId: "C", amount: 12.5 },
  ]
  const netOf = (ds: { fromUserId: string; toUserId: string; amount: number }[]) => {
    const n: Record<string, number> = {}
    for (const d of ds) {
      n[d.fromUserId] = (n[d.fromUserId] ?? 0) - d.amount
      n[d.toUserId] = (n[d.toUserId] ?? 0) + d.amount
    }
    return n
  }
  const before = netOf(debts)
  const after = netOf(simplifyDebts(debts))
  const sameNet = ["A", "B", "C"].every(
    (u) => Math.abs((before[u] ?? 0) - (after[u] ?? 0)) < 0.01
  )
  check("simplify preserves every net balance", sameNet, JSON.stringify(after))
}

console.log(`\n${pass}/${pass + fail} checks passed.`)
process.exit(fail === 0 ? 0 : 1)
