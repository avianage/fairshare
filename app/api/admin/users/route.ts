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
        _count: { select: { memberships: true, expensesPaid: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({ users, total, page, limit })
}

const patchSchema = z.object({
  userId: z.string(),
  action: z.enum(["ban", "unban", "makeAdmin", "removeAdmin", "delete"]),
})

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
    return NextResponse.json({ error: "Validation failed" }, { status: 400 })
  }

  const { userId, action } = parsed.data

  // Prevent admins from acting on themselves
  if (userId === session.user.id) {
    return NextResponse.json({ error: "Cannot perform this action on yourself" }, { status: 400 })
  }

  if (action === "delete") {
    await prisma.user.delete({ where: { id: userId } })
    return NextResponse.json({ success: true })
  }

  const data: Record<string, boolean> = {}
  if (action === "ban") data.isBanned = true
  if (action === "unban") data.isBanned = false
  if (action === "makeAdmin") data.isAdmin = true
  if (action === "removeAdmin") data.isAdmin = false

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, isBanned: true, isAdmin: true },
  })

  return NextResponse.json(user)
}
