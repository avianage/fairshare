"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Check, X, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type RequestUser = { id: string; name: string; avatar: string | null }

export type FriendRequestItem = {
  id: string
  createdAt: string
  sender?: RequestUser
  receiver?: RequestUser
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

export function PendingRequests({
  incoming: initialIncoming = [],
  outgoing: initialOutgoing = [],
  onAccepted,
}: {
  incoming?: FriendRequestItem[]
  outgoing?: FriendRequestItem[]
  onAccepted?: (friendId: string, friendName: string) => void
}) {
  const [incoming, setIncoming] = useState(initialIncoming)
  const [outgoing, setOutgoing] = useState(initialOutgoing)
  const [actingOn, setActingOn] = useState<string | null>(null)

  async function accept(req: FriendRequestItem) {
    setActingOn(req.id)
    try {
      const res = await fetch(`/api/friend-requests/${req.id}`, { method: "PATCH" })
      if (!res.ok) { toast.error("Could not accept request."); return }
      setIncoming((prev) => prev.filter((r) => r.id !== req.id))
      toast.success(`You and ${req.sender!.name} are now friends!`)
      window.dispatchEvent(new CustomEvent("fairshare:friendship-changed"))
      onAccepted?.(req.sender!.id, req.sender!.name)
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setActingOn(null)
    }
  }

  async function decline(req: FriendRequestItem) {
    setActingOn(req.id)
    try {
      await fetch(`/api/friend-requests/${req.id}`, { method: "DELETE" })
      setIncoming((prev) => prev.filter((r) => r.id !== req.id))
      toast.success("Request declined.")
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setActingOn(null)
    }
  }

  async function cancel(req: FriendRequestItem) {
    setActingOn(req.id)
    try {
      await fetch(`/api/friend-requests/${req.id}`, { method: "DELETE" })
      setOutgoing((prev) => prev.filter((r) => r.id !== req.id))
      toast.success("Request cancelled.")
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setActingOn(null)
    }
  }

  if (incoming.length === 0 && outgoing.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          Pending requests
          {incoming.length > 0 && (
            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
              {incoming.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {incoming.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Incoming</p>
            <ul className="divide-y rounded-xl border">
              {incoming.map((req) => {
                const person = req.sender!
                const isActing = actingOn === req.id
                return (
                  <li key={req.id} className="flex items-center gap-3 px-4 py-3 first:rounded-t-xl last:rounded-b-xl">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(person.name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{person.name}</p>
                      <p className="text-xs text-muted-foreground">Wants to be friends</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        disabled={isActing}
                        onClick={() => accept(req)}
                      >
                        <Check className="h-3.5 w-3.5" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-destructive"
                        disabled={isActing}
                        onClick={() => decline(req)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {outgoing.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sent</p>
            <ul className="divide-y rounded-xl border">
              {outgoing.map((req) => {
                const person = req.receiver!
                const isActing = actingOn === req.id
                return (
                  <li key={req.id} className="flex items-center gap-3 px-4 py-3 first:rounded-t-xl last:rounded-b-xl">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(person.name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{person.name}</p>
                      <p className="text-xs text-muted-foreground">Request pending</p>
                    </div>
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => cancel(req)}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
