"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Search, UserCheck, UserPlus, Clock, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"

type SearchUser = {
  id: string
  name: string
  username: string | null
  avatar: string | null
  relationship: "friend" | "request_sent" | "request_received" | "none"
  requestId: string | null
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

export function FriendSearch({ onRequestSent }: { onRequestSent?: () => void }) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<SearchUser[]>([])
  const [loading, setLoading] = useState(false)
  const [actingOn, setActingOn] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/users/find?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(data.users ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q])

  async function sendRequest(user: SearchUser) {
    setActingOn(user.id)
    try {
      const res = await fetch("/api/friend-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: user.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Could not send request.")
        return
      }
      if (data.accepted) {
        toast.success(`You and ${user.name} are now friends!`)
      } else {
        toast.success(`Friend request sent to ${user.name}.`)
      }
      // Update local result state
      setResults((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, relationship: data.accepted ? "friend" : "request_sent", requestId: data.id ?? null }
            : u
        )
      )
      onRequestSent?.()
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setActingOn(null)
    }
  }

  async function cancelRequest(user: SearchUser) {
    if (!user.requestId) return
    setActingOn(user.id)
    try {
      await fetch(`/api/friend-requests/${user.requestId}`, { method: "DELETE" })
      setResults((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, relationship: "none", requestId: null } : u
        )
      )
      toast.success("Request cancelled.")
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setActingOn(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or @username…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {results.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card">
          {results.map((u) => {
            const isActing = actingOn === u.id
            return (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3 first:rounded-t-xl last:rounded-b-xl">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initials(u.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{u.name}</p>
                  {u.username && (
                    <p className="text-xs text-muted-foreground">@{u.username}</p>
                  )}
                </div>
                {u.relationship === "friend" && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UserCheck className="h-3.5 w-3.5 text-green-500" /> Friends
                  </span>
                )}
                {u.relationship === "request_sent" && (
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => cancelRequest(u)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Clock className="h-3.5 w-3.5" /> Pending
                  </button>
                )}
                {u.relationship === "request_received" && (
                  <span className="text-xs text-muted-foreground">Sent you a request</span>
                )}
                {u.relationship === "none" && (
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => sendRequest(u)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {isActing ? "Sending…" : "Add"}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {q.trim().length >= 2 && !loading && results.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          No users found for &ldquo;{q}&rdquo;
        </p>
      )}
    </div>
  )
}
