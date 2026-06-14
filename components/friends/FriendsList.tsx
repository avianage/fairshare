"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Copy, Link, RefreshCw, UserMinus, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type Friend = {
  id: string
  name: string
  avatar: string | null
  friendsSince: string
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

export function FriendsList({ initialFriends }: { initialFriends: Friend[] }) {
  const [friends, setFriends] = useState<Friend[]>(initialFriends)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

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

  const expiryDate = inviteExpiry
    ? new Date(inviteExpiry).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null

  return (
    <div className="space-y-6">
      {/* Invite link card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link className="h-4 w-4" /> Your friend invite link
          </CardTitle>
          <CardDescription>
            Share this link with anyone — clicking it adds them as your friend on Fairshare.
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
              No friends yet. Share your invite link to get started.
            </div>
          ) : (
            <ul className="divide-y">
              {friends.map((f) => {
                const since = new Date(f.friendsSince).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                })
                return (
                  <li key={f.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {initials(f.name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-sm">{f.name}</p>
                      <p className="text-xs text-muted-foreground">Friends since {since}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 h-8 gap-1 text-xs text-muted-foreground hover:text-destructive"
                      disabled={removingId === f.id}
                      onClick={() => removeFriend(f.id, f.name)}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Remove</span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
