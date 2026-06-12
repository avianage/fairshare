// Integration test harness for the Groups feature.
// Seeds two users, mints real NextAuth session cookies, and drives the live
// HTTP API exactly like the manual curl/SQL checks. Run with the dev server up.
import { PrismaClient } from "@prisma/client"
import { encode } from "next-auth/jwt"
import bcrypt from "bcryptjs"

const BASE = "http://localhost:3000"
const COOKIE_NAME = "authjs.session-token" // http (non-secure) default in v5
const SECRET = process.env.NEXTAUTH_SECRET
const prisma = new PrismaClient()

let pass = 0
let fail = 0
function check(label, ok, detail = "") {
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"}  ${label}${detail ? "  — " + detail : ""}`)
  ok ? pass++ : fail++
}

// Mint a session cookie the middleware + auth() will accept.
async function cookieFor(user) {
  const token = await encode({
    token: { id: user.id, name: user.name, email: user.email, sub: user.id },
    secret: SECRET,
    salt: COOKIE_NAME,
  })
  return `${COOKIE_NAME}=${token}`
}

function api(path, { cookie, method = "GET", body } = {}) {
  return fetch(BASE + path, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  })
}

const ALL_TEST_EMAILS = [
  "test-a@fairshare.test",
  "test-b@fairshare.test",
  "test-c@fairshare.test",
]

// Remove all data tied to the test users, in FK-safe order. Idempotent —
// safe to run before seeding (clears crashed-run residue) and after.
async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { in: ALL_TEST_EMAILS } },
    select: { id: true },
  })
  if (users.length === 0) return
  const userIds = users.map((u) => u.id)
  const memberships = await prisma.groupMember.findMany({
    where: { userId: { in: userIds } },
    select: { groupId: true },
  })
  const groupIds = [...new Set(memberships.map((m) => m.groupId))]
  await prisma.groupInvite.deleteMany({
    where: { OR: [{ groupId: { in: groupIds } }, { invitedById: { in: userIds } }] },
  })
  await prisma.groupMember.deleteMany({ where: { groupId: { in: groupIds } } })
  await prisma.group.deleteMany({ where: { id: { in: groupIds } } })
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
}

// In `next dev`, each route is compiled on its first request — that first
// response is HTML, not JSON, and would break assertions. Hit every route
// family once up front (results ignored) so compilation is done before tests.
async function warmup() {
  const paths = [
    ["/api/groups", "GET"],
    ["/api/groups", "POST"],
    ["/api/groups/_warm", "GET"],
    ["/api/groups/_warm/invite", "POST"],
    ["/api/groups/_warm/members/_warm", "DELETE"],
    ["/api/invite/_warm", "GET"],
    ["/api/invite/_warm", "POST"],
  ]
  for (const [path, method] of paths) {
    try {
      const res = await api(path, { method, body: method === "POST" ? {} : undefined })
      await res.text().catch(() => {})
    } catch {
      /* ignore — we only care that the route module is compiled */
    }
  }
}

async function main() {
  if (!SECRET) throw new Error("NEXTAUTH_SECRET not loaded — run via dotenv/next")

  await warmup()

  // --- Seed: clean slate for the deterministic test users ---
  const emails = ["test-a@fairshare.test", "test-b@fairshare.test"]
  await cleanup()
  const hash = await bcrypt.hash("Password1", 12)
  const userA = await prisma.user.create({
    data: { name: "Alice", email: emails[0], passwordHash: hash },
  })
  const userB = await prisma.user.create({
    data: { name: "Bob", email: emails[1], passwordHash: hash },
  })
  const cookieA = await cookieFor(userA)
  const cookieB = await cookieFor(userB)

  // ── 1. Create a group as A ────────────────────────────────────────────────
  let res = await api("/api/groups", {
    cookie: cookieA,
    method: "POST",
    body: { name: "Goa Trip", emoji: "🏖️" },
  })
  const created = await res.json()
  check("POST /api/groups creates group (201)", res.status === 201, `status=${res.status}`)
  const groupId = created.group?.id
  check("created group is owned by A as ADMIN", !!groupId)

  // Verify A is ADMIN, B is not a member
  const memA = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: userA.id, groupId } },
  })
  check("A is ADMIN of new group", memA?.role === "ADMIN", `role=${memA?.role}`)

  // ── 2. B accesses A's group → 403 ─────────────────────────────────────────
  res = await api(`/api/groups/${groupId}`, { cookie: cookieB })
  check("non-member GET group detail → 403", res.status === 403, `status=${res.status}`)

  // B should also not see it in their list
  res = await api("/api/groups", { cookie: cookieB })
  const bList = await res.json()
  check(
    "non-member never sees group in GET /api/groups",
    !bList.groups?.some((g) => g.id === groupId),
    `B sees ${bList.groups?.length ?? 0} groups`
  )

  // ── 3. Generate invite as non-admin → 403 ─────────────────────────────────
  // First add B as a MEMBER so we can test the admin-only check distinctly.
  await prisma.groupMember.create({
    data: { groupId, userId: userB.id, role: "MEMBER" },
  })
  res = await api(`/api/groups/${groupId}/invite`, { cookie: cookieB, method: "POST" })
  check("MEMBER generating invite → 403", res.status === 403, `status=${res.status}`)
  // Clean B back out so the invite-accept test below is meaningful.
  await prisma.groupMember.delete({
    where: { userId_groupId: { userId: userB.id, groupId } },
  })

  // ── 4. Invalid/fake invite token → 404 (no "expired" leakage) ─────────────
  res = await api("/api/invite/fake-token-123")
  const fakeBody = await res.json().catch(() => ({}))
  check("GET fake invite token → 404", res.status === 404, `status=${res.status}`)
  check(
    "404 body leaks no expired/used distinction",
    !/expir|used/i.test(JSON.stringify(fakeBody)),
    JSON.stringify(fakeBody)
  )

  // ── 4b. A genuinely expired (real) token → 404, same as fake ──────────────
  const expired = await prisma.groupInvite.create({
    data: {
      groupId,
      invitedById: userA.id,
      expiresAt: new Date(Date.now() - 60_000), // 1 minute in the past
    },
  })
  res = await api(`/api/invite/${expired.token}`)
  const expiredBody = await res.json().catch(() => ({}))
  check("GET expired (real) invite token → 404", res.status === 404, `status=${res.status}`)
  check(
    "expired token gives same opaque 404 (no leakage)",
    !/expir|used/i.test(JSON.stringify(expiredBody)),
    JSON.stringify(expiredBody)
  )
  res = await api(`/api/invite/${expired.token}`, { cookie: cookieB, method: "POST" })
  check("POST accept on expired token → 404", res.status === 404, `status=${res.status}`)

  // ── 5. Admin generates a real invite, B accepts, reuse → 404 ──────────────
  res = await api(`/api/groups/${groupId}/invite`, { cookie: cookieA, method: "POST" })
  const inv = await res.json()
  check("ADMIN generates invite (201)", res.status === 201, `status=${res.status}`)
  const token = inv.inviteUrl?.split("/invite/")[1]
  check("invite url points at /invite/<token>", !!token, inv.inviteUrl)

  // GET preview returns only groupName + inviterName
  res = await api(`/api/invite/${token}`)
  const preview = await res.json()
  check(
    "invite preview returns only {groupName, inviterName}",
    res.status === 200 &&
      preview.groupName === "Goa Trip" &&
      preview.inviterName === "Alice" &&
      Object.keys(preview).length === 2,
    JSON.stringify(preview)
  )

  // B accepts
  res = await api(`/api/invite/${token}`, { cookie: cookieB, method: "POST" })
  const accept = await res.json()
  check("B accepts invite → joins group", res.status === 200 && accept.groupId === groupId, `status=${res.status}`)
  const memB = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: userB.id, groupId } },
  })
  check("B added as MEMBER", memB?.role === "MEMBER", `role=${memB?.role}`)

  // Reuse same token → 404
  res = await api(`/api/invite/${token}`, { cookie: cookieB, method: "POST" })
  check("reusing a used invite token → 404", res.status === 404, `status=${res.status}`)

  // ── DB checks ─────────────────────────────────────────────────────────────
  const crossRows = await prisma.$queryRawUnsafe(
    `SELECT g.id FROM "Group" g JOIN "GroupMember" gm ON g.id = gm."groupId"
     WHERE gm."userId" = $1 AND g.id = $2`,
    userA.id,
    groupId
  )
  // A IS a member of this group, so this returns 1 — invert: check a true non-member (a fresh user).
  const nonMember = await prisma.user.create({
    data: { name: "Carol", email: "test-c@fairshare.test", passwordHash: hash },
  })
  const noRows = await prisma.$queryRawUnsafe(
    `SELECT g.id FROM "Group" g JOIN "GroupMember" gm ON g.id = gm."groupId"
     WHERE gm."userId" = $1 AND g.id = $2`,
    nonMember.id,
    groupId
  )
  check("SQL: non-member join returns 0 rows", noRows.length === 0, `${noRows.length} rows`)

  // Use raw SQL — the column is NOT NULL by schema, so Prisma's typed query
  // would reject `expiresAt: null` outright (an even stronger guarantee).
  const nullExpiry = await prisma.$queryRawUnsafe(
    `SELECT id FROM "GroupInvite" WHERE "expiresAt" IS NULL`
  )
  check("SQL: no GroupInvite has NULL expiresAt", nullExpiry.length === 0, `${nullExpiry.length} rows`)

  // ── Cleanup ───────────────────────────────────────────────────────────────
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
