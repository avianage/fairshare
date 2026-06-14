import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const EXPIRY_DAYS = 30

function generateToken(): string {
  const hex = randomBytes(8).toString("hex") // 16 hex chars
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`
}

function buildInviteUrl(token: string) {
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")
  return `${base}/friend-invite/${token}`
}

// GET /api/friends/invite — return the caller's current active invite link, or null
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const invite = await prisma.friendInvite.findFirst({
    where: { invitedById: session.user.id },
    select: { token: true, expiresAt: true },
  })

  if (!invite) return NextResponse.json({ inviteUrl: null })

  return NextResponse.json({
    inviteUrl: buildInviteUrl(invite.token),
    expiresAt: invite.expiresAt,
  })
}

// POST /api/friends/invite — generate (or regenerate) the caller's reusable invite link
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000)
  const token = generateToken()

  await prisma.friendInvite.deleteMany({ where: { invitedById: session.user.id } })
  await prisma.friendInvite.create({
    data: { token, invitedById: session.user.id, expiresAt },
  })

  return NextResponse.json({
    inviteUrl: buildInviteUrl(token),
    expiresAt,
  })
}
