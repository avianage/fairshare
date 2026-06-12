"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"
import { AddExpenseModal } from "@/components/fab/AddExpenseModal"

/** Extract a groupId when on a group detail page (not /groups or /groups/new). */
function groupContext(pathname: string): string | undefined {
  const m = pathname.match(/^\/groups\/([^/]+)/)
  if (!m) return undefined
  const id = m[1]
  if (id === "new") return undefined
  return id
}

/**
 * Persistent floating "Add expense" button, rendered on every authenticated
 * page. On a group page it pre-selects that group and skips the target picker.
 */
export function AddExpenseFAB({
  currentUser,
}: {
  currentUser: { id: string; name: string }
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const initialGroupId = groupContext(pathname ?? "")

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add expense"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:bottom-6 md:right-6 md:h-14 md:w-14"
      >
        <Plus className="h-6 w-6" />
      </button>

      <AddExpenseModal
        open={open}
        onClose={() => setOpen(false)}
        currentUser={currentUser}
        initialGroupId={initialGroupId}
      />
    </>
  )
}
