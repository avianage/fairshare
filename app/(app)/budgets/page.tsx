import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getBudgetSpending, getTotalMonthSpending } from "@/lib/budgets"
import { BudgetPanel } from "@/components/personal/BudgetPanel"

export default async function BudgetsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const now = new Date()

  const [budgetSpending, totalMonthSpent, userRecord] = await Promise.all([
    getBudgetSpending(userId, now),
    getTotalMonthSpending(userId, now),
    prisma.user.findUnique({ where: { id: userId }, select: { totalMonthlyBudget: true } }),
  ])

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set monthly limits and track your spending.
        </p>
      </div>

      <BudgetPanel
        initialBudgets={budgetSpending}
        initialTotalBudget={userRecord?.totalMonthlyBudget?.toNumber() ?? null}
        initialTotalSpent={totalMonthSpent}
      />
    </div>
  )
}
