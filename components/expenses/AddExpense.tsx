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

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Add expense</Button>
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="mb-4 font-medium">New expense</h2>
      <ExpenseForm
        groupId={groupId}
        members={members}
        currentUserId={currentUserId}
        onSuccess={() => {
          setOpen(false)
          router.refresh()
        }}
        onCancel={() => setOpen(false)}
      />
    </div>
  )
}
