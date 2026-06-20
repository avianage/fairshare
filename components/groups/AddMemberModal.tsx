"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { getApiError } from "@/lib/api-error"
import { X, UserPlus, Copy, Link, Search, Users, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Friend = { id: string; name: string; avatar: string | null }
type Tab = "friends" | "invite"

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

export function AddMemberModal({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("friends")

  // Friends tab state
  const [friends, setFriends] = useState<Friend[]>([])
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set())
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [search, setSearch] = useState("")
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  // Invite tab state
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      loadFriendsAndMembers()
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  async function loadFriendsAndMembers() {
    setLoadingFriends(true)
    setSearch("")
    setAddedIds(new Set())
    try {
      const [friendsRes, membersRes] = await Promise.all([
        fetch("/api/friends"),
        fetch(`/api/groups/${groupId}/members`),
      ])
      const [fData, mData] = await Promise.all([friendsRes.json(), membersRes.json()])
      setFriends(fData.friends ?? [])
      setMemberIds(new Set((mData.members ?? []).map((m: { id: string }) => m.id)))
    } catch {
      toast.error("Could not load friends.")
    } finally {
      setLoadingFriends(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setInviteUrl(null)
    setCopied(false)
    setTab("friends")
  }

  async function addFriend(friend: Friend) {
    setAddingId(friend.id)
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: friend.id }),
      })
      if (!res.ok) {
        toast.error(await getApiError(res, "Could not add member."))
      } else {
        setAddedIds((prev) => new Set([...prev, friend.id]))
        toast.success(`${friend.name} added to the group!`)
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
      const res = await fetch(`/api/groups/${groupId}/invite`, { method: "POST" })
      if (!res.ok) {
        toast.error(await getApiError(res, "Could not generate invite link."))
      } else {
        const data = await res.json().catch(() => null)
        setInviteUrl(data?.inviteUrl)
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
      toast.error("Could not copy link.")
    }
  }

  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Add
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={handleClose}
        >
          <div
            className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border bg-card shadow-xl"
            style={{ maxHeight: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <h2 className="flex-1 font-semibold">Add member</h2>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              <button
                type="button"
                onClick={() => setTab("friends")}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                  tab === "friends"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                From friends
              </button>
              <button
                type="button"
                onClick={() => setTab("invite")}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                  tab === "invite"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Link className="h-3.5 w-3.5" />
                Invite link
              </button>
            </div>

            {/* Friends tab */}
            {tab === "friends" && (
              <div className="flex flex-1 flex-col overflow-hidden p-3 gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search friends…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>

                <div className="flex-1 overflow-y-auto">
                  {loadingFriends ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
                  ) : filteredFriends.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      {friends.length === 0 ? (
                        <>
                          <p>No friends on Fairshare yet.</p>
                          <button
                            type="button"
                            className="mt-1 text-primary hover:underline"
                            onClick={() => setTab("invite")}
                          >
                            Use an invite link instead
                          </button>
                        </>
                      ) : (
                        <p>No friends match &ldquo;{search}&rdquo;</p>
                      )}
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {filteredFriends.map((f) => {
                        const inGroup = memberIds.has(f.id)
                        const justAdded = addedIds.has(f.id)
                        const isAdding = addingId === f.id
                        return (
                          <li
                            key={f.id}
                            className="flex items-center gap-3 rounded-lg px-2 py-2"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {initials(f.name)}
                            </span>
                            <span className="flex-1 min-w-0 text-sm font-medium truncate">{f.name}</span>
                            {inGroup || justAdded ? (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                In group
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs shrink-0"
                                disabled={isAdding}
                                onClick={() => addFriend(f)}
                              >
                                {isAdding ? "Adding…" : "Add"}
                              </Button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Invite link tab */}
            {tab === "invite" && (
              <div className="p-5 space-y-4">
                <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  Share this link — anyone with it can join this group. The link expires after 7 days.
                </div>

                {!inviteUrl ? (
                  <Button
                    type="button"
                    onClick={generateInvite}
                    disabled={generating}
                    className="w-full gap-2"
                  >
                    <Link className="h-4 w-4" />
                    {generating ? "Generating…" : "Generate invite link"}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={inviteUrl}
                        onFocus={(e) => e.target.select()}
                        className="flex-1 text-xs"
                      />
                      <Button type="button" variant="secondary" onClick={copyInvite} className="shrink-0">
                        {copied ? "Copied!" : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <button
                      type="button"
                      onClick={generateInvite}
                      disabled={generating}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Generate a new link
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
