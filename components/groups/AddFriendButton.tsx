"use client"

import { useState } from "react"
import { UserPlus, Clock, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

type FriendStatus = "friend" | "request_sent" | "request_received" | "none"

interface Props {
  memberId: string
  initialStatus: FriendStatus
  initialRequestId?: string
}

export function AddFriendButton({ memberId, initialStatus, initialRequestId }: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [requestId, setRequestId] = useState(initialRequestId)
  const [loading, setLoading] = useState(false)

  if (status === "friend") return null

  if (status === "request_sent") {
    return (
      <span title="Friend request sent" className="shrink-0 text-muted-foreground/60">
        <Clock className="h-3.5 w-3.5" />
      </span>
    )
  }

  if (status === "request_received") {
    async function accept() {
      if (!requestId || loading) return
      setLoading(true)
      const res = await fetch(`/api/friend-requests/${requestId}`, { method: "PATCH" })
      if (res.ok) setStatus("friend")
      setLoading(false)
    }
    return (
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 shrink-0 text-green-500 hover:bg-green-500/10 hover:text-green-600"
        title="Accept friend request"
        onClick={accept}
        disabled={loading}
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
    )
  }

  // status === "none" — hidden until row hover via CSS class on parent li
  async function sendRequest() {
    if (loading) return
    setLoading(true)
    const res = await fetch("/api/friend-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: memberId }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.accepted) {
        setStatus("friend")
      } else {
        setRequestId(data.id)
        setStatus("request_sent")
      }
    }
    setLoading(false)
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:bg-primary/10 hover:text-primary"
      title="Add as friend"
      onClick={sendRequest}
      disabled={loading}
    >
      <UserPlus className="h-3.5 w-3.5" />
    </Button>
  )
}
