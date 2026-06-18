import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getContextualDebts } from "@/lib/globalBalances"
import { z } from "zod"

// GET /api/global-settle?with=<userId>
// Returns per-context breakdown of what the current user owes counterparty.
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const counterpartyId = searchParams.get("with")
  if (!counterpartyId) return NextResponse.json({ error: "Missing ?with param" }, { status: 400 })

  const debts = await getContextualDebts(session.user.id, counterpartyId)
  return NextResponse.json(debts)
}

const postSchema = z.object({
  counterpartyId: z.string().min(1),
  contexts: z
    .array(
      z.object({
        groupId: z.string().nullable(),
        amount: z.number().positive(),
      })
    )
    .min(1),
})

// POST /api/global-settle
// Records settlements across one or more contexts in a single transaction.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const body = await req.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const { counterpartyId, contexts } = parsed.data

  // Validate counterparty exists
  const counterparty = await prisma.user.findUnique({ where: { id: counterpartyId }, select: { id: true } })
  if (!counterparty) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // Validate amounts against current debts (prevent over-settling)
  const currentDebts = await getContextualDebts(userId, counterpartyId)
  const debtMap = new Map(currentDebts.map((d) => [d.groupId, d.amount]))

  for (const ctx of contexts) {
    const current = debtMap.get(ctx.groupId) ?? 0
    if (current <= 0.009) {
      return NextResponse.json(
        { error: `No debt to settle in ${ctx.groupId ? "this group" : "direct expenses"}.` },
        { status: 422 }
      )
    }
    if (ctx.amount > current + 0.01) {
      return NextResponse.json(
        { error: `Amount exceeds what you owe in ${ctx.groupId ? "this group" : "direct expenses"}.` },
        { status: 422 }
      )
    }
  }

  // For group contexts: verify the current user is a member
  const groupIds = contexts.map((c) => c.groupId).filter(Boolean) as string[]
  if (groupIds.length > 0) {
    const memberships = await prisma.groupMember.findMany({
      where: { userId, groupId: { in: groupIds } },
      select: { groupId: true },
    })
    const memberSet = new Set(memberships.map((m) => m.groupId))
    for (const gid of groupIds) {
      if (!memberSet.has(gid)) {
        return NextResponse.json({ error: "Not a member of one of the groups." }, { status: 403 })
      }
    }
  }

  await prisma.$transaction(
    contexts.map((ctx) =>
      prisma.settlement.create({
        data: {
          senderId: userId,
          receiverId: counterpartyId,
          amount: Math.round(ctx.amount * 100) / 100,
          groupId: ctx.groupId,
        },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
