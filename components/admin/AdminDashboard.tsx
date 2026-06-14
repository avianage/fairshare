"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ShieldCheck,
  Ban,
  Trash2,
  UserCheck,
  ShieldOff,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Pencil,
  Users,
} from "lucide-react"

type GroupMembership = {
  role: string
  group: { id: string; name: string; emoji: string | null }
}

type AdminUser = {
  id: string
  name: string
  username: string | null
  email: string
  isAdmin: boolean
  isBanned: boolean
  createdAt: string
  memberships: GroupMembership[]
  _count: { expensesPaid: number }
}

function UserEditModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(user.name)
  const [username, setUsername] = useState(user.username ?? "")
  const [email, setEmail] = useState(user.email)
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateProfile",
        userId: user.id,
        name: name.trim(),
        username: username.trim() || undefined,
        email: email.trim(),
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? "Update failed")
      return
    }
    toast.success("User updated")
    onSaved()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b px-4 py-3">
          <h2 className="flex-1 font-semibold">Edit user</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-username">Username</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground text-sm">@</span>
              <Input
                id="edit-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-7"
                placeholder="optional"
                maxLength={20}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function GroupsPanel({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b px-4 py-3">
          <h2 className="flex-1 font-semibold">{user.name}&apos;s groups</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">
          {user.memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not in any groups.</p>
          ) : (
            <ul className="space-y-2">
              {user.memberships.map(({ group, role }) => (
                <li key={group.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <span className="text-xl">{group.emoji ?? "👥"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-sm">{group.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{role.toLowerCase()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export function AdminDashboard({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [groupsUser, setGroupsUser] = useState<AdminUser | null>(null)

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
    <>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <span>Users ({total})</span>
            <form onSubmit={handleSearch} className="flex w-full sm:w-auto gap-2">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, username…"
                  className="pl-8 w-full sm:w-56 text-sm"
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
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
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
                            {user.username ? `@${user.username}` : <span className="italic text-xs">none</span>}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setGroupsUser(user)}
                              className="flex items-center gap-1 text-sm hover:text-primary"
                            >
                              <Users className="h-3.5 w-3.5" />
                              {user.memberships.length}
                            </button>
                          </td>
                          <td className="px-4 py-3">{user._count.expensesPaid}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString("en-IN", {
                              year: "numeric", month: "short", day: "numeric",
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
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-xs"
                                onClick={() => setEditingUser(user)}
                              >
                                <Pencil className="h-3 w-3" /> Edit
                              </Button>
                              {!isSelf && (
                                <>
                                  {user.isBanned ? (
                                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={!!actionLoading} onClick={() => performAction(user.id, "unban")}>
                                      <UserCheck className="h-3 w-3" /> Unban
                                    </Button>
                                  ) : (
                                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" disabled={!!actionLoading} onClick={() => performAction(user.id, "ban")}>
                                      <Ban className="h-3 w-3" /> Ban
                                    </Button>
                                  )}
                                  {user.isAdmin ? (
                                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={!!actionLoading} onClick={() => performAction(user.id, "removeAdmin")}>
                                      <ShieldOff className="h-3 w-3" /> Demote
                                    </Button>
                                  ) : (
                                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={!!actionLoading} onClick={() => performAction(user.id, "makeAdmin")}>
                                      <ShieldCheck className="h-3 w-3" /> Promote
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
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {users.map((user) => {
                  const isSelf = user.id === currentUserId
                  return (
                    <div key={user.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          {user.username && (
                            <p className="text-xs text-muted-foreground">@{user.username}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 shrink-0">
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
                        </div>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <button type="button" onClick={() => setGroupsUser(user)} className="flex items-center gap-1 hover:text-foreground">
                          <Users className="h-3.5 w-3.5" /> {user.memberships.length} groups
                        </button>
                        <span>{user._count.expensesPaid} expenses</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setEditingUser(user)}>
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                        {!isSelf && (
                          <>
                            {user.isBanned ? (
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={!!actionLoading} onClick={() => performAction(user.id, "unban")}>
                                <UserCheck className="h-3 w-3" /> Unban
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-destructive" disabled={!!actionLoading} onClick={() => performAction(user.id, "ban")}>
                                <Ban className="h-3 w-3" /> Ban
                              </Button>
                            )}
                            {user.isAdmin ? (
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={!!actionLoading} onClick={() => performAction(user.id, "removeAdmin")}>
                                <ShieldOff className="h-3 w-3" /> Demote
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={!!actionLoading} onClick={() => performAction(user.id, "makeAdmin")}>
                                <ShieldCheck className="h-3 w-3" /> Promote
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-destructive"
                              disabled={!!actionLoading}
                              onClick={() => {
                                if (confirm(`Delete ${user.name}? This cannot be undone.`)) {
                                  performAction(user.id, "delete")
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {editingUser && (
        <UserEditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={fetchUsers}
        />
      )}

      {groupsUser && (
        <GroupsPanel
          user={groupsUser}
          onClose={() => setGroupsUser(null)}
        />
      )}
    </>
  )
}
