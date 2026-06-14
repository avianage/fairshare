"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShieldCheck, Ban, Trash2, UserCheck, ShieldOff, Search, ChevronLeft, ChevronRight } from "lucide-react"

type AdminUser = {
  id: string
  name: string
  username: string | null
  email: string
  isAdmin: boolean
  isBanned: boolean
  createdAt: string
  _count: { memberships: number; expensesPaid: number }
}

export function AdminDashboard({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const limit = 20
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (query) params.set("q", query)
    const res = await fetch(`/api/admin/users?${params}`)
    if (res.ok) {
      const data = await res.json()
      setUsers(data.users)
      setTotal(data.total)
    }
    setLoading(false)
  }, [page, query])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  async function performAction(userId: string, action: string) {
    setActionLoading(`${userId}:${action}`)
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    })
    setActionLoading(null)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? "Action failed")
      return
    }

    toast.success("Done")
    fetchUsers()
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setQuery(search)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Users ({total})</span>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, username…"
                className="pl-8 w-56 text-sm"
              />
            </div>
            <Button type="submit" size="sm" variant="outline">Search</Button>
          </form>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : users.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Username</th>
                  <th className="px-4 py-3 text-left font-medium">Groups</th>
                  <th className="px-4 py-3 text-left font-medium">Expenses</th>
                  <th className="px-4 py-3 text-left font-medium">Joined</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.id === currentUserId
                  return (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {user.username ? `@${user.username}` : <span className="italic">none</span>}
                      </td>
                      <td className="px-4 py-3">{user._count.memberships}</td>
                      <td className="px-4 py-3">{user._count.expensesPaid}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.isAdmin && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              <ShieldCheck className="h-3 w-3" /> Admin
                            </span>
                          )}
                          {user.isBanned && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                              <Ban className="h-3 w-3" /> Banned
                            </span>
                          )}
                          {!user.isAdmin && !user.isBanned && (
                            <span className="text-xs text-muted-foreground">Active</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {!isSelf && (
                          <div className="flex justify-end gap-1">
                            {user.isBanned ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-xs"
                                disabled={!!actionLoading}
                                onClick={() => performAction(user.id, "unban")}
                              >
                                <UserCheck className="h-3 w-3" /> Unban
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                                disabled={!!actionLoading}
                                onClick={() => performAction(user.id, "ban")}
                              >
                                <Ban className="h-3 w-3" /> Ban
                              </Button>
                            )}
                            {user.isAdmin ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-xs"
                                disabled={!!actionLoading}
                                onClick={() => performAction(user.id, "removeAdmin")}
                              >
                                <ShieldOff className="h-3 w-3" /> Remove Admin
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-xs"
                                disabled={!!actionLoading}
                                onClick={() => performAction(user.id, "makeAdmin")}
                              >
                                <ShieldCheck className="h-3 w-3" /> Make Admin
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                              disabled={!!actionLoading}
                              onClick={() => {
                                if (confirm(`Delete ${user.name}? This cannot be undone.`)) {
                                  performAction(user.id, "delete")
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
