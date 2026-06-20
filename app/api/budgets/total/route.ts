import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const schema = z.object({
  amount: z.number().nonnegative().max(9999999.99).nullable(),
})

// POST /api/budgets/total — set (or clear) the user's total monthly budget
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { amount } = parsed.data

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      totalMonthlyBudget: amount === null || amount === 0
        ? null
        : new Prisma.Decimal(amount.toFixed(2)),
    },
  })

  return NextResponse.json({ ok: true })
}
