"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Copy, Link, RefreshCw, UserMinus, UserPlus, Users, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { FriendSearch } from "@/components/friends/FriendSearch"
import { PendingRequests, type FriendRequestItem } from "@/components/friends/PendingRequests"

type AdminGroup = { id: string; name: string; emoji: string | null }

type Friend = {
  id: string
  name: string
  avatar: string | null
  friendsSince: string
  sharedGroupCount: number
  availableGroups: AdminGroup[]
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

export function FriendsList({
  initialFriends = [],
  initialIncoming = [],
  initialOutgoing = [],
}: {
  initialFriends?: Friend[]
  initialIncoming?: FriendRequestItem[]
  initialOutgoing?: FriendRequestItem[]
}) {
  const router = useRouter()
  const [friends, setFriends] = useState<Friend[]>(initialFriends)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Per-friend "Add to group" dropdown state
  const [addToGroupOpenId, setAddToGroupOpenId] = useState<string | null>(null)
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null) // "friendId:groupId"

  // Load existing invite link on mount
  useEffect(() => {
    fetch("/api/friends/invite")
      .then((r) => r.json())
      .then((d) => {
        if (d.inviteUrl) {
          setInviteUrl(d.inviteUrl)
          setInviteExpiry(d.expiresAt)
        }
      })
      .catch(() => {})
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    if (!addToGroupOpenId) return
    function close() { setAddToGroupOpenId(null) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [addToGroupOpenId])

  async function generateLink() {
    setGenerating(true)
    setCopied(false)
    const res = await fetch("/api/friends/invite", { method: "POST" })
    setGenerating(false)
    if (!res.ok) { toast.error("Could not generate link"); return }
    const d = await res.json()
    setInviteUrl(d.inviteUrl)
    setInviteExpiry(d.expiresAt)
    toast.success("Invite link generated")
  }

  async function copyLink() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success("Link copied!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy link")
    }
  }

  async function removeFriend(id: string, name: string) {
    if (!confirm(`Remove ${name} from your friends?`)) return
    setRemovingId(id)
    const res = await fetch(`/api/friends/${id}`, { method: "DELETE" })
    setRemovingId(null)
    if (!res.ok) { toast.error("Could not remove friend"); return }
    setFriends((prev) => prev.filter((f) => f.id !== id))
    toast.success(`Removed ${name}`)
  }

  async function addFriendToGroup(friend: Friend, group: AdminGroup) {
    const key = `${friend.id}:${group.id}`
    setAddingToGroup(key)
    setAddToGroupOpenId(null)
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: friend.id }),
      })
      if (res.status === 409) {
        toast.info(`${friend.name} is already in ${group.name}.`)
      } else if (!res.ok) {
        const d = await res.json().catch(() => null)
        toast.error(d?.error ?? "Could not add to group.")
      } else {
        toast.success(`${friend.name} added to ${group.name}!`)
        // Remove that group from availableGroups and bump shared count
        setFriends((prev) =>
          prev.map((f) =>
            f.id === friend.id
              ? {
                  ...f,
                  sharedGroupCount: f.sharedGroupCount + 1,
                  availableGroups: f.availableGroups.filter((g) => g.id !== group.id),
                }
              : f
          )
        )
      }
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setAddingToGroup(null)
    }
  }

  const expiryDate = inviteExpiry
    ? new Date(inviteExpiry).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null

  function handleAccepted(friendId: string, friendName: string) {
    setFriends((prev) => [
      ...prev,
      { id: friendId, name: friendName, avatar: null, friendsSince: new Date().toISOString(), sharedGroupCount: 0, availableGroups: [] },
    ].sort((a, b) => a.name.localeCompare(b.name)))
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Find people */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find people</CardTitle>
          <CardDescription>Search by name or @username to send a friend request.</CardDescription>
        </CardHeader>
        <CardContent>
          <FriendSearch onRequestSent={() => router.refresh()} />
        </CardContent>
      </Card>

      {/* Pending requests */}
      <PendingRequests
        incoming={initialIncoming}
        outgoing={initialOutgoing}
        onAccepted={handleAccepted}
      />

      {/* Friends list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" /> Friends ({friends.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {friends.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              No friends yet. Share your invite link below to get started.
            </div>
          ) : (
            <ul className="divide-y">
              {friends.map((f) => {
                const since = new Date(f.friendsSince).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                })
                const isRemoving = removingId === f.id

                return (
                  <li key={f.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {initials(f.name)}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-sm">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Friends since {since}
                        {f.sharedGroupCount > 0 && (
                          <span className="ml-2 inline-flex items-center gap-0.5">
                            <Users className="h-3 w-3" />
                            {f.sharedGroupCount} shared {f.sharedGroupCount === 1 ? "group" : "groups"}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {/* Add to group */}
                      {f.availableGroups.length > 0 && (
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs"
                            disabled={addingToGroup?.startsWith(f.id) || isRemoving}
                            onClick={() => setAddToGroupOpenId(addToGroupOpenId === f.id ? null : f.id)}
                          >
                            Add to group
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          {addToGroupOpenId === f.id && (
                            <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-lg border bg-card p-1 shadow-lg">
                              {f.availableGroups.map((g) => (
                                <button
                                  key={g.id}
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                                  onClick={() => addFriendToGroup(f, g)}
                                >
                                  <span>{g.emoji ?? "👥"}</span>
                                  <span className="truncate">{g.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1 text-xs text-muted-foreground hover:text-destructive"
                        disabled={isRemoving || !!addingToGroup}
                        onClick={() => removeFriend(f.id, f.name)}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Remove</span>
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Invite link card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link className="h-4 w-4" /> Invite a friend
          </CardTitle>
          <CardDescription>
            Share this link — clicking it adds them as your friend on Fairshare.
            {expiryDate && <span className="block mt-0.5 text-xs">Expires {expiryDate}</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {inviteUrl ? (
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl} onFocus={(e) => e.target.select()} className="flex-1 text-xs" />
              <Button type="button" variant="secondary" onClick={copyLink} className="shrink-0">
                {copied ? "Copied!" : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : null}
          <Button
            type="button"
            variant={inviteUrl ? "outline" : "default"}
            onClick={generateLink}
            disabled={generating}
            className="gap-2"
          >
            {inviteUrl
              ? <><RefreshCw className="h-4 w-4" /> Regenerate link</>
              : <><Link className="h-4 w-4" /> Generate invite link</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
