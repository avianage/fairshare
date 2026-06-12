// Security harness for receipt upload/serve. Verifies magic-byte validation,
// payer-or-admin auth, member-only serving, and filename/traversal guards.
// Run with the dev server up.
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

async function cookieFor(u) {
  const token = await encode({
    token: { id: u.id, name: u.name, email: u.email, sub: u.id },
    secret: SECRET,
    salt: COOKIE_NAME,
  })
  return `${COOKIE_NAME}=${token}`
}

const EMAILS = ["rcpt-a@fairshare.test", "rcpt-b@fairshare.test", "rcpt-c@fairshare.test"]

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { in: EMAILS } }, select: { id: true } })
  if (!users.length) return
  const ids = users.map((u) => u.id)
  const ms = await prisma.groupMember.findMany({ where: { userId: { in: ids } }, select: { groupId: true } })
  const gids = [...new Set(ms.map((m) => m.groupId))]
  await prisma.expenseSplit.deleteMany({ where: { expense: { groupId: { in: gids } } } })
  await prisma.expense.deleteMany({ where: { groupId: { in: gids } } })
  await prisma.groupMember.deleteMany({ where: { groupId: { in: gids } } })
  await prisma.group.deleteMany({ where: { id: { in: gids } } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
}

// Minimal buffer that begins with the PNG magic signature.
function pngBytes() {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  return new Uint8Array([...sig, ...new Array(64).fill(0)])
}

function uploadForm(bytes, type, name) {
  const form = new FormData()
  form.append("file", new File([bytes], name, { type }))
  return form
}

async function main() {
  if (!SECRET) throw new Error("NEXTAUTH_SECRET not loaded")
  await cleanup()

  const hash = await bcrypt.hash("Password1", 12)
  const A = await prisma.user.create({ data: { name: "Amar", email: EMAILS[0], passwordHash: hash } })
  const B = await prisma.user.create({ data: { name: "Bina", email: EMAILS[1], passwordHash: hash } })
  const C = await prisma.user.create({ data: { name: "Chetan", email: EMAILS[2], passwordHash: hash } })
  const [cookieA, cookieB, cookieC] = await Promise.all([cookieFor(A), cookieFor(B), cookieFor(C)])

  const G = await prisma.group.create({
    data: {
      name: "Receipts",
      members: { create: [{ userId: A.id, role: "ADMIN" }, { userId: B.id, role: "MEMBER" }] },
    },
  })
  const expense = await prisma.expense.create({
    data: {
      groupId: G.id, payerId: A.id, description: "Lunch",
      amount: new Prisma.Decimal("100.00"), splitType: "EQUAL",
      splits: { create: [
        { userId: A.id, amount: new Prisma.Decimal("50.00") },
        { userId: B.id, amount: new Prisma.Decimal("50.00") },
      ] },
    },
  })

  const recBase = `/api/groups/${G.id}/expenses/${expense.id}/receipt`
  const up = (cookie, form) => fetch(BASE + recBase, { method: "POST", headers: { Cookie: cookie }, body: form, redirect: "manual" })

  // 1. Member who is neither payer nor admin → 403.
  let res = await up(cookieB, uploadForm(pngBytes(), "image/png", "x.png"))
  check("non-payer/non-admin upload → 403", res.status === 403, `status=${res.status}`)

  // 2. Magic-byte validation: text bytes with image/png Content-Type → 415.
  res = await up(cookieA, uploadForm(new TextEncoder().encode("not an image"), "image/png", "fake.png"))
  check("spoofed Content-Type (bad magic bytes) → 415", res.status === 415, `status=${res.status}`)

  // 3. Real PNG bytes by the payer → 201 with receiptUrl.
  res = await up(cookieA, uploadForm(pngBytes(), "image/png", "real.png"))
  const upBody = await res.json().catch(() => ({}))
  check("payer uploads valid PNG → 201", res.status === 201, `status=${res.status}`)
  const receiptUrl = upBody.receiptUrl
  check("receiptUrl shape /api/uploads/<uuid>.png", /^\/api\/uploads\/[a-f0-9-]{36}\.png$/.test(receiptUrl || ""), receiptUrl)

  // 4. Serve route: payer (member) can view, content-type is image/png.
  res = await fetch(BASE + receiptUrl, { headers: { Cookie: cookieA }, redirect: "manual" })
  check("member GET receipt → 200", res.status === 200, `status=${res.status}`)
  check("served Content-Type image/png", res.headers.get("content-type") === "image/png", res.headers.get("content-type") || "")
  check("served Cache-Control private", (res.headers.get("cache-control") || "").includes("private"), res.headers.get("cache-control") || "")

  // 5. Other member can view too.
  res = await fetch(BASE + receiptUrl, { headers: { Cookie: cookieB }, redirect: "manual" })
  check("second member GET receipt → 200", res.status === 200, `status=${res.status}`)

  // 6. Non-member cannot view (opaque 404).
  res = await fetch(BASE + receiptUrl, { headers: { Cookie: cookieC }, redirect: "manual" })
  check("non-member GET receipt → 404", res.status === 404, `status=${res.status}`)

  // 7. Unauthenticated cannot view (middleware → 401).
  res = await fetch(BASE + receiptUrl, { redirect: "manual" })
  check("unauthenticated GET receipt → 401", res.status === 401, `status=${res.status}`)

  // 8. Bad filename shapes → 404 (regex/traversal guard).
  res = await fetch(BASE + "/api/uploads/evil.txt", { headers: { Cookie: cookieA }, redirect: "manual" })
  check("non-matching filename → 404", res.status === 404, `status=${res.status}`)
  res = await fetch(BASE + "/api/uploads/00000000-0000-0000-0000-000000000000.png", { headers: { Cookie: cookieA }, redirect: "manual" })
  check("valid-shape but unreferenced filename → 404", res.status === 404, `status=${res.status}`)

  // 9. DELETE: non-payer/non-admin → 403; payer → 200; then serve → 404.
  res = await fetch(BASE + recBase, { method: "DELETE", headers: { Cookie: cookieB }, redirect: "manual" })
  check("non-payer/non-admin delete → 403", res.status === 403, `status=${res.status}`)
  res = await fetch(BASE + recBase, { method: "DELETE", headers: { Cookie: cookieA }, redirect: "manual" })
  check("payer deletes receipt → 200", res.status === 200, `status=${res.status}`)
  res = await fetch(BASE + receiptUrl, { headers: { Cookie: cookieA }, redirect: "manual" })
  check("deleted receipt no longer served → 404", res.status === 404, `status=${res.status}`)

  await cleanup()
  console.log(`\n${pass}/${pass + fail} checks passed.`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error("Harness error:", e); process.exit(1) }).finally(() => prisma.$disconnect())
