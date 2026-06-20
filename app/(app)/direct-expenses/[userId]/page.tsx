import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { directExpenseInclude, serializeDirectExpense } from "@/lib/expense-shape"
import { formatINR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ExpenseCard } from "@/components/expenses/ExpenseCard"
import { DirectSettleButton } from "@/components/balances/DirectSettleButton"

export default async function DirectExpensePersonPage({
  params,
}: {
  params: { userId: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const currentUserId = session.user.id
  const otherId = params.userId
  if (otherId === currentUserId) notFound()

  const other = await prisma.user.findUnique({
    where: { id: otherId },
    select: { id: true, name: true },
  })
  if (!other) notFound()

  const [rawExpenses, settlements] = await Promise.all([
    prisma.expense.findMany({
      where: {
        groupId: null,
        deletedAt: null,
        AND: [
          { splits: { some: { userId: currentUserId } } },
          { splits: { some: { userId: otherId } } },
        ],
      },
      include: directExpenseInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.settlement.findMany({
      where: {
        groupId: null,
        senderId: { in: [currentUserId, otherId] },
        receiverId: { in: [currentUserId, otherId] },
      },
      select: { senderId: true, receiverId: true, amount: true },
    }),
  ])

  if (rawExpenses.length === 0 && settlements.length === 0) notFound()

  const expenses = rawExpenses.map(serializeDirectExpense)

  // Compute bilateral net (positive = other owes me, negative = I owe other)
  let net = 0
  for (const e of rawExpenses) {
    if (e.payerId === currentUserId) {
      const theirSplit = e.splits.find((s) => s.user.id === otherId)
      if (theirSplit) net += theirSplit.amount.toNumber()
    } else {
      const mySplit = e.splits.find((s) => s.user.id === currentUserId)
      if (mySplit) net -= mySplit.amount.toNumber()
    }
  }
  for (const s of settlements) {
    const amt = Number(s.amount)
    if (s.senderId === currentUserId) net += amt
    else if (s.receiverId === currentUserId) net -= amt
  }
  net = Math.round(net * 100) / 100

  const settled = Math.abs(net) < 0.01
  const theyOwe = net > 0.01
  const iOwe = net < -0.01

  return (
    <div className="space-y-6">
      <Link
        href="/direct-expenses"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      {/* Summary header */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{other.name}</h1>
          <p className={cn(
            "mt-1 text-sm font-medium",
            settled ? "text-muted-foreground" : theyOwe ? "text-success" : "text-warning"
          )}>
            {settled
              ? "All settled up"
              : theyOwe
                ? `${other.name} owes you ${formatINR(net)}`
                : `You owe ${other.name} ${formatINR(-net)}`}
          </p>
        </div>
        {iOwe && (
          <DirectSettleButton
            toUserId={other.id}
            toName={other.name}
            amount={-net}
          />
        )}
      </div>

      {/* Expense list */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Expenses ({expenses.length})
        </h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No shared expenses.</p>
        ) : (
          <ul className="space-y-3">
            {expenses.map((expense) => (
              <li key={expense.id}>
                <ExpenseCard
                  expense={expense}
                  currency="INR"
                  groupId={null}
                  currentUserId={currentUserId}
                  isAdmin={session.user.isAdmin === true}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
