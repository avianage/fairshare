"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Search, CheckCircle2 } from "lucide-react"
import { getApiError } from "@/lib/api-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "JPY"] as const
type Currency = (typeof CURRENCIES)[number]

const CURRENCY_LABELS: Record<Currency, string> = {
  INR: "₹ INR – Indian Rupee",
  USD: "$ USD – US Dollar",
  EUR: "€ EUR – Euro",
  GBP: "£ GBP – British Pound",
  AED: "AED – UAE Dirham",
  SGD: "$ SGD – Singapore Dollar",
  JPY: "¥ JPY – Japanese Yen",
}

type Group = {
  id: string
  name: string
  emoji: string | null
  description: string | null
  currency: string
  allowMemberInvites: boolean
}
type Member = { id: string; name: string; email: string; role: "ADMIN" | "MEMBER" }

type Pending =
  | { kind: "leave" }
  | { kind: "delete" }
  | { kind: "removeMember"; member: Member }
  | null

export function GroupSettings({
  group,
  members: initialMembers,
  isAdmin,
  isOwner,
  currentUserId,
}: {
  group: Group
  members: Member[]
  isAdmin: boolean
  isOwner: boolean
  currentUserId: string
}) {
  const router = useRouter()

  // Details
  const [name, setName] = useState(group.name)
  const [emoji, setEmoji] = useState(group.emoji ?? "")
  const [description, setDescription] = useState(group.description ?? "")
  const [currency, setCurrency] = useState<Currency>(
    CURRENCIES.includes(group.currency as Currency) ? (group.currency as Currency) : "INR"
  )
  const [savingDetails, setSavingDetails] = useState(false)

  // Permissions
  const [allowMemberInvites, setAllowMemberInvites] = useState(group.allowMemberInvites)
  const [savingPermissions, setSavingPermissions] = useState(false)

  // Members
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [roleChanging, setRoleChanging] = useState<string | null>(null)

  // Add from friends
  type Friend = { id: string; name: string; avatar: string | null }
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendsLoaded, setFriendsLoaded] = useState(false)
  const [friendSearch, setFriendSearch] = useState("")
  const [addingId, setAddingId] = useState<string | null>(null)

  // Invite link
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  // Confirmation flow
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState(false)
  const [checkingBalance, setCheckingBalance] = useState(false)
  const [deleteBlocked, setDeleteBlocked] = useState(false)

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
          currency,
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

  async function savePermissions() {
    setSavingPermissions(true)
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowMemberInvites }),
      })
      if (!res.ok) {
        toast.error(await getApiError(res, "Could not save permissions."))
        setAllowMemberInvites(!allowMemberInvites)
      } else {
        toast.success("Permissions updated.")
      }
    } catch {
      toast.error("Something went wrong.")
      setAllowMemberInvites(!allowMemberInvites)
    } finally {
      setSavingPermissions(false)
    }
  }

  async function toggleMemberInvites() {
    setAllowMemberInvites((v) => !v)
    // Save after state update — use the new value directly
    const newVal = !allowMemberInvites
    setSavingPermissions(true)
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowMemberInvites: newVal }),
      })
      if (!res.ok) {
        toast.error(await getApiError(res, "Could not save permissions."))
        setAllowMemberInvites(!newVal)
      } else {
        toast.success(newVal ? "Members can now invite others." : "Only admins can invite now.")
      }
    } catch {
      toast.error("Something went wrong.")
      setAllowMemberInvites(!newVal)
    } finally {
      setSavingPermissions(false)
    }
  }

  async function changeRole(memberId: string, newRole: "ADMIN" | "MEMBER") {
    setRoleChanging(memberId)
    try {
      const res = await fetch(`/api/groups/${group.id}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        toast.error(await getApiError(res, "Could not update role."))
      } else {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
        )
        toast.success(newRole === "ADMIN" ? "Made admin." : "Removed admin.")
      }
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setRoleChanging(null)
    }
  }

  async function loadFriends() {
    if (friendsLoaded) return
    try {
      const res = await fetch("/api/friends")
      const data = res.ok ? await res.json() : null
      setFriends(data?.friends ?? [])
    } catch {
      toast.error("Could not load friends.")
    } finally {
      setFriendsLoaded(true)
    }
  }

  async function addFriend(friend: Friend) {
    setAddingId(friend.id)
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: friend.id }),
      })
      if (!res.ok) {
        toast.error(await getApiError(res, "Could not add member."))
      } else {
        const data = await res.json().catch(() => null)
        setMembers((prev) => [
          ...prev,
          { id: friend.id, name: friend.name, email: data?.member?.email ?? "", role: "MEMBER" },
        ])
        toast.success(`${friend.name} added to the group.`)
      }
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setAddingId(null)
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
      /* clipboard may be unavailable */
    }
  }

  async function handleDeleteClick() {
    setDeleteBlocked(false)
    setCheckingBalance(true)
    try {
      const res = await fetch(`/api/groups/${group.id}/balances`)
      const data = res.ok ? await res.json() : null
      if (!data?.isSettledUp) {
        setDeleteBlocked(true)
        return
      }
      setPending({ kind: "delete" })
    } catch {
      toast.error("Could not check group balances.")
    } finally {
      setCheckingBalance(false)
    }
  }

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
        const res = await fetch(`/api/groups/${group.id}/members/${currentUserId}`, { method: "DELETE" })
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error)
        toast.success("You left the group.")
        router.push("/groups")
        router.refresh()
      } else if (pending.kind === "removeMember") {
        const res = await fetch(`/api/groups/${group.id}/members/${pending.member.id}`, { method: "DELETE" })
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error)
        toast.success(`Removed ${pending.member.name}.`)
        setMembers((prev) => prev.filter((m) => m.id !== pending.member.id))
        setPending(null)
        setBusy(false)
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

  // Members can invite if they are admin or allowMemberInvites is on
  const canInvite = isAdmin || allowMemberInvites

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
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <NativeSelect
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{CURRENCY_LABELS[c]}</option>
                ))}
              </NativeSelect>
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

      {/* Permissions (owner only) */}
      {isOwner && (
        <section className="rounded-xl border bg-card p-6">
          <h2 className="font-medium">Permissions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Control what group members can do.</p>
          <div className="mt-4">
            <label className="flex cursor-pointer items-start gap-3">
              <div className="relative mt-0.5 flex-shrink-0">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={allowMemberInvites}
                  disabled={savingPermissions}
                  onChange={toggleMemberInvites}
                />
                <div
                  className={`h-5 w-9 rounded-full transition-colors duration-200 ${
                    allowMemberInvites ? "bg-primary" : "bg-muted-foreground/30"
                  } ${savingPermissions ? "opacity-50" : ""}`}
                >
                  <div
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                      allowMemberInvites ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Members can invite others</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When on, any member can generate invite links and add friends directly. When off, only admins can invite.
                </p>
              </div>
            </label>
          </div>
        </section>
      )}

      {/* Members */}
      <section className="rounded-xl border bg-card p-6">
        <h2 className="font-medium">Members ({members.length})</h2>
        <ul className="mt-4 divide-y">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {m.name}
                  {m.id === currentUserId && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {m.role === "ADMIN" && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    Admin
                  </span>
                )}
                {/* Owner-only: promote/demote (not for self) */}
                {isOwner && m.id !== currentUserId && (
                  <button
                    type="button"
                    disabled={roleChanging === m.id}
                    onClick={() => changeRole(m.id, m.role === "ADMIN" ? "MEMBER" : "ADMIN")}
                    className="text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
                  >
                    {roleChanging === m.id
                      ? "…"
                      : m.role === "ADMIN"
                      ? "Remove admin"
                      : "Make admin"}
                  </button>
                )}
                {/* Admin: remove other members */}
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
        {/* Add from friends */}
        {(isAdmin || allowMemberInvites) && (
          <div className="mt-4 border-t pt-4">
            <p className="text-sm font-medium mb-3">Add a friend</p>
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search friends…"
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                onFocus={loadFriends}
                className="pl-8 h-8 text-sm"
              />
            </div>
            {friendsLoaded && (() => {
              const memberIdSet = new Set(members.map((m) => m.id))
              const filtered = friends.filter(
                (f) => !memberIdSet.has(f.id) &&
                  f.name.toLowerCase().includes(friendSearch.toLowerCase())
              )
              if (!friendSearch && filtered.length === 0 && friends.length === 0) {
                return <p className="text-xs text-muted-foreground">No friends on Fairshare yet.</p>
              }
              if (filtered.length === 0 && friendSearch) {
                return <p className="text-xs text-muted-foreground">No friends match &ldquo;{friendSearch}&rdquo;</p>
              }
              if (filtered.length === 0) {
                return <p className="text-xs text-muted-foreground">All your friends are already in this group.</p>
              }
              return (
                <ul className="space-y-1">
                  {filtered.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {f.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <span className="flex-1 min-w-0 text-sm truncate">{f.name}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs shrink-0"
                        disabled={addingId === f.id}
                        onClick={() => addFriend(f)}
                      >
                        {addingId === f.id ? "Adding…" : "Add"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )
            })()}
          </div>
        )}
      </section>

      {/* Invite link */}
      {canInvite && (
        <section className="rounded-xl border bg-card p-6">
          <h2 className="font-medium">Invite members</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a link that lets someone join this group. Links expire after 7 days.
          </p>
          <div className="mt-4 space-y-3">
            <Button type="button" variant="outline" onClick={generateInvite} disabled={generating}>
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
        {deleteBlocked && (
          <p className="mt-3 text-sm text-destructive">
            This group has unsettled balances. Settle all debts between members before deleting the group.
          </p>
        )}
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
              onClick={handleDeleteClick}
              disabled={busy || checkingBalance}
            >
              {checkingBalance ? "Checking…" : "Delete group"}
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
        description="All balances are settled. Deleting the group will permanently remove it for every member. This cannot be undone."
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
