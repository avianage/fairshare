import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getPairwiseBalance } from "@/lib/globalBalances"

export const runtime = "nodejs"

const directSettleSchema = z.object({
  toUserId: z.string().min(1),
  amount: z
    .number()
    .positive("Amount must be greater than zero")
    .max(999999.99, "Amount is too large")
    .refine((n) => Number.isInteger(Math.round(n * 100)), "At most 2 decimal places"),
  note: z.string().trim().max(500).optional(),
})

// POST /api/direct-settle — record that the current user paid `toUserId`,
// settling a direct (non-group) balance between them.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const senderId = session.user.id

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = directSettleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { toUserId, amount, note } = parsed.data

  if (toUserId === senderId) {
    return NextResponse.json(
      { error: "You can't settle up with yourself" },
      { status: 400 }
    )
  }

  // The receiver must be a real user.
  const receiver = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { id: true },
  })
  if (!receiver) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 })
  }

  // A DIRECT settlement may only pay off the DIRECT (non-group) balance — group
  // debts are settled within their group, or the global and per-group views
  // would disagree. Computed against live (soft-delete-safe) data.
  const { directNet } = await getPairwiseBalance(senderId, toUserId)
  // directNet > 0 when the OTHER owes you; you owe them when directNet < 0.
  const youOwe = directNet < 0 ? -directNet : 0
  if (youOwe <= 0) {
    return NextResponse.json(
      { error: "You don't have an outstanding direct balance with this person" },
      { status: 400 }
    )
  }
  if (amount > youOwe + 0.01) {
    return NextResponse.json(
      { error: `Amount exceeds what you owe (${youOwe.toFixed(2)})`, owed: youOwe },
      { status: 400 }
    )
  }

  const settlement = await prisma.settlement.create({
    data: {
      groupId: null, // direct settlement — not tied to a group
      senderId,
      receiverId: toUserId,
      amount: new Prisma.Decimal(amount.toFixed(2)),
      note,
    },
    select: {
      id: true,
      amount: true,
      note: true,
      createdAt: true,
      sender: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
    },
  })

  // Both parties' cached global balances are now stale.
  revalidateTag(`global-debts:${senderId}`)
  revalidateTag(`global-debts:${toUserId}`)

  return NextResponse.json(
    { settlement: { ...settlement, amount: settlement.amount.toNumber() } },
    { status: 201 }
  )
}
