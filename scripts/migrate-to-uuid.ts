/**
 * Migrates existing CUID-based User.id and Expense.id records to UUID v4,
 * so all user-facing URLs (/balances/[userId], /expenses/[expenseId]) use
 * the clean xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx format.
 *
 * Also regenerates GroupInvite tokens to the xxxx-xxxx-xxxx-xxxx format.
 *
 * Safe to run multiple times — UUIDs are only assigned to CUID-format IDs.
 * Group IDs are left untouched (already UUID from generateGroupId()).
 *
 * Usage:
 *   npx tsx scripts/migrate-to-uuid.ts
 */

import { PrismaClient } from "@prisma/client"
import { randomUUID, randomBytes } from "crypto"
import { writeFileSync } from "fs"
import { join } from "path"

const prisma = new PrismaClient()

const BACKUP_FILE = join(process.cwd(), "scripts", "db-backup.json")
const MAPPING_FILE = join(process.cwd(), "scripts", "id-mapping.json")

const CUID_RE = /^c[a-z0-9]{24}$/i

function isCuid(id: string): boolean {
  return CUID_RE.test(id)
}

function generateToken(): string {
  const hex = randomBytes(8).toString("hex")
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`
}

async function main() {
  console.log("📦 Reading database...")

  const [
    users, groups, groupMembers, groupInvites, expenses, expenseSplits,
    directParticipants, settlements, friendships, friendInvites,
    friendRequests, pushSubscriptions, budgets,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.group.findMany(),
    prisma.groupMember.findMany(),
    prisma.groupInvite.findMany(),
    prisma.expense.findMany(),
    prisma.expenseSplit.findMany(),
    prisma.directParticipant.findMany(),
    prisma.settlement.findMany(),
    prisma.friendship.findMany(),
    prisma.friendInvite.findMany(),
    prisma.friendRequest.findMany(),
    prisma.pushSubscription.findMany(),
    prisma.budget.findMany(),
  ])

  // Save full backup before touching anything
  writeFileSync(
    BACKUP_FILE,
    JSON.stringify(
      { users, groups, groupMembers, groupInvites, expenses, expenseSplits,
        directParticipants, settlements, friendships, friendInvites,
        friendRequests, pushSubscriptions, budgets },
      null,
      2
    )
  )
  console.log(`✅ Backup saved → ${BACKUP_FILE}`)
  console.log(`   Users: ${users.length} | Groups: ${groups.length} | Expenses: ${expenses.length}`)

  // Build ID maps: oldId → newUUID (only for CUID-format IDs)
  const userMap = new Map<string, string>()
  const expenseMap = new Map<string, string>()

  for (const u of users) {
    userMap.set(u.id, isCuid(u.id) ? randomUUID() : u.id)
  }
  for (const e of expenses) {
    expenseMap.set(e.id, isCuid(e.id) ? randomUUID() : e.id)
  }

  const remappedUsers = [...userMap.entries()].filter(([o, n]) => o !== n).length
  const remappedExpenses = [...expenseMap.entries()].filter(([o, n]) => o !== n).length
  console.log(`\n🔑 IDs to remap: ${remappedUsers} users, ${remappedExpenses} expenses`)

  if (remappedUsers === 0 && remappedExpenses === 0) {
    console.log("✨ All IDs are already UUID format — nothing to do.")
    return
  }

  console.log("\n🗑️  Clearing database (backup already saved above)...")

  // Delete children before parents (FK order)
  await prisma.budget.deleteMany()
  await prisma.pushSubscription.deleteMany()
  await prisma.friendRequest.deleteMany()
  await prisma.friendInvite.deleteMany()
  await prisma.friendship.deleteMany()
  await prisma.directParticipant.deleteMany()
  await prisma.expenseSplit.deleteMany()
  await prisma.settlement.deleteMany()
  await prisma.groupInvite.deleteMany()
  await prisma.groupMember.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.group.deleteMany()
  await prisma.user.deleteMany()

  console.log("✅ Cleared\n📥 Re-inserting...")

  // ── Users ──────────────────────────────────────────────────────────────────
  for (const u of users) {
    await prisma.user.create({
      data: {
        id: userMap.get(u.id)!,
        name: u.name,
        email: u.email,
        username: u.username,
        usernameChangedAt: u.usernameChangedAt,
        passwordHash: u.passwordHash,
        avatar: u.avatar,
        isAdmin: u.isAdmin,
        isBanned: u.isBanned,
        totalMonthlyBudget: u.totalMonthlyBudget?.toString() ?? null,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      },
    })
  }
  console.log(`  ✓ ${users.length} users`)

  // ── Groups (keep same IDs — already UUID) ──────────────────────────────────
  for (const g of groups) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gAny = g as any
    await prisma.group.create({
      data: {
        id: g.id,
        name: g.name,
        emoji: g.emoji,
        description: g.description,
        currency: g.currency,
        ownerId: gAny.ownerId ? userMap.get(gAny.ownerId) ?? gAny.ownerId : null,
        allowMemberInvites: gAny.allowMemberInvites ?? false,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
        deletedAt: g.deletedAt,
      },
    })
  }
  console.log(`  ✓ ${groups.length} groups`)

  // ── GroupMembers ───────────────────────────────────────────────────────────
  for (const m of groupMembers) {
    await prisma.groupMember.create({
      data: {
        id: m.id,
        userId: userMap.get(m.userId)!,
        groupId: m.groupId,
        role: m.role,
        joinedAt: m.joinedAt,
      },
    })
  }
  console.log(`  ✓ ${groupMembers.length} group members`)

  // ── GroupInvites (regenerate token to xxxx-xxxx-xxxx-xxxx format) ──────────
  for (const inv of groupInvites) {
    await prisma.groupInvite.create({
      data: {
        id: inv.id,
        token: generateToken(),
        groupId: inv.groupId,
        invitedById: userMap.get(inv.invitedById)!,
        expiresAt: inv.expiresAt,
        usedAt: inv.usedAt,
        createdAt: inv.createdAt,
      },
    })
  }
  console.log(`  ✓ ${groupInvites.length} group invites`)

  // ── Expenses ───────────────────────────────────────────────────────────────
  for (const e of expenses) {
    await prisma.expense.create({
      data: {
        id: expenseMap.get(e.id)!,
        groupId: e.groupId,
        payerId: userMap.get(e.payerId)!,
        description: e.description,
        amount: e.amount.toString(),
        category: e.category,
        splitType: e.splitType,
        notes: e.notes,
        receiptUrl: e.receiptUrl,
        date: e.date,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        deletedAt: e.deletedAt,
      },
    })
  }
  console.log(`  ✓ ${expenses.length} expenses`)

  // ── ExpenseSplits ──────────────────────────────────────────────────────────
  for (const s of expenseSplits) {
    await prisma.expenseSplit.create({
      data: {
        id: s.id,
        expenseId: expenseMap.get(s.expenseId)!,
        userId: userMap.get(s.userId)!,
        amount: s.amount.toString(),
      },
    })
  }
  console.log(`  ✓ ${expenseSplits.length} expense splits`)

  // ── DirectParticipants ─────────────────────────────────────────────────────
  for (const dp of directParticipants) {
    await prisma.directParticipant.create({
      data: {
        id: dp.id,
        expenseId: expenseMap.get(dp.expenseId)!,
        userId: userMap.get(dp.userId)!,
      },
    })
  }
  console.log(`  ✓ ${directParticipants.length} direct participants`)

  // ── Settlements ────────────────────────────────────────────────────────────
  for (const s of settlements) {
    await prisma.settlement.create({
      data: {
        id: s.id,
        groupId: s.groupId,
        senderId: userMap.get(s.senderId)!,
        receiverId: userMap.get(s.receiverId)!,
        amount: s.amount.toString(),
        note: s.note,
        createdAt: s.createdAt,
      },
    })
  }
  console.log(`  ✓ ${settlements.length} settlements`)

  // ── Friendships ────────────────────────────────────────────────────────────
  for (const f of friendships) {
    await prisma.friendship.create({
      data: {
        id: f.id,
        userId: userMap.get(f.userId)!,
        friendId: userMap.get(f.friendId)!,
        createdAt: f.createdAt,
      },
    })
  }
  console.log(`  ✓ ${friendships.length} friendships`)

  // ── FriendInvites (keep existing formatted token) ──────────────────────────
  for (const fi of friendInvites) {
    await prisma.friendInvite.create({
      data: {
        id: fi.id,
        token: fi.token,
        invitedById: userMap.get(fi.invitedById)!,
        expiresAt: fi.expiresAt,
        createdAt: fi.createdAt,
      },
    })
  }
  console.log(`  ✓ ${friendInvites.length} friend invites`)

  // ── FriendRequests ─────────────────────────────────────────────────────────
  for (const fr of friendRequests) {
    await prisma.friendRequest.create({
      data: {
        id: fr.id,
        senderId: userMap.get(fr.senderId)!,
        receiverId: userMap.get(fr.receiverId)!,
        createdAt: fr.createdAt,
      },
    })
  }
  console.log(`  ✓ ${friendRequests.length} friend requests`)

  // ── PushSubscriptions ──────────────────────────────────────────────────────
  for (const ps of pushSubscriptions) {
    await prisma.pushSubscription.create({
      data: {
        id: ps.id,
        userId: userMap.get(ps.userId)!,
        endpoint: ps.endpoint,
        p256dh: ps.p256dh,
        auth: ps.auth,
        createdAt: ps.createdAt,
      },
    })
  }
  console.log(`  ✓ ${pushSubscriptions.length} push subscriptions`)

  // ── Budgets ────────────────────────────────────────────────────────────────
  for (const b of budgets) {
    await prisma.budget.create({
      data: {
        id: b.id,
        userId: userMap.get(b.userId)!,
        category: b.category,
        amount: b.amount.toString(),
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      },
    })
  }
  console.log(`  ✓ ${budgets.length} budgets`)

  // Save ID mapping for reference
  writeFileSync(
    MAPPING_FILE,
    JSON.stringify(
      {
        users: Object.fromEntries(userMap),
        expenses: Object.fromEntries(expenseMap),
      },
      null,
      2
    )
  )

  console.log(`\n🎉 Done! Remapped ${remappedUsers} users and ${remappedExpenses} expenses.`)
  console.log(`📋 ID mapping saved → ${MAPPING_FILE}`)
  console.log(`\nRestart your dev server and log back in.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
