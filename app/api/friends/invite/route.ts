import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const EXPIRY_DAYS = 30

function inviteUrl(token: string, origin: string) {
  return `${origin}/friend-invite/${token}`
}

// GET /api/friends/invite — return the caller's current active invite link, or null
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const invite = await prisma.friendInvite.findFirst({
    where: { invitedById: session.user.id },
    select: { token: true, expiresAt: true },
  })

  if (!invite) return NextResponse.json({ inviteUrl: null })

  const origin = new URL(request.url).origin
  return NextResponse.json({
    inviteUrl: inviteUrl(invite.token, origin),
    expiresAt: invite.expiresAt,
  })
}

// POST /api/friends/invite — generate (or regenerate) the caller's reusable invite link
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000)

  // Delete any existing invite and create a fresh one
  await prisma.friendInvite.deleteMany({ where: { invitedById: session.user.id } })
  const invite = await prisma.friendInvite.create({
    data: { invitedById: session.user.id, expiresAt },
    select: { token: true, expiresAt: true },
  })

  const origin = new URL(request.url).origin
  return NextResponse.json({
    inviteUrl: inviteUrl(invite.token, origin),
    expiresAt: invite.expiresAt,
  })
}
