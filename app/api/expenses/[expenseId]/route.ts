import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { rescaleSplit } from "@/lib/splitEngine"
import { auditLog, getClientIp } from "@/lib/audit"
import {
  directExpenseInclude,
  serializeDirectExpense,
} from "@/lib/expense-shape"

type Params = { params: Promise<{ expenseId: string }> }

const updateDirectExpenseSchema = z
  .object({
    description: z.string().trim().min(1).max(100).optional(),
    // Rupee units (same as the group expense API): positive, ≤ 999999.99, 2dp.
    amount: z
      .number()
      .positive("Amount must be greater than zero")
      .max(999999.99, "Amount is too large")
      .refine((n) => Number.isInteger(Math.round(n * 100)), "At most 2 decimal places")
      .optional(),
    note: z.string().trim().max(1000).nullable().optional(),
    date: z.coerce.date().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, "No fields to update")

// Load a non-deleted DIRECT expense (groupId is null), or null.
async function loadDirectExpense(expenseId: string) {
  return prisma.expense.findFirst({
    where: { id: expenseId, groupId: null, deletedAt: null },
    include: directExpenseInclude,
  })
}

// Is `userId` a participant of this direct expense (payer or in participants)?
function isParticipant(
  expense: { payerId: string; participants: { user: { id: string } }[] },
  userId: string
): boolean {
  return (
    expense.payerId === userId ||
    expense.participants.some((p) => p.user.id === userId)
  )
}

// GET /api/expenses/[expenseId] — visible only to participants.
export async function GET(_request: NextRequest, props: Params) {
  const params = await props.params;
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const expense = await loadDirectExpense(params.expenseId)
  // Return an opaque 404 (not 403) when the user isn't a participant — never
  // reveal the existence of expenses they aren't part of.
  if (!expense || !isParticipant(expense, session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ expense: serializeDirectExpense(expense) })
}

// PATCH /api/expenses/[expenseId] — edit. Only the payer may edit a direct
// expense (there is no group-admin concept here).
export async function PATCH(request: NextRequest, props: Params) {
  const params = await props.params;
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

  const parsed = updateDirectExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const expense = await loadDirectExpense(params.expenseId)
  // Non-participants get an opaque 404; participants who aren't the payer get 403.
  if (!expense || !isParticipant(expense, session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (expense.payerId !== session.user.id) {
    return NextResponse.json(
      { error: "Only the payer can edit this expense" },
      { status: 403 }
    )
  }

  const { description, amount, note, date } = parsed.data
  const amountChanged =
    amount !== undefined && amount !== expense.amount.toNumber()

  const data: Prisma.ExpenseUpdateInput = {}
  if (description !== undefined) data.description = description
  if (note !== undefined) data.notes = note
  if (date !== undefined) data.date = date
  if (amount !== undefined) {
    data.amount = new Prisma.Decimal(amount.toFixed(2))
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (amountChanged) {
      // Recompute splits over the same participants, preserving their existing
      // proportions (equal stays equal, a non-equal split keeps its ratios).
      const current = expense.splits.map((s) => ({
        userId: s.user.id,
        amount: s.amount.toNumber(),
      }))
      const split = rescaleSplit(amount!, current)

      await tx.expenseSplit.deleteMany({ where: { expenseId: expense.id } })
      await tx.expenseSplit.createMany({
        data: current.map(({ userId }) => ({
          expenseId: expense.id,
          userId,
          amount: new Prisma.Decimal(split[userId].toFixed(2)),
        })),
      })
    }

    return tx.expense.update({
      where: { id: expense.id },
      data,
      include: directExpenseInclude,
    })
  })

  revalidatePath('/budgets')
  return NextResponse.json({ expense: serializeDirectExpense(updated) })
}

// DELETE /api/expenses/[expenseId] — soft delete. Only the payer may delete.
export async function DELETE(request: NextRequest, props: Params) {
  const params = await props.params;
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const expense = await prisma.expense.findFirst({
    where: { id: params.expenseId, groupId: null, deletedAt: null },
    select: {
      id: true,
      payerId: true,
      participants: { select: { userId: true } },
    },
  })

  const participates =
    !!expense &&
    (expense.payerId === session.user.id ||
      expense.participants.some((p) => p.userId === session.user.id))
  if (!expense || !participates) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (expense.payerId !== session.user.id) {
    return NextResponse.json(
      { error: "Only the payer can delete this expense" },
      { status: 403 }
    )
  }

  await prisma.expense.update({
    where: { id: expense.id },
    data: { deletedAt: new Date() },
  })

  void auditLog({ actorId: session.user.id, action: "expense.delete", targetId: expense.id, ip: getClientIp(request) })
  revalidatePath('/budgets')
  return NextResponse.json({ success: true })
}
