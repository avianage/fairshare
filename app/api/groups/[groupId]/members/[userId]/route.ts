import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  ForbiddenError,
  requireGroupAdmin,
  requireGroupMember,
} from "@/lib/auth-helpers"

type Params = { params: { groupId: string; userId: string } }

// DELETE /api/groups/[groupId]/members/[userId] — remove a member.
//
// Rules:
//  - A user may always remove themselves (leave the group).
//  - Removing anyone else requires ADMIN.
//  - The last ADMIN cannot be removed (would orphan the group).
//  - The last remaining member cannot be removed (use group delete instead).
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const actorId = session.user.id
  const { groupId, userId: targetId } = params
  const isSelf = actorId === targetId

  try {
    // Self-removal only requires membership; removing others requires admin.
    if (isSelf) {
      await requireGroupMember(groupId, actorId)
    } else {
      await requireGroupAdmin(groupId, actorId)
    }
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    throw e
  }

  // The membership being removed must actually exist.
  const target = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: targetId, groupId } },
    select: { id: true, role: true },
  })
  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 })
  }

  const [totalMembers, adminCount] = await Promise.all([
    prisma.groupMember.count({ where: { groupId } }),
    prisma.groupMember.count({ where: { groupId, role: "ADMIN" } }),
  ])

  // Cannot remove the last remaining member entirely.
  if (totalMembers <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the last member of a group" },
      { status: 400 }
    )
  }

  // Cannot remove the last ADMIN (would leave the group without an admin).
  if (target.role === "ADMIN" && adminCount <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the last admin of a group" },
      { status: 400 }
    )
  }

  await prisma.groupMember.delete({
    where: { userId_groupId: { userId: targetId, groupId } },
  })

  return NextResponse.json({ success: true })
}
