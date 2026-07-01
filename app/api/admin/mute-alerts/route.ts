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

const muteSchema = z.object({ muted: z.boolean() })

// PATCH /api/admin/mute-alerts — toggle the CURRENT admin's own security_alert
// push notifications. Does not affect other admins or the audit log itself.
export async function PATCH(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = muteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { muteSecurityAlerts: parsed.data.muted },
  })

  return NextResponse.json({ muted: parsed.data.muted })
}
