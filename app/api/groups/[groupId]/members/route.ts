import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireGroupAdmin, requireGroupMember } from "@/lib/auth-helpers"

type Params = { params: { groupId: string } }

const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
})

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

  try {
    await requireGroupAdmin(params.groupId, session.user.id)
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    throw e
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = addMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors.email?.[0] ?? "Validation failed" },
      { status: 400 }
    )
  }
  const { email } = parsed.data

  // The group must exist and not be soft-deleted.
  const group = await prisma.group.findFirst({
    where: { id: params.groupId, deletedAt: null },
    select: { id: true },
  })
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Must be an existing account — we never auto-create users here.
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  })
  if (!user) {
    return NextResponse.json(
      {
        error:
          "No Fairshare account uses that email. Share an invite link so they can sign up and join.",
      },
      { status: 404 }
    )
  }

  // Already a member? Surface a clear, non-fatal message.
  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: user.id, groupId: params.groupId } },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: `${user.name} is already in this group.` },
      { status: 409 }
    )
  }

  await prisma.groupMember.create({
    data: { userId: user.id, groupId: params.groupId, role: "MEMBER" },
  })

  return NextResponse.json(
    { member: { id: user.id, name: user.name, email: user.email, role: "MEMBER" } },
    { status: 201 }
  )
}
