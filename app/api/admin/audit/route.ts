import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit = 50
  const action = searchParams.get("action") ?? undefined
  const suspicious = searchParams.get("suspicious") === "true" ? true : undefined

  const where = {
    ...(action ? { action: { contains: action } } : {}),
    ...(suspicious !== undefined ? { suspicious } : {}),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        actorId: true,
        action: true,
        targetId: true,
        meta: true,
        ip: true,
        suspicious: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  // Resolve actor names in one query
  const actorIds = [...new Set(logs.map((l) => l.actorId).filter(Boolean))] as string[]
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
    : []
  const actorMap = Object.fromEntries(actors.map((a) => [a.id, a]))

  return NextResponse.json({
    logs: logs.map((l) => ({ ...l, actor: l.actorId ? actorMap[l.actorId] ?? null : null })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  })
}
