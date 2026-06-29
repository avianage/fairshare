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
  Crown,
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
  isOwner: boolean
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

type ConfirmState = {
  title: string
  message: string
  variant: "destructive" | "warning" | "default"
  onConfirm: () => void
} | null

export function AdminDashboard({ currentUserId, currentUserIsOwner }: { currentUserId: string; currentUserIsOwner: boolean }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [groupsUser, setGroupsUser] = useState<AdminUser | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

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

  const ACTION_META: Record<string, { title: string; message: (name: string) => string; variant: "destructive" | "warning" | "default" }> = {
    ban: {
      title: "Ban user",
      message: (name) => `Ban ${name}? They will immediately lose access to all protected pages.`,
      variant: "destructive",
    },
    unban: {
      title: "Unban user",
      message: (name) => `Unban ${name}? They will regain full access to the platform.`,
      variant: "default",
    },
    makeAdmin: {
      title: "Promote to admin",
      message: (name) => `Promote ${name} to admin? They will have full administrative access including the ability to ban and delete users.`,
      variant: "warning",
    },
    removeAdmin: {
      title: "Remove admin access",
      message: (name) => `Remove admin access from ${name}? They will revert to a regular user.`,
      variant: "warning",
    },
  }

  function confirmThenAction(userId: string, action: string, name: string) {
    const meta = ACTION_META[action]
    if (!meta) { performAction(userId, action); return }
    setConfirmState({
      title: meta.title,
      message: meta.message(name),
      variant: meta.variant,
      onConfirm: () => { setConfirmState(null); performAction(userId, action) },
    })
  }

  function confirmDelete(userId: string, name: string) {
    setConfirmState({
      title: "Delete user",
      message: `Permanently delete ${name}? This will remove all their data including expenses and group memberships. This cannot be undone.`,
      variant: "destructive",
      onConfirm: () => { setConfirmState(null); performAction(userId, "delete") },
    })
  }

  function confirmTransferOwnership(userId: string, name: string) {
    setConfirmState({
      title: "Transfer ownership",
      message: `Transfer ownership to ${name}? You will permanently lose owner privileges. This action cannot be reversed.`,
      variant: "destructive",
      onConfirm: () => { setConfirmState(null); performAction(userId, "transferOwnership") },
    })
  }

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
      <Card className="bg-card/65 backdrop-blur-md border border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 border-b bg-muted/5">
          <CardTitle className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-lg font-bold tracking-tight">System Users ({total})</span>
            <form onSubmit={handleSearch} className="flex w-full sm:w-auto gap-2">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, username…"
                  className="pl-8 w-full sm:w-56 text-sm bg-background/40"
                />
              </div>
              <Button type="submit" size="sm" variant="outline" className="transition-all duration-200 active:scale-95">Search</Button>
            </form>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground animate-pulse">Loading…</p>
          ) : users.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No users found.</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground bg-muted/20 font-semibold">
                      <th className="px-4 py-3 text-left font-semibold">User</th>
                      <th className="px-4 py-3 text-left font-semibold">Username</th>
                      <th className="px-4 py-3 text-left font-semibold">Groups</th>
                      <th className="px-4 py-3 text-left font-semibold">Expenses</th>
                      <th className="px-4 py-3 text-left font-semibold">Joined</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const isSelf = user.id === currentUserId
                      return (
                        <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors duration-150">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground font-medium">
                            {user.username ? `@${user.username}` : <span className="italic text-xs opacity-60">none</span>}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setGroupsUser(user)}
                              className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors font-medium"
                            >
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              {user.memberships.length}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-medium">{user._count.expensesPaid}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString("en-IN", {
                              year: "numeric", month: "short", day: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {user.isOwner && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-semibold text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 shadow-sm">
                                  <Crown className="h-3 w-3" /> Owner
                                </span>
                              )}
                              {user.isAdmin && !user.isOwner && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary border border-primary/20 shadow-sm">
                                  <ShieldCheck className="h-3 w-3" /> Admin
                                </span>
                              )}
                              {user.isBanned && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive border border-destructive/20 shadow-sm">
                                  <Ban className="h-3 w-3" /> Banned
                                </span>
                              )}
                              {!user.isAdmin && !user.isOwner && !user.isBanned && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success border border-success/20 shadow-sm">
                                  Active
                                </span>
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
                              {!isSelf && !user.isOwner && (
                                <>
                                  {user.isBanned ? (
                                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={!!actionLoading} onClick={() => confirmThenAction(user.id, "unban", user.name)}>
                                      <UserCheck className="h-3 w-3" /> Unban
                                    </Button>
                                  ) : (
                                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" disabled={!!actionLoading} onClick={() => confirmThenAction(user.id, "ban", user.name)}>
                                      <Ban className="h-3 w-3" /> Ban
                                    </Button>
                                  )}
                                  {currentUserIsOwner && (
                                    user.isAdmin ? (
                                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={!!actionLoading} onClick={() => confirmThenAction(user.id, "removeAdmin", user.name)}>
                                        <ShieldOff className="h-3 w-3" /> Demote
                                      </Button>
                                    ) : (
                                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={!!actionLoading} onClick={() => confirmThenAction(user.id, "makeAdmin", user.name)}>
                                        <ShieldCheck className="h-3 w-3" /> Promote
                                      </Button>
                                    )
                                  )}
                                  {currentUserIsOwner && (
                                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-600" disabled={!!actionLoading}
                                      onClick={() => confirmTransferOwnership(user.id, user.name)}>
                                      <Crown className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                                    disabled={!!actionLoading}
                                    onClick={() => confirmDelete(user.id, user.name)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                              {!isSelf && user.isOwner && (
                                <span className="text-xs text-muted-foreground italic px-2 py-1">Protected</span>
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
                          {user.isOwner && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                              <Crown className="h-3 w-3" /> Owner
                            </span>
                          )}
                          {user.isAdmin && !user.isOwner && (
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
                        {!isSelf && !user.isOwner && (
                          <>
                            {user.isBanned ? (
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={!!actionLoading} onClick={() => confirmThenAction(user.id, "unban", user.name)}>
                                <UserCheck className="h-3 w-3" /> Unban
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-destructive" disabled={!!actionLoading} onClick={() => confirmThenAction(user.id, "ban", user.name)}>
                                <Ban className="h-3 w-3" /> Ban
                              </Button>
                            )}
                            {currentUserIsOwner && (
                              user.isAdmin ? (
                                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={!!actionLoading} onClick={() => confirmThenAction(user.id, "removeAdmin", user.name)}>
                                  <ShieldOff className="h-3 w-3" /> Demote
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={!!actionLoading} onClick={() => confirmThenAction(user.id, "makeAdmin", user.name)}>
                                  <ShieldCheck className="h-3 w-3" /> Promote
                                </Button>
                              )
                            )}
                            {currentUserIsOwner && (
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-yellow-600 dark:text-yellow-400" disabled={!!actionLoading}
                                onClick={() => confirmTransferOwnership(user.id, user.name)}>
                                <Crown className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-destructive"
                              disabled={!!actionLoading}
                              onClick={() => confirmDelete(user.id, user.name)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {!isSelf && user.isOwner && (
                          <span className="text-xs text-muted-foreground italic">Protected</span>
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

      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmState(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl">
            {/* Top accent bar */}
            <div className={`h-1 w-full rounded-t-2xl ${confirmState.variant === "destructive" ? "bg-destructive" : confirmState.variant === "warning" ? "bg-amber-500" : "bg-primary"}`} />
            <div className="p-6">
              {/* Icon + title */}
              <div className="flex items-start gap-4 mb-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  confirmState.variant === "destructive" ? "bg-destructive/10 text-destructive" :
                  confirmState.variant === "warning" ? "bg-amber-500/10 text-amber-500" :
                  "bg-primary/10 text-primary"
                }`}>
                  {confirmState.variant === "destructive" ? (
                    <Trash2 className="h-5 w-5" />
                  ) : confirmState.variant === "warning" ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : (
                    <UserCheck className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-semibold leading-none mb-1">{confirmState.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{confirmState.message}</p>
                </div>
              </div>
              {/* Actions */}
              <div className="flex items-center justify-end gap-2 mt-6">
                <Button variant="outline" size="sm" onClick={() => setConfirmState(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant={confirmState.variant === "destructive" ? "destructive" : "default"}
                  className={confirmState.variant === "warning" ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
                  onClick={confirmState.onConfirm}
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
