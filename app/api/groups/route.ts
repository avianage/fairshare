import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateGroupId } from "@/lib/ids"

// Loosely validate "single emoji": allow up to a few code points (emoji can be
// multi-codepoint, e.g. flags / ZWJ sequences) but reject long strings/text.
const emojiSchema = z
  .string()
  .trim()
  .min(1)
  .refine((s) => Array.from(s).length <= 8, "Emoji must be a single emoji")

const createGroupSchema = z.object({
  name: z.string().trim().min(2, "Name must be 2–50 characters").max(50, "Name must be 2–50 characters"),
  emoji: emojiSchema.optional(),
  description: z.string().trim().max(500).optional(),
  currency: z.string().trim().min(1).max(8).default("INR"),
})

// GET /api/groups — list every group the session user belongs to.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const memberships = await prisma.groupMember.findMany({
    where: {
      userId: session.user.id,
      group: { deletedAt: null },
    },
    select: {
      role: true,
      group: {
        select: {
          id: true,
          name: true,
          emoji: true,
          currency: true,
          updatedAt: true,
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { group: { updatedAt: "desc" } },
  })

  const groups = memberships.map((m) => ({
    id: m.group.id,
    name: m.group.name,
    emoji: m.group.emoji,
    currency: m.group.currency,
    updatedAt: m.group.updatedAt,
    memberCount: m.group._count.members,
    role: m.role,
  }))

  return NextResponse.json({ groups })
}

// POST /api/groups — create a group; creator becomes its ADMIN.
export async function POST(request: NextRequest) {
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

  const parsed = createGroupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { name, emoji, description, currency } = parsed.data
  const userId = session.user.id

  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.group.create({
      // Friendly xxxx-xxxx-xxxx-xxxx id so the group URL reads cleanly.
      data: { id: generateGroupId(), name, emoji, description, currency },
    })
    await tx.groupMember.create({
      data: { groupId: created.id, userId, role: "ADMIN" },
    })
    return created
  })

  return NextResponse.json({ group }, { status: 201 })
}
