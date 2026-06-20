import { prisma } from "./prisma"

/** Returns the start and end of the month containing `date`. */
function monthRange(date: Date): { gte: Date; lt: Date } {
  const gte = new Date(date.getFullYear(), date.getMonth(), 1)
  const lt = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  return { gte, lt }
}

export type BudgetSpending = {
  category: string
  spent: number
  limit: number
}

/** Total of all the user's expense splits this month (group + direct). */
export async function getTotalMonthSpending(userId: string, month: Date): Promise<number> {
  const range = monthRange(month)
  const result = await prisma.expenseSplit.aggregate({
    where: {
      userId,
      expense: { deletedAt: null, date: range },
    },
    _sum: { amount: true },
  })
  return Math.round((result._sum.amount?.toNumber() ?? 0) * 100) / 100
}

/**
 * For each budget the user has set, calculate how much they've personally
 * spent this month (their share of group expenses + their personal/direct
 * expenses in that category).
 */
export async function getBudgetSpending(userId: string, month: Date): Promise<BudgetSpending[]> {
  const range = monthRange(month)

  const [budgets, splitSpending, directSpending] = await Promise.all([
    prisma.budget.findMany({ where: { userId }, select: { category: true, amount: true } }),

    // User's share from group expenses (their ExpenseSplit amounts)
    prisma.expenseSplit.groupBy({
      by: ["expenseId"],
      where: {
        userId,
        expense: { groupId: { not: null }, deletedAt: null, date: range },
      },
      _sum: { amount: true },
    }).then(async (rows) => {
      // Need category per expense — fetch them
      if (rows.length === 0) return {} as Record<string, number>
      const expenses = await prisma.expense.findMany({
        where: { id: { in: rows.map((r) => r.expenseId) } },
        select: { id: true, category: true },
      })
      const catMap = Object.fromEntries(expenses.map((e) => [e.id, e.category]))
      const result: Record<string, number> = {}
      for (const row of rows) {
        const cat = catMap[row.expenseId] ?? "OTHER"
        result[cat] = (result[cat] ?? 0) + (row._sum.amount?.toNumber() ?? 0)
      }
      return result
    }),

    // Direct expenses where user is a participant (their split amount)
    prisma.expenseSplit.groupBy({
      by: ["expenseId"],
      where: {
        userId,
        expense: { groupId: null, deletedAt: null, date: range },
      },
      _sum: { amount: true },
    }).then(async (rows) => {
      if (rows.length === 0) return {} as Record<string, number>
      const expenses = await prisma.expense.findMany({
        where: { id: { in: rows.map((r) => r.expenseId) } },
        select: { id: true, category: true },
      })
      const catMap = Object.fromEntries(expenses.map((e) => [e.id, e.category]))
      const result: Record<string, number> = {}
      for (const row of rows) {
        const cat = catMap[row.expenseId] ?? "OTHER"
        result[cat] = (result[cat] ?? 0) + (row._sum.amount?.toNumber() ?? 0)
      }
      return result
    }),
  ])

  return budgets.map((b) => ({
    category: b.category,
    spent: Math.round(((splitSpending[b.category] ?? 0) + (directSpending[b.category] ?? 0)) * 100) / 100,
    limit: b.amount.toNumber(),
  }))
}
