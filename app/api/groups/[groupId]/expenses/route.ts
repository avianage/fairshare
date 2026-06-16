import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireGroupMember } from "@/lib/auth-helpers"
import { calculateSplits } from "@/lib/splitEngine"
import { expenseInclude, serializeExpense } from "@/lib/expense-shape"
import { sendPushToUsers } from "@/lib/push"

type Params = { params: { groupId: string } }

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

const createExpenseSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(100),
  // Money: positive, ≤ 999999.99, at most 2 decimal places.
  amount: z
    .number()
    .positive("Amount must be greater than zero")
    .max(999999.99, "Amount is too large")
    .refine((n) => Number.isInteger(Math.round(n * 100)), "At most 2 decimal places"),
  payerId: z.string().min(1),
  date: z.coerce.date().optional(),
  category: z.enum(CATEGORIES).optional(),
  notes: z.string().trim().max(1000).optional(),
  memberIds: z.array(z.string().min(1)).min(1).optional(),
  splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE", "SHARES"]).default("EQUAL"),
  // Per-member values: exact amounts / percentages / share counts. Each finite
  // and non-negative; per-type semantics are enforced in the handler + engine.
  values: z.record(z.string().min(1), z.number().finite().nonnegative()).optional(),
})

// GET /api/groups/[groupId]/expenses — paginated, non-deleted expenses.
export async function GET(request: NextRequest, { params }: Params) {
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

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get("page")) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20))
  const categoryParam = searchParams.get("category")
  const category =
    categoryParam && (CATEGORIES as readonly string[]).includes(categoryParam)
      ? (categoryParam as (typeof CATEGORIES)[number])
      : undefined

  // Validate YYYY-MM-DD date filters; ignore anything malformed.
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")
  const from = fromParam && DATE_RE.test(fromParam) ? new Date(fromParam) : undefined
  // `to` is inclusive — extend to end of day.
  const to =
    toParam && DATE_RE.test(toParam)
      ? new Date(new Date(toParam).getTime() + 24 * 60 * 60 * 1000 - 1)
      : undefined
  const q = (searchParams.get("q") ?? "").trim()

  // deletedAt: null is mandatory on EVERY expense read — never surface deleted rows.
  // Text search uses Prisma's parameterized `contains` (ILIKE) — no raw SQL.
  const where: Prisma.ExpenseWhereInput = {
    groupId: params.groupId,
    deletedAt: null,
    ...(category ? { category } : {}),
    ...(from || to
      ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
    ...(q ? { description: { contains: q, mode: "insensitive" } } : {}),
  }

  const [total, expenses, sum] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      include: expenseInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ])

  return NextResponse.json({
    expenses: expenses.map(serializeExpense),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    // Total of ALL filtered expenses (not just this page).
    filteredTotal: sum._sum.amount ? sum._sum.amount.toNumber() : 0,
  })
}

// POST /api/groups/[groupId]/expenses — create an equal-split expense.
export async function POST(request: NextRequest, { params }: Params) {
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = createExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { description, amount, payerId, date, category, notes, splitType, values } =
    parsed.data

  // The set of users this expense may reference: the group's actual members.
  const members = await prisma.groupMember.findMany({
    where: { groupId: params.groupId },
    select: { userId: true },
  })
  const memberSet = new Set(members.map((m) => m.userId))

  // Security: payer must be a real member of THIS group.
  if (!memberSet.has(payerId)) {
    return NextResponse.json(
      { error: "payerId must be a member of the group" },
      { status: 400 }
    )
  }

  // Default to all group members; otherwise every provided id must be a member.
  const memberIds = parsed.data.memberIds ?? Array.from(memberSet)
  const uniqueMemberIds = Array.from(new Set(memberIds))
  const invalid = uniqueMemberIds.filter((id) => !memberSet.has(id))
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: "All memberIds must be members of the group", invalid },
      { status: 400 }
    )
  }

  // Per-type validation of the supplied values. Never trust client-computed
  // split amounts — these are recomputed from scratch by calculateSplits below.
  const memberIdSet = new Set(uniqueMemberIds)
  if (splitType !== "EQUAL") {
    const providedKeys = Object.keys(values ?? {})
    // Values may only reference members participating in this expense.
    const stray = providedKeys.filter((k) => !memberIdSet.has(k))
    if (stray.length > 0) {
      return NextResponse.json(
        { error: "values may only reference participating members", stray },
        { status: 400 }
      )
    }
    if (splitType === "EXACT" || splitType === "PERCENTAGE") {
      // Every participant needs an explicit value for these types.
      const missing = uniqueMemberIds.filter((id) => values?.[id] === undefined)
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `values required for all members (${splitType})`, missing },
          { status: 400 }
        )
      }
    }
    if (splitType === "SHARES") {
      // Share counts must be positive integers where provided.
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

  // Recompute the split server-side (integer-cent safe / sum-guarded inside).
  let split
  try {
    split = calculateSplits({
      type: splitType,
      totalAmount: amount,
      memberIds: uniqueMemberIds,
      values,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid split" },
      { status: 400 }
    )
  }

  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        groupId: params.groupId,
        payerId,
        description,
        amount: new Prisma.Decimal(amount.toFixed(2)),
        category: category ?? "OTHER",
        splitType,
        notes,
        date: date ?? new Date(),
        splits: {
          create: uniqueMemberIds.map((userId) => ({
            userId,
            amount: new Prisma.Decimal(split[userId].toFixed(2)),
          })),
        },
      },
      include: expenseInclude,
    })
    // Touch the group so its updatedAt reflects recent activity.
    await tx.group.update({
      where: { id: params.groupId },
      data: { updatedAt: new Date() },
    })
    return created
  })

  // Fire-and-forget push to all participants except the payer
  const group = await prisma.group.findUnique({ where: { id: params.groupId }, select: { name: true } })
  const recipientIds = uniqueMemberIds.filter((id) => id !== payerId)
  const payerName = (await prisma.user.findUnique({ where: { id: payerId }, select: { name: true } }))?.name ?? "Someone"
  void sendPushToUsers(recipientIds, {
    title: `${payerName} added an expense`,
    body: `"${description}" · ₹${amount.toFixed(2)} in ${group?.name ?? "a group"}`,
    url: `/groups/${params.groupId}`,
  })

  return NextResponse.json({ expense: serializeExpense(expense) }, { status: 201 })
}
