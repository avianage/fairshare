import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  ForbiddenError,
  requireGroupAdmin,
  requireGroupMember,
} from "@/lib/auth-helpers"
import { computeGroupBalances } from "@/lib/balances"

type Params = { params: Promise<{ groupId: string; userId: string }> }

const patchMemberSchema = z.object({ role: z.enum(["ADMIN", "MEMBER"]) })

// PATCH /api/groups/[groupId]/members/[userId] — promote or demote a member (owner only).
export async function PATCH(request: NextRequest, props: Params) {
  const params = await props.params;
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = patchMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "role must be ADMIN or MEMBER" }, { status: 400 })
  }

  const { groupId, userId: targetId } = params

  // Only the group owner can promote/demote.
  const group = await prisma.group.findFirst({
    where: { id: groupId, deletedAt: null },
    select: { ownerId: true },
  })
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (group.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Only the group owner can change member roles." }, { status: 403 })
  }

  // Owner cannot change their own role.
  if (targetId === session.user.id) {
    return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 })
  }

  const target = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: targetId, groupId } },
    select: { id: true },
  })
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 })

  await prisma.groupMember.update({
    where: { userId_groupId: { userId: targetId, groupId } },
    data: { role: parsed.data.role },
  })

  return NextResponse.json({ success: true, role: parsed.data.role })
}

// DELETE /api/groups/[groupId]/members/[userId] — remove a member.
//
// Rules:
//  - A user may always remove themselves (leave the group).
//  - Removing anyone else requires ADMIN.
//  - The last ADMIN cannot be removed (would orphan the group).
//  - The last remaining member cannot be removed (use group delete instead).
export async function DELETE(_request: NextRequest, props: Params) {
  const params = await props.params;
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

  // Block removal if the target has an unsettled balance in this group.
  const { net } = await computeGroupBalances(groupId)
  const targetBalance = net[targetId] ?? 0
  if (Math.abs(targetBalance) > 0.01) {
    return NextResponse.json(
      {
        error: isSelf
          ? "You have unsettled balances in this group. Settle up before leaving."
          : "This member has unsettled balances and cannot be removed.",
      },
      { status: 400 }
    )
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
