import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { directExpenseInclude, serializeDirectExpense } from "@/lib/expense-shape"
import { ExpenseCard } from "@/components/expenses/ExpenseCard"
import { formatINR } from "@/lib/format"
import { categoryMeta } from "@/lib/categories"

export default async function PersonalPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const rawExpenses = await prisma.expense.findMany({
    where: {
      groupId: null,
      deletedAt: null,
      payerId: userId,
      participants: { every: { userId } },
    },
    include: directExpenseInclude,
    orderBy: { date: "desc" },
    take: 50,
  })

  const expenses = rawExpenses.map(serializeDirectExpense)

  // This-month personal spending total
  const thisMonthTotal = rawExpenses
    .filter((e) => e.date >= monthStart && e.date < monthEnd)
    .reduce((sum, e) => sum + e.amount.toNumber(), 0)

  // Spending by category (all-time, personal only)
  const byCategory: Record<string, number> = {}
  for (const e of rawExpenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount.toNumber()
  }
  const categoryRows = Object.entries(byCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div>
          <Link
            href="/profile"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2 md:hidden"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Profile
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Personal Expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Solo expenses only you paid and owe.
          </p>
        </div>

        {thisMonthTotal > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm shadow-sm self-start md:self-center font-medium text-primary">
            <span className="opacity-80">This month</span>
            <span className="font-bold">{formatINR(thisMonthTotal)}</span>
          </div>
        )}
      </div>

      {/* Top categories (personal only) */}
      {categoryRows.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">Spending by category</h2>
          <div className="space-y-3">
            {categoryRows.map(({ category, amount }) => {
              const max = categoryRows[0].amount
              const pct = max > 0 ? (amount / max) * 100 : 0
              const cat = categoryMeta(category)
              return (
                <div key={category} className="flex items-center gap-3">
                  <span className="w-5 text-base" aria-hidden>{cat.icon}</span>
                  <div className="flex-1">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium">{cat.label}</span>
                      <span className="text-muted-foreground">{formatINR(amount)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Expense list */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          All personal expenses
        </h2>
        {expenses.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="text-sm text-muted-foreground">No personal expenses yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use the + button and choose &quot;Just me&quot; to add one.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {expenses.map((expense) => (
              <li key={expense.id}>
                <ExpenseCard
                  expense={expense}
                  currency="INR"
                  groupId={null}
                  currentUserId={userId}
                  isAdmin={session.user.isAdmin === true}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
