import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = typeof value === "object" ? JSON.stringify(value) : String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// GET /api/admin/audit/export — download full audit log as CSV
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action") ?? undefined
  const suspicious = searchParams.get("suspicious") === "true" ? true : undefined

  const where = {
    ...(action ? { action: { contains: action } } : {}),
    ...(suspicious !== undefined ? { suspicious } : {}),
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10000,
    select: { id: true, actorId: true, action: true, targetId: true, meta: true, ip: true, suspicious: true, createdAt: true },
  })

  const actorIds = [...new Set(logs.map((l) => l.actorId).filter(Boolean))] as string[]
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
    : []
  const actorMap = Object.fromEntries(actors.map((a) => [a.id, a]))

  const header = ["id", "timestamp", "actor_name", "actor_email", "actor_id", "action", "target_id", "ip", "suspicious", "meta"]
  const rows = logs.map((l) => {
    const actor = l.actorId ? actorMap[l.actorId] : null
    return [
      l.id,
      new Date(l.createdAt).toISOString(),
      actor?.name ?? "",
      actor?.email ?? "",
      l.actorId ?? "",
      l.action,
      l.targetId ?? "",
      l.ip ?? "",
      l.suspicious ? "yes" : "no",
      l.meta,
    ].map(escapeCsv).join(",")
  })

  const csv = [header.join(","), ...rows].join("\n")
  const filename = `fairshare-audit-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
