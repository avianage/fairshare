"use client"

import { useRouter, usePathname } from "next/navigation"
import { ShieldAlert, ChevronLeft, ChevronRight, Filter, X, Download } from "lucide-react"
import { cn } from "@/lib/utils"

interface AuditEntry {
  id: string
  action: string
  targetId: string | null
  meta: unknown
  ip: string | null
  suspicious: boolean
  createdAt: string
  actor: { id: string; name: string; email: string } | null
}

interface Props {
  logs: AuditEntry[]
  total: number
  page: number
  totalPages: number
  currentAction?: string
  showingSuspicious: boolean
}

function actionBadgeClass(action: string) {
  if (action.startsWith("admin.")) return "bg-purple-500/10 text-purple-700 dark:text-purple-400"
  if (action.startsWith("login.failure")) return "bg-red-500/10 text-red-700 dark:text-red-400"
  if (action.startsWith("login.")) return "bg-green-500/10 text-green-700 dark:text-green-400"
  if (action.includes("delete")) return "bg-orange-500/10 text-orange-700 dark:text-orange-400"
  if (action.includes("expense") || action.includes("settlement")) return "bg-blue-500/10 text-blue-700 dark:text-blue-400"
  return "bg-muted text-muted-foreground"
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString()
}

export function AuditLogTable({ logs, total, page, totalPages, currentAction, showingSuspicious }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function buildUrl(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams()
    if (params.page && params.page !== "1") sp.set("page", params.page)
    if (params.action) sp.set("action", params.action)
    if (params.suspicious === "true") sp.set("suspicious", "true")
    const q = sp.toString()
    return q ? `${pathname}?${q}` : pathname
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
            <Filter className="h-3.5 w-3.5" />
            <span>Filter:</span>
          </div>
          {showingSuspicious ? (
            <button
              onClick={() => router.push(buildUrl({ action: currentAction }))}
              className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
            >
              Suspicious only
              <X className="h-3 w-3" />
            </button>
          ) : (
            <button
              onClick={() => router.push(buildUrl({ suspicious: "true", action: currentAction }))}
              className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
            >
              Suspicious only
            </button>
          )}
          {["login", "expense", "settlement", "admin", "friend", "group"].map((prefix) => (
            currentAction === prefix ? (
              <button
                key={prefix}
                onClick={() => router.push(buildUrl({ suspicious: showingSuspicious ? "true" : undefined }))}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                {prefix}
                <X className="h-3 w-3" />
              </button>
            ) : (
              <button
                key={prefix}
                onClick={() => router.push(buildUrl({ action: prefix, suspicious: showingSuspicious ? "true" : undefined }))}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
              >
                {prefix}
              </button>
            )
          ))}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-muted-foreground border-t pt-2.5 sm:border-t-0 sm:pt-0">
          <span>{total} entries</span>
          <a
            href={`/api/admin/audit/export${(() => { const sp = new URLSearchParams(); if (currentAction) sp.set("action", currentAction); if (showingSuspicious) sp.set("suspicious", "true"); const q = sp.toString(); return q ? `?${q}` : ""; })()}`}
            download
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV</span>
          </a>
        </div>
      </div>

      {/* Table & Cards */}
      {logs.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          No audit log entries found.
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Target / Meta</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className={log.suspicious ? "bg-destructive/5" : "hover:bg-muted/30"}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        {log.suspicious && <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0" />}
                        {relativeTime(log.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {log.actor ? (
                        <div>
                          <p className="font-medium">{log.actor.name}</p>
                          <p className="text-xs text-muted-foreground">{log.actor.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">anonymous</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${actionBadgeClass(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {log.targetId && (
                        <p 
                          title={log.targetId} 
                          className="font-mono text-[11px] break-all select-all max-w-[250px] lg:max-w-[350px] text-foreground/80 hover:text-foreground transition-colors"
                        >
                          {log.targetId}
                        </p>
                      )}
                      {log.meta != null && Object.keys(log.meta as Record<string, unknown>).length > 0 && (
                        <p 
                          title={JSON.stringify(log.meta, null, 2)} 
                          className="font-mono text-[11px] break-all max-w-[250px] lg:max-w-[350px] cursor-help hover:text-foreground transition-colors mt-0.5"
                        >
                          {JSON.stringify(log.meta)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      {log.ip ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className={cn(
                  "rounded-xl border p-4 text-sm space-y-3 transition-colors",
                  log.suspicious ? "bg-destructive/5 border-destructive/20" : "bg-card hover:bg-muted/10"
                )}
              >
                {/* Header of card: Actor & Time */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {log.actor ? (
                      <div>
                        <p className="font-medium text-foreground truncate">{log.actor.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{log.actor.email}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">anonymous</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 mt-0.5">
                    {log.suspicious && <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0" />}
                    <span>{relativeTime(log.createdAt)}</span>
                  </div>
                </div>

                {/* Action and details */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", actionBadgeClass(log.action))}>
                    {log.action}
                  </span>
                  {log.ip && (
                    <span className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                      {log.ip}
                    </span>
                  )}
                </div>

                {/* Target/Meta details if present */}
                {(log.targetId || (log.meta != null && Object.keys(log.meta as Record<string, unknown>).length > 0)) && (
                  <div className="rounded-lg bg-muted/30 p-2.5 text-xs space-y-1.5 font-mono text-muted-foreground break-all">
                    {log.targetId && (
                      <div>
                        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block font-semibold mb-0.5">Target ID</span>
                        <p className="text-[11px] select-all">{log.targetId}</p>
                      </div>
                    )}
                    {log.meta != null && Object.keys(log.meta as Record<string, unknown>).length > 0 && (
                      <div>
                        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block font-semibold mb-0.5">Meta</span>
                        <pre className="whitespace-pre-wrap text-[11px] font-mono leading-relaxed">{JSON.stringify(log.meta, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => router.push(buildUrl({ page: String(page - 1), action: currentAction, suspicious: showingSuspicious ? "true" : undefined }))}
              className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => router.push(buildUrl({ page: String(page + 1), action: currentAction, suspicious: showingSuspicious ? "true" : undefined }))}
              className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
