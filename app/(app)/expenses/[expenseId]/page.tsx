import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { categoryMeta } from "@/lib/categories"
import { formatINR, formatExpenseDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ExpenseActions } from "@/components/expenses/ExpenseActions"
import { AutoRefresh } from "@/components/ui/AutoRefresh"

export default async function ExpenseDetailPage(
  props: {
    params: Promise<{ expenseId: string }>
  }
) {
  const params = await props.params;
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const expense = await prisma.expense.findFirst({
    where: {
      id: params.expenseId,
      deletedAt: null,
      OR: [{ payerId: userId }, { splits: { some: { userId } } }],
    },
    select: {
      id: true,
      description: true,
      amount: true,
      category: true,
      splitType: true,
      notes: true,
      receiptUrl: true,
      date: true,
      groupId: true,
      group: { select: { id: true, name: true, emoji: true } },
      payer: { select: { id: true, name: true } },
      splits: {
        select: { amount: true, user: { select: { id: true, name: true } } },
        orderBy: { amount: "desc" },
      },
    },
  })

  if (!expense) notFound()

  const cat = categoryMeta(expense.category)
  const isGroup = expense.groupId !== null
  const canManage = session.user.isAdmin === true || expense.payer.id === userId

  // Back link: group page or the other person's direct-expense view
  let backHref = "/ledger"
  if (isGroup) {
    backHref = `/groups/${expense.groupId}`
  } else {
    // Find the other participant for direct expenses
    const other = expense.splits.find((s) => s.user.id !== userId)
    if (other) backHref = `/direct-expenses/${other.user.id}`
  }

  const expenseForActions = {
    id: expense.id,
    description: expense.description,
    amount: Number(expense.amount),
    category: expense.category,
    notes: expense.notes,
  }

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <AutoRefresh />
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {isGroup ? `Back to ${expense.group?.name}` : "Back to expenses"}
      </Link>

      {/* Header card */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted text-3xl">
            {cat.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold leading-tight">{expense.description}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                  isGroup ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {isGroup ? (expense.group?.emoji ? `${expense.group.emoji} ${expense.group.name}` : expense.group?.name) : "Direct"}
              </span>
              <span className="text-xs text-muted-foreground">{cat.label}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold tabular-nums">{formatINR(Number(expense.amount))}</p>
            <p className="text-xs text-muted-foreground">{formatExpenseDate(expense.date)}</p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground border-t pt-4">
          Paid by <span className="font-medium text-foreground">{expense.payer.name}</span>
        </div>
      </div>

      {/* Split breakdown */}
      <div className="rounded-xl border bg-card shadow-sm">
        <p className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Split ({expense.splits.length} {expense.splits.length === 1 ? "person" : "people"})
        </p>
        <ul className="divide-y">
          {expense.splits.map((s) => (
            <li key={s.user.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-medium">
                {s.user.name}
                {s.user.id === expense.payer.id && (
                  <span className="ml-1.5 text-xs text-muted-foreground">(payer)</span>
                )}
                {s.user.id === userId && s.user.id !== expense.payer.id && (
                  <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                )}
              </span>
              <span className="tabular-nums font-semibold">{formatINR(Number(s.amount))}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Notes */}
      {expense.notes && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Notes</p>
          <p className="text-sm">{expense.notes}</p>
        </div>
      )}

      {/* Receipt */}
      {expense.receiptUrl && (
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Receipt</p>
          <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer" className="block">
            <Image
              src={expense.receiptUrl}
              alt="Receipt"
              width={400}
              height={300}
              className="rounded-lg object-contain max-h-64 w-full"
            />
          </a>
        </div>
      )}

      {/* Edit / Delete */}
      <ExpenseActions
        expense={expenseForActions}
        groupId={expense.groupId}
        backHref={backHref}
        canManage={canManage}
      />
    </div>
  )
}
