"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getApiError } from "@/lib/api-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

type Group = {
  id: string
  name: string
  emoji: string | null
  description: string | null
}
type Member = { id: string; name: string; email: string; role: "ADMIN" | "MEMBER" }

// Which confirmation dialog is open, if any.
type Pending =
  | { kind: "leave" }
  | { kind: "delete" }
  | { kind: "removeMember"; member: Member }
  | null

export function GroupSettings({
  group,
  members,
  isAdmin,
  currentUserId,
}: {
  group: Group
  members: Member[]
  isAdmin: boolean
  currentUserId: string
}) {
  const router = useRouter()

  // Rename / details
  const [name, setName] = useState(group.name)
  const [emoji, setEmoji] = useState(group.emoji ?? "")
  const [description, setDescription] = useState(group.description ?? "")
  const [savingDetails, setSavingDetails] = useState(false)

  // Add member by email
  const [addEmail, setAddEmail] = useState("")
  const [adding, setAdding] = useState(false)

  // Invite link
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  // Confirmation flow shared by leave / delete / remove-member.
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState(false)

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault()
    setSavingDetails(true)
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          emoji: emoji.trim() || null,
          description: description.trim() || null,
        }),
      })
      if (!res.ok) {
        toast.error(await getApiError(res, "Could not save changes."))
      } else {
        toast.success("Group details saved.")
        router.refresh()
      }
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setSavingDetails(false)
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    const email = addEmail.trim()
    if (!email) return
    setAdding(true)
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        toast.error(await getApiError(res, "Could not add that person."))
      } else {
        const data = await res.json().catch(() => null)
        toast.success(`Added ${data?.member?.name ?? email} to the group.`)
        setAddEmail("")
        router.refresh()
      }
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setAdding(false)
    }
  }

  async function generateInvite() {
    setCopied(false)
    setGenerating(true)
    try {
      const res = await fetch(`/api/groups/${group.id}/invite`, { method: "POST" })
      if (!res.ok) {
        toast.error(await getApiError(res, "Could not generate an invite link."))
      } else {
        const data = await res.json().catch(() => null)
        setInviteUrl(data?.inviteUrl)
        toast.success("Invite link generated.")
      }
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setGenerating(false)
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success("Link copied to clipboard.")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard may be unavailable; the URL is still visible to copy */
    }
  }

  // Run the currently-pending destructive action.
  async function runPending() {
    if (!pending) return
    setBusy(true)
    try {
      if (pending.kind === "delete") {
        const res = await fetch(`/api/groups/${group.id}`, { method: "DELETE" })
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error)
        toast.success("Group deleted.")
        router.push("/groups")
        router.refresh()
      } else if (pending.kind === "leave") {
        const res = await fetch(
          `/api/groups/${group.id}/members/${currentUserId}`,
          { method: "DELETE" }
        )
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error)
        toast.success("You left the group.")
        router.push("/groups")
        router.refresh()
      } else if (pending.kind === "removeMember") {
        const res = await fetch(
          `/api/groups/${group.id}/members/${pending.member.id}`,
          { method: "DELETE" }
        )
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error)
        toast.success(`Removed ${pending.member.name}.`)
        setPending(null)
        setBusy(false)
        router.refresh()
        return
      }
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Action failed.")
      setBusy(false)
      return
    }
    setPending(null)
    setBusy(false)
  }

  const otherMembers = members.filter((m) => m.id !== currentUserId)

  return (
    <div className="mt-6 space-y-8">
      {/* Details */}
      <section className="rounded-xl border bg-card p-6">
        <h2 className="font-medium">Details</h2>
        {isAdmin ? (
          <form onSubmit={saveDetails} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={50}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emoji">Emoji</Label>
              <Input
                id="emoji"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-20 text-center text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </div>
            <Button type="submit" disabled={savingDetails || name.trim().length < 2}>
              {savingDetails ? "Saving…" : "Save changes"}
            </Button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Only admins can edit group details.
          </p>
        )}
      </section>

      {/* Members (admins can remove) */}
      <section className="rounded-xl border bg-card p-6">
        <h2 className="font-medium">Members ({members.length})</h2>
        <ul className="mt-4 divide-y">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {m.name}
                  {m.id === currentUserId && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      (you)
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex items-center gap-3">
                {m.role === "ADMIN" && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    Admin
                  </span>
                )}
                {isAdmin && m.id !== currentUserId && (
                  <button
                    type="button"
                    onClick={() => setPending({ kind: "removeMember", member: m })}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {isAdmin && (
          <form onSubmit={addMember} className="mt-4 border-t pt-4">
            <Label htmlFor="add-member-email">Add a member by email</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              They must already have a Fairshare account. No account yet? Share
              an invite link below.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                id="add-member-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="name@example.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
              />
              <Button type="submit" disabled={adding || !addEmail.trim()}>
                {adding ? "Adding…" : "Add member"}
              </Button>
            </div>
          </form>
        )}
      </section>

      {/* Invite link (admins only) */}
      {isAdmin && (
        <section className="rounded-xl border bg-card p-6">
          <h2 className="font-medium">Invite members</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a link that lets someone join this group. Links expire after
            7 days.
          </p>
          <div className="mt-4 space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={generateInvite}
              disabled={generating}
            >
              {generating ? "Generating…" : "Generate invite link"}
            </Button>
            {inviteUrl && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={inviteUrl} onFocus={(e) => e.target.select()} />
                <Button type="button" variant="secondary" onClick={copyInvite}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Danger zone */}
      <section className="rounded-xl border border-destructive/30 bg-card p-6">
        <h2 className="font-medium text-destructive">Danger zone</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPending({ kind: "leave" })}
            disabled={busy}
          >
            Leave group
          </Button>
          {isAdmin && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setPending({ kind: "delete" })}
              disabled={busy}
            >
              Delete group
            </Button>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={pending?.kind === "leave"}
        title="Leave this group?"
        description="You'll lose access to its expenses and balances."
        confirmLabel="Leave group"
        destructive
        busy={busy}
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending?.kind === "delete"}
        title="Delete this group?"
        description="This deletes the group for everyone. It can't be undone from the app."
        confirmLabel="Delete group"
        destructive
        busy={busy}
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending?.kind === "removeMember"}
        title="Remove member?"
        description={
          pending?.kind === "removeMember"
            ? `${pending.member.name} will be removed from this group.`
            : undefined
        }
        confirmLabel="Remove"
        destructive
        busy={busy}
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
