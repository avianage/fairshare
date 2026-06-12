// Integration test for the dashboard: verifies the cross-group net balance
// matches the per-group /balances endpoint, and that activity/groups exclude
// groups the user is not a member of. Run with the dev server up.
import { PrismaClient, Prisma } from "@prisma/client"
import { encode } from "next-auth/jwt"
import bcrypt from "bcryptjs"

const BASE = "http://localhost:3000"
const COOKIE_NAME = "authjs.session-token"
const SECRET = process.env.NEXTAUTH_SECRET
const prisma = new PrismaClient()

let pass = 0
let fail = 0
function check(label, ok, detail = "") {
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"}  ${label}${detail ? "  — " + detail : ""}`)
  ok ? pass++ : fail++
}

async function cookieFor(user) {
  const token = await encode({
    token: { id: user.id, name: user.name, email: user.email, sub: user.id },
    secret: SECRET,
    salt: COOKIE_NAME,
  })
  return `${COOKIE_NAME}=${token}`
}

const api = (path, cookie) =>
  fetch(BASE + path, { headers: { Cookie: cookie }, redirect: "manual" })

const EMAILS = ["dash-a@fairshare.test", "dash-b@fairshare.test"]

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { in: EMAILS } },
    select: { id: true },
  })
  if (!users.length) return
  const ids = users.map((u) => u.id)
  const ms = await prisma.groupMember.findMany({
    where: { userId: { in: ids } },
    select: { groupId: true },
  })
  const gids = [...new Set(ms.map((m) => m.groupId))]
  await prisma.expenseSplit.deleteMany({ where: { expense: { groupId: { in: gids } } } })
  await prisma.expense.deleteMany({ where: { groupId: { in: gids } } })
  await prisma.settlement.deleteMany({ where: { groupId: { in: gids } } })
  await prisma.groupInvite.deleteMany({ where: { OR: [{ groupId: { in: gids } }, { invitedById: { in: ids } }] } })
  await prisma.groupMember.deleteMany({ where: { groupId: { in: gids } } })
  await prisma.group.deleteMany({ where: { id: { in: gids } } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
}

async function main() {
  if (!SECRET) throw new Error("NEXTAUTH_SECRET not loaded")
  await cleanup()

  const hash = await bcrypt.hash("Password1", 12)
  const A = await prisma.user.create({ data: { name: "Asha", email: EMAILS[0], passwordHash: hash } })
  const B = await prisma.user.create({ data: { name: "Bhanu", email: EMAILS[1], passwordHash: hash } })
  const cookieA = await cookieFor(A)
  const cookieB = await cookieFor(B)

  // Group G: A + B. Expense paid by A, 100, equal split → B owes A 50.
  const G = await prisma.group.create({
    data: {
      name: "Trip",
      currency: "INR",
      members: {
        create: [
          { userId: A.id, role: "ADMIN" },
          { userId: B.id, role: "MEMBER" },
        ],
      },
    },
  })
  await prisma.expense.create({
    data: {
      groupId: G.id,
      payerId: A.id,
      description: "Hotel",
      amount: new Prisma.Decimal("100.00"),
      category: "ACCOMMODATION",
      splitType: "EQUAL",
      splits: {
        create: [
          { userId: A.id, amount: new Prisma.Decimal("50.00") },
          { userId: B.id, amount: new Prisma.Decimal("50.00") },
        ],
      },
    },
  })

  // Group H: B only (A is NOT a member). Activity here must never reach A.
  const H = await prisma.group.create({
    data: {
      name: "Secret",
      currency: "INR",
      members: { create: [{ userId: B.id, role: "ADMIN" }] },
    },
  })
  await prisma.expense.create({
    data: {
      groupId: H.id,
      payerId: B.id,
      description: "SECRET-EXPENSE",
      amount: new Prisma.Decimal("40.00"),
      splitType: "EQUAL",
      splits: { create: [{ userId: B.id, amount: new Prisma.Decimal("40.00") }] },
    },
  })

  // ── Dashboard for A ─────────────────────────────────────────────────────────
  let res = await api("/api/dashboard", cookieA)
  const dashA = await res.json()
  check("A dashboard 200", res.status === 200, `status=${res.status}`)
  check("A totalOwed = 50", dashA.totalOwed === 50, JSON.stringify({ owed: dashA.totalOwed }))
  check("A totalOwing = 0", dashA.totalOwing === 0)
  check("A netBalance = 50", dashA.netBalance === 50)
  check("A sees exactly 1 group (G)", dashA.groups.length === 1 && dashA.groups[0].id === G.id, JSON.stringify(dashA.groups.map((g) => g.name)))

  // Cross-check against the per-group balances endpoint.
  res = await api(`/api/groups/${G.id}/balances`, cookieA)
  const balG = await res.json()
  const aNet = balG.memberBalances.find((m) => m.user.id === A.id)?.netBalance
  check("dashboard userBalance matches /balances", dashA.groups[0].userBalance === aNet, `dash=${dashA.groups[0].userBalance} balances=${aNet}`)

  // Activity must not leak group H (A is not a member).
  const leaks = dashA.recentActivity.some((a) => a.description.includes("SECRET-EXPENSE"))
  check("A activity excludes non-member group H", !leaks, JSON.stringify(dashA.recentActivity.map((a) => a.description)))
  check("A activity includes own group expense", dashA.recentActivity.some((a) => a.description === "Hotel"))

  // ── Dashboard for B (debtor side) ───────────────────────────────────────────
  res = await api("/api/dashboard", cookieB)
  const dashB = await res.json()
  check("B totalOwing = 50", dashB.totalOwing === 50, JSON.stringify({ owing: dashB.totalOwing }))
  check("B netBalance = -50", dashB.netBalance === -50)
  check("B sees 2 groups (G and H)", dashB.groups.length === 2)

  await cleanup()
  console.log(`\n${pass}/${pass + fail} checks passed.`)
  process.exit(fail === 0 ? 0 : 1)
}

main()
  .catch((e) => {
    console.error("Harness error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
