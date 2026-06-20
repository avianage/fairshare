import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const CATEGORIES = [
  "FOOD", "GROCERIES", "TRANSPORT", "TRAVEL", "ACCOMMODATION",
  "ENTERTAINMENT", "SHOPPING", "UTILITIES", "HEALTH", "OTHER",
] as const

const budgetSchema = z.object({
  category: z.enum(CATEGORIES),
  amount: z.number().nonnegative().max(9999999.99),
})

// GET /api/budgets — list the current user's budget limits + total monthly budget
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [budgets, user] = await Promise.all([
    prisma.budget.findMany({
      where: { userId: session.user.id },
      select: { category: true, amount: true },
      orderBy: { category: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { totalMonthlyBudget: true },
    }),
  ])

  return NextResponse.json({
    budgets: budgets.map((b) => ({ category: b.category, amount: b.amount.toNumber() })),
    totalBudget: user?.totalMonthlyBudget?.toNumber() ?? null,
  })
}

// POST /api/budgets — upsert a category budget limit (amount=0 deletes it)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = budgetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { category, amount } = parsed.data

  if (amount === 0) {
    await prisma.budget.deleteMany({ where: { userId: session.user.id, category } })
    return NextResponse.json({ ok: true })
  }

  await prisma.budget.upsert({
    where: { userId_category: { userId: session.user.id, category } },
    create: { userId: session.user.id, category, amount: new Prisma.Decimal(amount.toFixed(2)) },
    update: { amount: new Prisma.Decimal(amount.toFixed(2)) },
  })

  return NextResponse.json({ ok: true })
}
