"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"
import { AddExpenseModal } from "@/components/fab/AddExpenseModal"

type PageContext = {
  initialGroupId?: string
  initialMode?: "solo" | "person" | "anyone"
}

/** Derive FAB context from the current pathname. */
function pageContext(pathname: string): PageContext {
  // Group detail page → pre-select that group
  const groupMatch = pathname.match(/^\/groups\/([^/]+)/)
  if (groupMatch && groupMatch[1] !== "new") {
    return { initialGroupId: groupMatch[1] }
  }
  // Personal page → jump straight to solo form
  if (pathname === "/personal") return { initialMode: "solo" }
  // Direct-expenses contact view → jump straight to "a person" form
  if (pathname.startsWith("/direct-expenses/")) return { initialMode: "person" }
  return {}
}

/**
 * Persistent floating "Add expense" button, rendered on every authenticated
 * page. Context-aware: pre-selects the relevant form based on the current page.
 */
export function AddExpenseFAB({
  currentUser,
}: {
  currentUser: { id: string; name: string }
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ctx = pageContext(pathname ?? "")

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add expense"
        className="fixed bottom-6 right-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
      >
        <Plus className="h-6 w-6" />
      </button>

      <AddExpenseModal
        open={open}
        onClose={() => setOpen(false)}
        currentUser={currentUser}
        initialGroupId={ctx.initialGroupId}
        initialMode={ctx.initialMode}
      />
    </>
  )
}
