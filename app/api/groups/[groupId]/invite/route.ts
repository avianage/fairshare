import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireGroupAdmin } from "@/lib/auth-helpers"

const MAX_ACTIVE_INVITES = 10
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

type Params = { params: { groupId: string } }

// POST /api/groups/[groupId]/invite — generate a shareable invite link (ADMIN only).
export async function POST(_request: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await requireGroupAdmin(params.groupId, session.user.id)
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    throw e
  }

  // Don't issue invites for a soft-deleted group.
  const group = await prisma.group.findFirst({
    where: { id: params.groupId, deletedAt: null },
    select: { id: true },
  })
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Enforce the cap on active (unused + non-expired) invites.
  const activeInvites = await prisma.groupInvite.count({
    where: {
      groupId: params.groupId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  })
  if (activeInvites >= MAX_ACTIVE_INVITES) {
    return NextResponse.json(
      { error: "This group already has the maximum number of active invites" },
      { status: 400 }
    )
  }

  const invite = await prisma.groupInvite.create({
    data: {
      groupId: params.groupId,
      invitedById: session.user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
    select: { token: true, expiresAt: true },
  })

  const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${invite.token}`

  return NextResponse.json(
    { inviteUrl, expiresAt: invite.expiresAt },
    { status: 201 }
  )
}
