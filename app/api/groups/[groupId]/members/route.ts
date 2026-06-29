import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireGroupAdmin, requireGroupMember } from "@/lib/auth-helpers"
import { notifyUsers } from "@/lib/notifications"
import { auditLog, getClientIp } from "@/lib/audit"

type Params = { params: { groupId: string } }

const addMemberSchema = z.union([
  z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address") }),
  z.object({ userId: z.string().min(1, "userId is required") }),
])

// GET /api/groups/[groupId]/members — list members (any member). Used by the
// Add-Expense modal to populate the participant list for a group expense.
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await requireGroupMember(params.groupId, session.user.id)
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    throw e
  }

  const rows = await prisma.groupMember.findMany({
    where: { groupId: params.groupId },
    select: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: { joinedAt: "asc" },
  })

  return NextResponse.json({ members: rows.map((r) => r.user) })
}

// POST /api/groups/[groupId]/members — add an existing Fairshare user to the
// group by email (ADMIN only). For people without an account, use an invite link.
export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = addMemberSchema.safeParse(body)
  if (!parsed.success) {
    const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0]
    return NextResponse.json({ error: firstError ?? "Validation failed" }, { status: 400 })
  }

  // The group must exist and not be soft-deleted.
  const group = await prisma.group.findFirst({
    where: { id: params.groupId, deletedAt: null },
    select: { id: true, allowMemberInvites: true },
  })
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Email path: always admin-only. userId path: any member if allowMemberInvites is on.
  const isMemberInvite = "userId" in parsed.data && group.allowMemberInvites
  try {
    if (isMemberInvite) {
      await requireGroupMember(params.groupId, session.user.id)
    } else {
      await requireGroupAdmin(params.groupId, session.user.id)
    }
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    throw e
  }

  let user: { id: string; name: string; email: string } | null = null

  if ("email" in parsed.data) {
    user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, name: true, email: true },
    })
    if (!user) {
      return NextResponse.json(
        { error: "No Fairshare account uses that email. Share an invite link so they can sign up and join." },
        { status: 404 }
      )
    }
  } else {
    // userId path — only allowed for existing friends (trust check)
    const friendship = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId: session.user.id, friendId: parsed.data.userId } },
      select: { friendId: true },
    })
    if (!friendship) {
      return NextResponse.json({ error: "You can only directly add friends to a group." }, { status: 403 })
    }
    user = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, name: true, email: true },
    })
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 })
  }

  // Already a member? Surface a clear, non-fatal message.
  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: user.id, groupId: params.groupId } },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: `${user.name} is already in this group.` }, { status: 409 })
  }

  await prisma.groupMember.create({
    data: { userId: user.id, groupId: params.groupId, role: "MEMBER" },
  })

  const fullGroup = await prisma.group.findUnique({ where: { id: params.groupId }, select: { name: true } })
  void notifyUsers([user.id], {
    type: "group_join",
    title: `You were added to "${fullGroup?.name ?? "a group"}"`,
    body: "You are now a member of this group.",
    url: `/groups/${params.groupId}`,
  })
  void auditLog({ actorId: session.user.id, action: "group.member_add", targetId: user.id, ip: getClientIp(request), meta: { groupId: params.groupId } })

  return NextResponse.json(
    { member: { id: user.id, name: user.name, email: user.email, role: "MEMBER" } },
    { status: 201 }
  )
}
