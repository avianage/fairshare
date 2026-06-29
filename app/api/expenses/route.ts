import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateSplits } from "@/lib/splitEngine"
import { directExpenseInclude, serializeDirectExpense } from "@/lib/expense-shape"
import { getDirectExpensesForUser } from "@/lib/directExpenses"
import { notifyUsers } from "@/lib/notifications"
import { auditLog, getClientIp } from "@/lib/audit"

const createDirectExpenseSchema = z
  .object({
    description: z.string().trim().min(1, "Description is required").max(100),
    // Money in rupee units (same convention as the group expense API): positive,
    // ≤ 999999.99, at most 2 decimal places.
    amount: z
      .number()
      .positive("Amount must be greater than zero")
      .max(999999.99, "Amount is too large")
      .refine((n) => Number.isInteger(Math.round(n * 100)), "At most 2 decimal places"),
    payerId: z.string().min(1),
    participantIds: z.array(z.string().min(1)).min(1, "Need at least 1 participant"),
    category: z
      .enum(["FOOD", "TRANSPORT", "ACCOMMODATION", "ENTERTAINMENT", "SHOPPING", "GROCERIES", "UTILITIES", "HEALTH", "TRAVEL", "OTHER"])
      .default("OTHER"),
    splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE", "SHARES"]).default("EQUAL"),
    // EXACT: rupee amount per user. PERCENTAGE: percent. SHARES: share count.
    values: z.record(z.string().min(1), z.number().finite().nonnegative()).optional(),
    date: z.coerce.date().optional(),
    note: z.string().trim().max(1000).optional(),
  })
  // This route is for direct expenses only — never accept a groupId here.
  .strict()

// POST /api/expenses — create a direct (non-group) expense.
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

  // Explicitly reject groupId (also caught by .strict()) for a clear message.
  if (body && typeof body === "object" && "groupId" in body) {
    return NextResponse.json(
      { error: "groupId is not accepted on this route; use the group expenses API" },
      { status: 400 }
    )
  }

  const parsed = createDirectExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { description, amount, payerId, category, splitType, values, date, note } = parsed.data
  const participantIds = Array.from(new Set(parsed.data.participantIds))

  // payer must be one of the participants.
  if (!participantIds.includes(payerId)) {
    return NextResponse.json(
      { error: "payerId must be included in participantIds" },
      { status: 400 }
    )
  }

  // Security: the current user must be part of the expense they're creating.
  if (!participantIds.includes(session.user.id)) {
    return NextResponse.json(
      { error: "You can only create expenses you are part of" },
      { status: 403 }
    )
  }

  // Every participant must be a real, existing user.
  const existing = await prisma.user.findMany({
    where: { id: { in: participantIds } },
    select: { id: true },
  })
  const existingIds = new Set(existing.map((u) => u.id))
  const unknown = participantIds.filter((id) => !existingIds.has(id))
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: "All participantIds must reference existing users", unknown },
      { status: 400 }
    )
  }

  const participantSet = new Set(participantIds)

  // Per-type validation, mirroring the group-expense route. Values are never
  // trusted for the final amounts — calculateSplits recomputes server-side.
  if (splitType !== "EQUAL") {
    const providedKeys = Object.keys(values ?? {})
    const stray = providedKeys.filter((k) => !participantSet.has(k))
    if (stray.length > 0) {
      return NextResponse.json(
        { error: "values may only reference participants", stray },
        { status: 400 }
      )
    }

    if (splitType === "EXACT" || splitType === "PERCENTAGE") {
      // Every participant needs an explicit value for these types.
      const missing = participantIds.filter((id) => values?.[id] === undefined)
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `values required for all participants (${splitType})`, missing },
          { status: 400 }
        )
      }
    }

    if (splitType === "SHARES") {
      const bad = providedKeys.filter((k) => {
        const v = values![k]
        return !Number.isInteger(v) || v <= 0
      })
      if (bad.length > 0) {
        return NextResponse.json(
          { error: "shares must be positive integers", invalid: bad },
          { status: 400 }
        )
      }
    }
  }

  // Recompute splits server-side (integer-cent safe inside the engine).
  let split: Record<string, number>
  try {
    split = calculateSplits({
      type: splitType,
      totalAmount: amount,
      memberIds: participantIds,
      values,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid split" },
      { status: 400 }
    )
  }

  const expense = await prisma.expense.create({
    data: {
      groupId: null,
      payerId,
      description,
      amount: new Prisma.Decimal(amount.toFixed(2)),
      category,
      splitType,
      notes: note,
      date: date ?? new Date(),
      participants: {
        create: participantIds.map((userId) => ({ userId })),
      },
      splits: {
        create: participantIds.map((userId) => ({
          userId,
          amount: new Prisma.Decimal(split[userId].toFixed(2)),
        })),
      },
    },
    include: directExpenseInclude,
  })

  // Fire-and-forget push to all participants except the payer
  const recipientIds = participantIds.filter((id) => id !== payerId)
  const payerName = expense.payer.name ?? "Someone"
  void notifyUsers(recipientIds, {
    type: "expense_added",
    title: `${payerName} added an expense`,
    body: `"${description}" · ₹${amount.toFixed(2)}`,
    url: "/direct-expenses",
  })
  void auditLog({ actorId: session.user.id, action: "expense.create", targetId: expense.id, ip: getClientIp(request), meta: { amount, description, direct: true } })

  revalidatePath('/budgets')
  return NextResponse.json(
    { expense: serializeDirectExpense(expense) },
    { status: 201 }
  )
}

// GET /api/expenses — paginated direct expenses the current user is part of.
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get("page")) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20))

  // Fetch all visible direct expenses, then page in memory. (The set per user is
  // small; if it grows, push pagination into the query via the shared where.)
  const all = await getDirectExpensesForUser(session.user.id)
  const total = all.length
  const start = (page - 1) * limit
  const expenses = all.slice(start, start + limit)

  return NextResponse.json({
    expenses,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  })
}
