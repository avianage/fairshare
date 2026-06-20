import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { categoryMeta } from "@/lib/categories"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const timeframe = searchParams.get("timeframe") ?? "month"

  let startDate: Date | undefined
  const now = new Date()
  if (timeframe === "week") {
    startDate = new Date(now)
    startDate.setDate(now.getDate() - 7)
  } else if (timeframe === "month") {
    startDate = new Date(now)
    startDate.setDate(now.getDate() - 30)
  }

  const splits = await prisma.expenseSplit.findMany({
    where: {
      userId: session.user.id,
      expense: {
        deletedAt: null,
        ...(startDate ? { date: { gte: startDate } } : {}),
      },
    },
    select: {
      amount: true,
      expense: {
        select: {
          category: true,
          groupId: true,
          group: { select: { name: true, emoji: true } },
        },
      },
    },
  })

  const totalSpent = splits.reduce((sum, s) => sum + Number(s.amount), 0)

  // Aggregate by category
  const catMap = new Map<string, number>()
  for (const s of splits) {
    const cat = s.expense.category
    catMap.set(cat, (catMap.get(cat) ?? 0) + Number(s.amount))
  }
  const byCategory = [...catMap.entries()]
    .map(([category, amount]) => {
      const meta = categoryMeta(category)
      return { category, label: meta.label, icon: meta.icon, amount: Math.round(amount * 100) / 100 }
    })
    .sort((a, b) => b.amount - a.amount)

  // Aggregate by group (null groupId = personal/direct expenses)
  const groupMap = new Map<string | null, { name: string; emoji: string | null; amount: number }>()
  for (const s of splits) {
    const key = s.expense.groupId
    const entry = groupMap.get(key)
    if (entry) {
      entry.amount += Number(s.amount)
    } else {
      groupMap.set(key, {
        name: s.expense.group?.name ?? "Personal",
        emoji: s.expense.group?.emoji ?? null,
        amount: Number(s.amount),
      })
    }
  }
  const byGroup = [...groupMap.entries()]
    .map(([groupId, { name, emoji, amount }]) => ({
      groupId,
      name,
      emoji,
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((a, b) => b.amount - a.amount)

  return NextResponse.json({
    totalSpent: Math.round(totalSpent * 100) / 100,
    byCategory,
    byGroup,
  })
}
