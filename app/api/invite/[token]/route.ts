import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyUsers } from "@/lib/notifications"
import { auditLog, getClientIp } from "@/lib/audit"

type Params = { params: Promise<{ token: string }> }

// Look up a valid (unused, non-expired) invite for an existing group.
// Returns null for any invalid/expired/used token — no distinction is exposed,
// so callers can return a uniform 404 and avoid information leakage.
async function findValidInvite(token: string) {
  return prisma.groupInvite.findFirst({
    where: {
      token,
      usedAt: null,
      expiresAt: { gt: new Date() },
      group: { deletedAt: null },
    },
    select: {
      groupId: true,
      group: { select: { name: true } },
      invitedBy: { select: { name: true } },
    },
  })
}

// GET /api/invite/[token] — validate a token and return minimal preview info.
// Public endpoint (no session required) so the invite page can render a preview.
export async function GET(_request: NextRequest, props: Params) {
  const params = await props.params;
  const invite = await findValidInvite(params.token)
  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 })
  }

  return NextResponse.json({
    groupName: invite.group.name,
    inviterName: invite.invitedBy.name,
  })
}

// POST /api/invite/[token] — accept an invite and join the group as MEMBER.
// Session required (enforced by middleware, double-checked here).
export async function POST(_request: NextRequest, props: Params) {
  const params = await props.params;
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id
  const invite = await findValidInvite(params.token)
  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 })
  }

  // Already a member? Treat as success — they're where the invite leads.
  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: invite.groupId } },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ groupId: invite.groupId, alreadyMember: true })
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Atomically claim the invite: only succeeds if still unused & unexpired.
      const claimed = await tx.groupInvite.updateMany({
        where: {
          token: params.token,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      })
      if (claimed.count === 0) {
        // Lost the race / became invalid between read and write.
        throw new Error("INVITE_CONSUMED")
      }

      await tx.groupMember.create({
        data: { userId, groupId: invite.groupId, role: "MEMBER" },
      })
    })
  } catch (e) {
    if (e instanceof Error && e.message === "INVITE_CONSUMED") {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    }
    throw e
  }

  void notifyUsers([userId], {
    type: "group_join",
    title: `You joined "${invite.group.name}"`,
    body: `Welcome! You are now a member of "${invite.group.name}".`,
    url: `/groups/${invite.groupId}`,
  })
  void auditLog({ actorId: userId, action: "group.invite_accepted", targetId: invite.groupId, ip: getClientIp(_request), meta: { groupName: invite.group.name } })

  return NextResponse.json({ groupId: invite.groupId })
}
