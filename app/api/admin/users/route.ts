import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { auditLog, getClientIp } from "@/lib/audit"

export const runtime = "nodejs"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) return null
  if (!session.user.isAdmin) return null
  return session
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit = 20
  const search = searchParams.get("q") ?? ""

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { username: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {}

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        isAdmin: true,
        isOwner: true,
        isBanned: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            group: { select: { id: true, name: true, emoji: true } },
          },
        },
        _count: { select: { expensesPaid: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({ users, total, page, limit })
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ban"), userId: z.string() }),
  z.object({ action: z.literal("unban"), userId: z.string() }),
  z.object({ action: z.literal("makeAdmin"), userId: z.string() }),
  z.object({ action: z.literal("removeAdmin"), userId: z.string() }),
  z.object({ action: z.literal("delete"), userId: z.string() }),
  z.object({ action: z.literal("transferOwnership"), userId: z.string() }),
  z.object({
    action: z.literal("updateProfile"),
    userId: z.string(),
    name: z.string().trim().min(2).max(80).optional(),
    username: z
      .string()
      .min(3)
      .max(20)
      .regex(/^[a-zA-Z0-9_]+$/)
      .toLowerCase()
      .optional(),
    email: z.string().email().optional(),
  }),
])

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 })
  }

  const { action, userId } = parsed.data
  const actorIsOwner = session.user.isOwner === true

  // Self-protection
  if (userId === session.user.id && ["ban", "removeAdmin", "delete", "transferOwnership"].includes(action)) {
    return NextResponse.json({ error: "Cannot perform this action on yourself" }, { status: 400 })
  }

  // Fetch the target user to enforce hierarchy rules
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, isOwner: true },
  })
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // Owner is untouchable by site admins
  if (target.isOwner && !actorIsOwner) {
    return NextResponse.json({ error: "The owner cannot be modified." }, { status: 403 })
  }

  // Site admins cannot act on other admins (only owner can)
  if (!actorIsOwner && target.isAdmin && ["ban", "delete", "removeAdmin"].includes(action)) {
    return NextResponse.json({ error: "Site admins cannot act on other admins." }, { status: 403 })
  }

  // makeAdmin and removeAdmin are owner-only
  if (["makeAdmin", "removeAdmin", "transferOwnership"].includes(action) && !actorIsOwner) {
    return NextResponse.json({ error: "Only the owner can promote or demote admins." }, { status: 403 })
  }

  if (action === "transferOwnership") {
    await prisma.$transaction([
      prisma.user.updateMany({ where: { isOwner: true }, data: { isOwner: false } }),
      prisma.user.update({ where: { id: userId }, data: { isOwner: true, isAdmin: true } }),
    ])
    return NextResponse.json({ success: true })
  }

  if (action === "delete") {
    await prisma.$transaction(async (tx) => {
      // Soft-delete expenses paid by this user so balance history is preserved
      await tx.expense.updateMany({
        where: { payerId: userId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      // Reassign or soft-delete groups owned by this user
      const ownedGroups = await tx.group.findMany({
        where: { ownerId: userId, deletedAt: null },
        select: {
          id: true,
          members: { where: { userId: { not: userId }, role: "ADMIN" }, select: { userId: true }, take: 1 },
        },
      })
      for (const g of ownedGroups) {
        if (g.members.length > 0) {
          await tx.group.update({ where: { id: g.id }, data: { ownerId: g.members[0].userId } })
        } else {
          await tx.group.update({ where: { id: g.id }, data: { deletedAt: new Date(), ownerId: null } })
        }
      }
      // Also nullify ownerId on any already-soft-deleted groups still referencing this user
      await tx.group.updateMany({ where: { ownerId: userId }, data: { ownerId: null } })
      // Remove remaining FK references then delete the user
      await tx.settlement.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } })
      await tx.directParticipant.deleteMany({ where: { userId } })
      await tx.groupMember.deleteMany({ where: { userId } })
      await tx.groupInvite.deleteMany({ where: { invitedById: userId } })
      await tx.friendInvite.deleteMany({ where: { invitedById: userId } })
      await tx.friendship.deleteMany({ where: { OR: [{ userId }, { friendId: userId }] } })
      await tx.notification.deleteMany({ where: { userId } })
      await tx.pushSubscription.deleteMany({ where: { userId } })
      await tx.auditLog.updateMany({ where: { actorId: userId }, data: { actorId: null } })
      await tx.user.delete({ where: { id: userId } })
    })
    return NextResponse.json({ success: true })
  }

  if (action === "updateProfile") {
    const { name, username, email } = parsed.data
    const updateData: Record<string, unknown> = {}
    if (name) updateData.name = name
    if (email) {
      const taken = await prisma.user.findFirst({ where: { email, NOT: { id: userId } }, select: { id: true } })
      if (taken) return NextResponse.json({ error: "Email already in use" }, { status: 409 })
      updateData.email = email
    }
    if (username) {
      const taken = await prisma.user.findFirst({ where: { username, NOT: { id: userId } }, select: { id: true } })
      if (taken) return NextResponse.json({ error: "Username already taken" }, { status: 409 })
      updateData.username = username
      updateData.usernameChangedAt = new Date()
    }
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, username: true, email: true, isAdmin: true, isOwner: true, isBanned: true },
    })
    return NextResponse.json(user)
  }

  const flagMap: Record<string, Record<string, boolean>> = {
    ban: { isBanned: true },
    unban: { isBanned: false },
    makeAdmin: { isAdmin: true },
    removeAdmin: { isAdmin: false },
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: flagMap[action],
    select: { id: true, isBanned: true, isAdmin: true, isOwner: true },
  })

  void auditLog({ actorId: session.user.id, action: `admin.${action}`, targetId: userId, ip: getClientIp(request) })
  return NextResponse.json(user)
}
