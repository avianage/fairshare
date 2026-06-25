"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Filter, Download } from "lucide-react"
import { format } from "date-fns"
import { categoryMeta } from "@/lib/categories"
import { formatINR, formatExpenseDate } from "@/lib/format"
import { DatePicker } from "@/components/ui/date-picker"
import { NativeSelect } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import type { StatementItem } from "@/app/api/statement/route"

type Group = { id: string; name: string; deleted?: boolean }

const PAGE_SIZE = 50

function groupByDate(items: StatementItem[]): { label: string; items: StatementItem[] }[] {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const groups = new Map<string, StatementItem[]>()
  for (const item of items) {
    const d = new Date(item.date); d.setHours(0, 0, 0, 0)
    const label =
      d.getTime() === today.getTime() ? "Today" :
      d.getTime() === yesterday.getTime() ? "Yesterday" :
      format(d, "d MMM yyyy")
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(item)
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }))
}

function SkeletonRow() {
  return (
    <div className="flex gap-4 items-start px-5 py-4">
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="space-y-2 pt-1">
        <Skeleton className="h-3.5 w-16 ml-auto" />
        <Skeleton className="h-3 w-10 ml-auto" />
      </div>
    </div>
  )
}

export function StatementTable({ groups }: { groups: Group[] }) {
  const [items, setItems] = useState<StatementItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [csvLoading, setCsvLoading] = useState(false)
  const [xlsxLoading, setXlsxLoading] = useState(false)

  const [type, setType] = useState<"" | "expense" | "settlement">("")
  const [groupId, setGroupId] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const fetch_ = useCallback(async (p: number) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (type) params.set("type", type)
    if (groupId) params.set("groupId", groupId)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    const res = await fetch(`/api/statement?${params}`, { cache: "no-store" })
    if (res.ok) {
      const data = await res.json()
      setItems(data.items)
      setTotal(data.total)
    }
    setLoading(false)
  }, [type, groupId, from, to])

  useEffect(() => {
    setPage(1)
    fetch_(1)
  }, [fetch_])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function goTo(p: number) {
    setPage(p)
    fetch_(p)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function downloadExport(format: "csv" | "xlsx", filename: string) {
    const setter = format === "csv" ? setCsvLoading : setXlsxLoading
    setter(true)
    const params = new URLSearchParams({ format })
    if (type) params.set("type", type)
    if (groupId) params.set("groupId", groupId)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    const res = await fetch(`/api/statement?${params}`)
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }
    setter(false)
  }

  async function downloadCSV() {
    await downloadExport("csv", "fairshare-statement.csv")
  }

  async function downloadXLSX() {
    await downloadExport("xlsx", "fairshare-statement.xlsx")
  }

  const grouped = groupByDate(items)

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center rounded-xl border bg-card/65 p-3">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <NativeSelect
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          aria-label="Transaction type"
        >
          <option value="">All types</option>
          <option value="expense">Expenses</option>
          <option value="settlement">Settlements</option>
        </NativeSelect>
        <NativeSelect
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          aria-label="Group"
          renderOption={(opt) => {
            const g = groups.find((g) => g.id === opt.value)
            if (!g?.deleted) return opt.label
            return (
              <span>
                {g.name} <span className="text-destructive">(deleted)</span>
              </span>
            )
          }}
        >
          <option value="">All groups</option>
          <option value="direct">Direct</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </NativeSelect>
        <DatePicker
          value={from}
          max={to || undefined}
          onChange={setFrom}
          placeholder="From date"
          aria-label="From date"
          className="h-9 text-sm"
        />
        <DatePicker
          value={to}
          min={from || undefined}
          onChange={setTo}
          placeholder="To date"
          aria-label="To date"
          className="h-9 text-sm"
        />
        <div className="ml-auto flex items-center gap-2">
          {(type || groupId || from || to) && (
            <button
              type="button"
              onClick={() => { setType(""); setGroupId(""); setFrom(""); setTo("") }}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Clear
            </button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={downloadCSV}
            disabled={csvLoading}
            className="h-8 gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            {csvLoading ? "Exporting…" : "CSV"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadXLSX}
            disabled={xlsxLoading}
            className="h-8 gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            {xlsxLoading ? "Exporting…" : "Excel"}
          </Button>
        </div>
      </div>

      {/* Total count */}
      <p className="text-xs text-muted-foreground px-1">
        {loading ? "Loading…" : `${total} transaction${total === 1 ? "" : "s"}`}
      </p>

      {/* Skeleton */}
      {loading && (
        <div className="rounded-xl border bg-card/65 backdrop-blur-md shadow-sm overflow-hidden">
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <p className="text-sm font-medium">No transactions found</p>
          <p className="mt-1 text-xs text-muted-foreground">Try adjusting your filters.</p>
        </div>
      )}

      {/* Grouped list */}
      {!loading && grouped.length > 0 && (
        <div className="space-y-4">
          {grouped.map(({ label, items: groupItems }) => (
            <div key={label}>
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <div className="rounded-xl border bg-card/65 backdrop-blur-md shadow-sm overflow-hidden">
                <ul className="divide-y">
                  {groupItems.map((a) => {
                    const isSettlement = a.type === "settlement"
                    const names = a.involvedUsers.map((u) => u.name)
                    const unique = [...new Set(names)]
                    const who = unique.length > 3
                      ? `${unique.slice(0, 3).join(", ")} +${unique.length - 3}`
                      : unique.join(", ")

                    const row = (
                      <div className="flex gap-4 items-start px-5 py-4 group hover:bg-accent/30 transition-colors">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base shadow-sm transition-transform duration-200 group-hover:scale-110 ${
                          isSettlement
                            ? "bg-success/15 border border-success/30 text-success"
                            : "bg-primary/10 border border-primary/20 text-primary"
                        }`}>
                          {isSettlement ? "💸" : categoryMeta(a.category ?? "OTHER").icon}
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="truncate text-sm font-semibold tracking-tight">{a.description}</p>
                          <p className="truncate text-xs text-muted-foreground mt-0.5">
                            <span className="font-medium text-foreground/80">
                              {a.groupName ?? "Direct"}
                            </span>{" "}
                            · {who}
                          </p>
                        </div>
                        <div className="shrink-0 text-right pt-0.5">
                          <p className={`text-sm font-bold tabular-nums ${isSettlement ? "text-success" : "text-foreground"}`}>
                            {formatINR(a.amount)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatExpenseDate(a.date)}
                          </p>
                        </div>
                      </div>
                    )

                    return (
                      <li key={`${a.type}-${a.id}`}>
                        {a.type === "expense"
                          ? <Link href={`/expenses/${a.id}`}>{row}</Link>
                          : row}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card disabled:opacity-40 hover:bg-accent transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => goTo(page + 1)}
            disabled={page === totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card disabled:opacity-40 hover:bg-accent transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
