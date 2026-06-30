import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireGroupMember } from "@/lib/auth-helpers"
import { computeGroupBalances } from "@/lib/balances"
import { notifyUsers } from "@/lib/notifications"
import { auditLog, getClientIp } from "@/lib/audit"

type Params = { params: Promise<{ groupId: string }> }

const settleSchema = z.object({
  senderId: z.string().min(1),
  receiverId: z.string().min(1),
  amount: z
    .number()
    .positive("Amount must be greater than zero")
    .max(999999.99, "Amount is too large")
    .refine((n) => Number.isInteger(Math.round(n * 100)), "At most 2 decimal places"),
  note: z.string().trim().max(500).optional(),
})

// POST /api/groups/[groupId]/settle — record that senderId paid receiverId.
export async function POST(request: NextRequest, props: Params) {
  const params = await props.params;
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let membership
  try {
    membership = await requireGroupMember(params.groupId, session.user.id)
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

  const parsed = settleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { senderId, receiverId, amount, note } = parsed.data

  if (senderId === receiverId) {
    return NextResponse.json(
      { error: "Sender and receiver must be different" },
      { status: 400 }
    )
  }

  // A user may only record their OWN payment — unless they're a group admin.
  if (senderId !== session.user.id && membership.role !== "ADMIN") {
    return NextResponse.json(
      { error: "You can only record settlements you made" },
      { status: 403 }
    )
  }

  // Both parties must be actual members of this group.
  const memberRows = await prisma.groupMember.findMany({
    where: { groupId: params.groupId, userId: { in: [senderId, receiverId] } },
    select: { userId: true },
  })
  if (memberRows.length !== 2) {
    return NextResponse.json(
      { error: "Both sender and receiver must be members of the group" },
      { status: 400 }
    )
  }

  // The sender must actually owe the receiver, and not more than what's owed.
  const { simplified } = await computeGroupBalances(params.groupId)
  const debt = simplified.find(
    (d) => d.fromUserId === senderId && d.toUserId === receiverId
  )
  if (!debt) {
    return NextResponse.json(
      { error: "There is no outstanding debt from the sender to the receiver" },
      { status: 400 }
    )
  }
  // Guard: don't let a settlement exceed the actual debt (small epsilon for rounding).
  if (amount > debt.amount + 0.01) {
    return NextResponse.json(
      {
        error: `Amount exceeds the outstanding debt of ${debt.amount.toFixed(2)}`,
        owed: debt.amount,
      },
      { status: 400 }
    )
  }

  const settlement = await prisma.settlement.create({
    data: {
      groupId: params.groupId,
      senderId,
      receiverId,
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

  const group = await prisma.group.findUnique({ where: { id: params.groupId }, select: { name: true } })
  void notifyUsers([receiverId], {
    type: "settlement",
    title: `${settlement.sender.name} paid you`,
    body: `₹${amount.toFixed(2)} in ${group?.name ?? "a group"}`,
    url: `/ledger`,
  })
  void auditLog({ actorId: session.user.id, action: "settlement.create", targetId: settlement.id, ip: getClientIp(request), meta: { amount, senderId, receiverId, groupId: params.groupId } })

  return NextResponse.json(
    {
      settlement: {
        ...settlement,
        amount: settlement.amount.toNumber(),
      },
    },
    { status: 201 }
  )
}
