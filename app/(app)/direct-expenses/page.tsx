import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { directExpenseInclude, serializeDirectExpense } from "@/lib/expense-shape"
import { ExpenseCard } from "@/components/expenses/ExpenseCard"

export default async function DirectExpensesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  const raw = await prisma.expense.findMany({
    where: {
      groupId: null,
      deletedAt: null,
      OR: [{ payerId: userId }, { participants: { some: { userId } } }],
    },
    include: directExpenseInclude,
    orderBy: { date: "desc" },
    take: 50,
  })

  const expenses = raw.map(serializeDirectExpense)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Non-group expenses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Individual expenses between you and others, not tied to any group.
        </p>
      </div>

      {expenses.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No individual expenses yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use the + button to add an expense with a person or anyone.
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
  )
}
