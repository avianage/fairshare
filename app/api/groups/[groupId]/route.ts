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

const emojiSchema = z
  .string()
  .trim()
  .min(1)
  .refine((s) => Array.from(s).length <= 8, "Emoji must be a single emoji")

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "JPY"] as const

const updateGroupSchema = z
  .object({
    name: z.string().trim().min(2).max(50).optional(),
    emoji: emojiSchema.nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    currency: z.enum(CURRENCIES).optional(),
    allowMemberInvites: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "No fields to update")

type Params = { params: { groupId: string } }

// GET /api/groups/[groupId] — group detail with full member list.
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

  const group = await prisma.group.findFirst({
    where: { id: params.groupId, deletedAt: null },
    select: {
      id: true,
      name: true,
      emoji: true,
      description: true,
      currency: true,
      ownerId: true,
      allowMemberInvites: true,
      createdAt: true,
      updatedAt: true,
      members: {
        select: {
          role: true,
          user: { select: { id: true, name: true, email: true, avatar: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  })

  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const members = group.members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    avatar: m.user.avatar,
    role: m.role,
  }))

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      description: group.description,
      currency: group.currency,
      ownerId: group.ownerId,
      allowMemberInvites: group.allowMemberInvites,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      members,
    },
  })
}

// PATCH /api/groups/[groupId] — update name/emoji/description (ADMIN only).
export async function PATCH(request: NextRequest, { params }: Params) {
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

  const parsed = updateGroupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // Guard against acting on an already soft-deleted group.
  const existing = await prisma.group.findFirst({
    where: { id: params.groupId, deletedAt: null },
    select: { id: true, ownerId: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // allowMemberInvites can only be toggled by the group owner.
  if ("allowMemberInvites" in parsed.data && existing.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Only the group owner can change invite permissions." }, { status: 403 })
  }

  const group = await prisma.group.update({
    where: { id: params.groupId },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      emoji: true,
      description: true,
      currency: true,
      ownerId: true,
      allowMemberInvites: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ group })
}

// DELETE /api/groups/[groupId] — soft-delete the group (ADMIN only).
export async function DELETE(_request: NextRequest, { params }: Params) {
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

  const { simplified } = await computeGroupBalances(params.groupId)
  if (simplified.length > 0) {
    return NextResponse.json(
      { error: "All balances must be settled before deleting the group." },
      { status: 400 }
    )
  }

  const result = await prisma.group.updateMany({
    where: { id: params.groupId, deletedAt: null },
    data: { deletedAt: new Date() },
  })

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
