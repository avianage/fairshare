"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { X, Users, User, Globe, ChevronLeft } from "lucide-react"
import { ExpenseForm } from "@/components/expenses/ExpenseForm"
import { DirectExpenseForm } from "@/components/fab/DirectExpenseForm"
import { cn } from "@/lib/utils"

type Mode = "choose" | "group" | "person" | "anyone"
type Member = { id: string; name: string }
type GroupOption = { id: string; name: string; emoji: string | null }

export function AddExpenseModal({
  open,
  onClose,
  currentUser,
  initialGroupId,
}: {
  open: boolean
  onClose: () => void
  currentUser: { id: string; name: string }
  initialGroupId?: string
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(initialGroupId ? "group" : "choose")
  const [groupId, setGroupId] = useState<string | undefined>(initialGroupId)
  const [groups, setGroups] = useState<GroupOption[] | null>(null)
  const [members, setMembers] = useState<Member[] | null>(null)

  // Reset to the right starting step each time the modal opens.
  useEffect(() => {
    if (open) {
      setMode(initialGroupId ? "group" : "choose")
      setGroupId(initialGroupId)
      setMembers(null)
    }
  }, [open, initialGroupId])

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  // Group mode without a preselected group → load the user's groups to pick from.
  useEffect(() => {
    if (open && mode === "group" && !groupId && groups === null) {
      fetch("/api/groups")
        .then((r) => r.json())
        .then((d) => setGroups(d.groups ?? []))
        .catch(() => setGroups([]))
    }
  }, [open, mode, groupId, groups])

  // Once a group is chosen, load its members for the expense form.
  useEffect(() => {
    if (open && mode === "group" && groupId) {
      setMembers(null)
      fetch(`/api/groups/${groupId}/members`)
        .then((r) => r.json())
        .then((d) => setMembers(d.members ?? []))
        .catch(() => setMembers([]))
    }
  }, [open, mode, groupId])

  if (!open) return null

  function done() {
    onClose()
    router.refresh()
  }

  const showBack = mode !== "choose" && !initialGroupId

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex h-[580px] max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          {showBack && (
            <button
              type="button"
              onClick={() => {
                setMode("choose")
                setGroupId(undefined)
                setMembers(null)
              }}
              aria-label="Back"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <h2 className="flex-1 font-semibold">Add expense</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Step 1 — choose target */}
          {mode === "choose" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Who is this expense with?</p>
              <div className="grid gap-3">
                <OptionCard
                  icon={<Users className="h-5 w-5" />}
                  title="A group"
                  description="Split within one of your groups"
                  onClick={() => setMode("group")}
                />
                <OptionCard
                  icon={<User className="h-5 w-5" />}
                  title="A person"
                  description="A one-on-one expense"
                  onClick={() => setMode("person")}
                />
                <OptionCard
                  icon={<Globe className="h-5 w-5" />}
                  title="Anyone"
                  description="Split with several people, no group"
                  onClick={() => setMode("anyone")}
                />
              </div>
            </div>
          )}

          {/* Step 2 — group expense */}
          {mode === "group" && (
            <div className="space-y-4">
              {!groupId ? (
                groups === null ? (
                  <p className="text-sm text-muted-foreground">Loading groups…</p>
                ) : groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    You&apos;re not in any groups yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {groups.map((g) => (
                      <li key={g.id}>
                        <button
                          type="button"
                          onClick={() => setGroupId(g.id)}
                          className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent"
                        >
                          <span className="text-xl">{g.emoji ?? "👥"}</span>
                          <span className="font-medium">{g.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : members === null ? (
                <p className="text-sm text-muted-foreground">Loading members…</p>
              ) : (
                <ExpenseForm
                  groupId={groupId}
                  members={members}
                  currentUserId={currentUser.id}
                  onSuccess={done}
                  onCancel={onClose}
                />
              )}
            </div>
          )}

          {/* Step 2 — direct expense.
              NOTE: the AI NLP quick-entry (NLPExpenseInput + /api/expenses/parse)
              is intentionally not rendered yet — kept for a future iteration. */}
          {(mode === "person" || mode === "anyone") && (
            <DirectExpenseForm
              currentUser={currentUser}
              mode={mode}
              onSuccess={done}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function OptionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors",
        "hover:border-primary/40 hover:bg-accent/40"
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}
