import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireGroupMember } from "@/lib/auth-helpers"
import { rescaleSplit } from "@/lib/splitEngine"
import { expenseInclude, serializeExpense } from "@/lib/expense-shape"
import { auditLog, getClientIp } from "@/lib/audit"

type Params = { params: { groupId: string; expenseId: string } }

const CATEGORIES = [
  "FOOD",
  "TRANSPORT",
  "ACCOMMODATION",
  "ENTERTAINMENT",
  "SHOPPING",
  "GROCERIES",
  "UTILITIES",
  "HEALTH",
  "TRAVEL",
  "OTHER",
] as const

const updateExpenseSchema = z
  .object({
    description: z.string().trim().min(1).max(100).optional(),
    amount: z
      .number()
      .positive("Amount must be greater than zero")
      .max(999999.99, "Amount is too large")
      .refine((n) => Number.isInteger(Math.round(n * 100)), "At most 2 decimal places")
      .optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    category: z.enum(CATEGORIES).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "No fields to update")

// Load a non-deleted expense scoped to the group, or null. Membership must be
// checked separately — this only enforces the group/soft-delete scoping.
async function loadExpense(groupId: string, expenseId: string) {
  return prisma.expense.findFirst({
    where: { id: expenseId, groupId, deletedAt: null },
    include: expenseInclude,
  })
}

// GET /api/groups/[groupId]/expenses/[expenseId]
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

  const expense = await loadExpense(params.groupId, params.expenseId)
  if (!expense) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ expense: serializeExpense(expense) })
}

// PATCH /api/groups/[groupId]/expenses/[expenseId]
// Editable by the payer OR a group admin. If the amount changes, splits are
// recomputed across the same participants in a transaction.
export async function PATCH(request: NextRequest, { params }: Params) {
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

  const parsed = updateExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const expense = await loadExpense(params.groupId, params.expenseId)
  if (!expense) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Authorization: payer or group admin may edit.
  const isPayer = expense.payerId === session.user.id
  const isGroupAdmin = membership?.role === "ADMIN"
  if (!isPayer && !isGroupAdmin) {
    return NextResponse.json(
      { error: "Only the payer or a group admin can edit this expense" },
      { status: 403 }
    )
  }

  const { description, amount, notes, category } = parsed.data
  const amountChanged = amount !== undefined && amount !== expense.amount.toNumber()

  const data: Prisma.ExpenseUpdateInput = {}
  if (description !== undefined) data.description = description
  if (notes !== undefined) data.notes = notes
  if (category !== undefined) data.category = category
  if (amount !== undefined) data.amount = new Prisma.Decimal(amount.toFixed(2))

  const updated = await prisma.$transaction(async (tx) => {
    if (amountChanged) {
      // Recompute splits over the same participants, PRESERVING their existing
      // proportions (so a non-equal split keeps its ratios on an amount edit).
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
      include: expenseInclude,
    })
  })

  void auditLog({ actorId: session.user.id, action: "expense.edit", targetId: updated.id, ip: getClientIp(request), meta: { groupId: params.groupId } })
  revalidatePath('/budgets')
  return NextResponse.json({ expense: serializeExpense(updated) })
}

// DELETE /api/groups/[groupId]/expenses/[expenseId] — soft delete.
// Allowed for the payer, a group admin, or a site admin.
export async function DELETE(request: NextRequest, { params }: Params) {
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

  const expense = await prisma.expense.findFirst({
    where: { id: params.expenseId, groupId: params.groupId, deletedAt: null },
    select: { id: true, payerId: true },
  })
  if (!expense) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const isPayer = expense.payerId === session.user.id
  const isGroupAdmin = membership?.role === "ADMIN"
  if (!isPayer && !isGroupAdmin) {
    return NextResponse.json(
      { error: "Only the payer or a group admin can delete this expense" },
      { status: 403 }
    )
  }

  await prisma.expense.update({
    where: { id: expense.id },
    data: { deletedAt: new Date() },
  })

  void auditLog({ actorId: session.user.id, action: "expense.delete", targetId: expense.id, ip: getClientIp(request), meta: { groupId: params.groupId } })
  revalidatePath('/budgets')
  return NextResponse.json({ success: true })
}
