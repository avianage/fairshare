import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

type Params = { params: { token: string } }

// GET /api/friend-invite/[token] — public preview (no auth required)
export async function GET(_req: Request, { params }: Params) {
  const invite = await prisma.friendInvite.findUnique({
    where: { token: params.token },
    select: {
      expiresAt: true,
      invitedBy: { select: { name: true, isBanned: true } },
    },
  })

  if (!invite || invite.expiresAt < new Date() || invite.invitedBy.isBanned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ inviterName: invite.invitedBy.name })
}

// POST /api/friend-invite/[token] — accept the invite (auth required)
export async function POST(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const me = session.user.id

  const invite = await prisma.friendInvite.findUnique({
    where: { token: params.token },
    select: {
      invitedById: true,
      expiresAt: true,
      invitedBy: { select: { name: true, isBanned: true } },
    },
  })

  if (!invite || invite.expiresAt < new Date() || invite.invitedBy.isBanned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (invite.invitedById === me) {
    return NextResponse.json({ error: "self" }, { status: 409 })
  }

  // Already friends — idempotent success
  const existing = await prisma.friendship.findUnique({
    where: { userId_friendId: { userId: me, friendId: invite.invitedById } },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ alreadyFriends: true, inviterName: invite.invitedBy.name })
  }

  // Create both rows atomically
  await prisma.$transaction([
    prisma.friendship.create({ data: { userId: me, friendId: invite.invitedById } }),
    prisma.friendship.create({ data: { userId: invite.invitedById, friendId: me } }),
  ])

  return NextResponse.json({ inviterName: invite.invitedBy.name })
}
