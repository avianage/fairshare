import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

  if (userId === session.user.id && ["ban", "removeAdmin", "delete"].includes(action)) {
    return NextResponse.json({ error: "Cannot perform this action on yourself" }, { status: 400 })
  }

  if (action === "delete") {
    // Clear all FK references before deleting
    await prisma.$transaction([
      prisma.expenseSplit.deleteMany({ where: { userId } }),
      prisma.settlement.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } }),
      prisma.directParticipant.deleteMany({ where: { userId } }),
      prisma.expense.deleteMany({ where: { payerId: userId } }),
      prisma.groupMember.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ])
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
      select: { id: true, name: true, username: true, email: true, isAdmin: true, isBanned: true },
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
    select: { id: true, isBanned: true, isAdmin: true },
  })

  return NextResponse.json(user)
}
