"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"

export type SearchUser = { id: string; name: string; avatar: string | null }

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

/**
 * Debounced (300ms) user search backed by /api/users/search. Only surfaces
 * people the caller already shares a group or direct expense with.
 */
export function UserSearch({
  selected,
  onChange,
  multi = true,
  excludeIds = [],
}: {
  selected: SearchUser[]
  onChange: (users: SearchUser[]) => void
  multi?: boolean
  excludeIds?: string[]
}) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<SearchUser[]>([])
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    const query = q.trim()
    if (query.length === 0) {
      setResults([])
      return
    }
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
        const data = await res.json().catch(() => ({ users: [] }))
        setResults(data.users ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => debounce.current && clearTimeout(debounce.current)
  }, [q])

  const exclude = new Set([...excludeIds, ...selected.map((s) => s.id)])
  const visible = results.filter((u) => !exclude.has(u.id))

  function add(u: SearchUser) {
    onChange(multi ? [...selected, u] : [u])
    setQ("")
    setResults([])
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s.id !== id))
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-xs font-medium text-accent-foreground"
            >
              {u.name}
              <button type="button" onClick={() => remove(u.id)} aria-label={`Remove ${u.name}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {(multi || selected.length === 0) && (
        <div className="relative">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            autoComplete="off"
          />
          {q.trim() && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
              {loading ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
              ) : visible.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No matches. You can only add people you share a group or expense with.
                </p>
              ) : (
                <ul className="max-h-56 overflow-y-auto">
                  {visible.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => add(u)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {initials(u.name)}
                        </span>
                        {u.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
