import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// GET /api/notifications — 20 most recent notifications + unread count
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, type: true, title: true, body: true, url: true, read: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId: session.user.id, read: false } }),
  ])

  return NextResponse.json({ notifications, unreadCount })
}

const patchSchema = z.object({
  ids: z.array(z.string()).optional(), // if omitted, marks all as read
})

// PATCH /api/notifications — mark notifications as read
export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch { body = {} }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const where = parsed.data.ids?.length
    ? { userId: session.user.id, id: { in: parsed.data.ids } }
    : { userId: session.user.id, read: false }

  await prisma.notification.updateMany({ where, data: { read: true } })

  return NextResponse.json({ ok: true })
}
