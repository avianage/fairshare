"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ExpenseForm } from "@/components/expenses/ExpenseForm"

type Member = { id: string; name: string }

// Button + collapsible form. On success it refreshes the server component so
// the freshly created expense appears in the list.
export function AddExpense({
  groupId,
  members,
  currentUserId,
}: {
  groupId: string
  members: Member[]
  currentUserId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Expenses
        </h2>
        {!open && (
          <Button onClick={() => setOpen(true)} size="sm">
            Add expense
          </Button>
        )}
      </div>

      {open && (
        <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-lg">New expense</h3>
          <ExpenseForm
            groupId={groupId}
            members={members}
            currentUserId={currentUserId}
            onSuccess={() => {
              setOpen(false)
              router.refresh()
              window.dispatchEvent(
                new CustomEvent("fairshare:expense-changed", { detail: { groupId } })
              )
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
