"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"

export type SearchUser = { id: string; name: string; avatar: string | null }

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

/**
 * Debounced (300ms) user search backed by /api/users/search.
 * Surfaces friends, group co-members, and prior direct expense participants.
 * When showSuggestions is true, shows friends as pre-populated options before the user types.
 */
export function UserSearch({
  selected,
  onChange,
  multi = true,
  excludeIds = [],
  showSuggestions = false,
}: {
  selected: SearchUser[]
  onChange: (users: SearchUser[]) => void
  multi?: boolean
  excludeIds?: string[]
  showSuggestions?: boolean
}) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<SearchUser[]>([])
  const [suggestions, setSuggestions] = useState<SearchUser[]>([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Load friend suggestions on mount
  useEffect(() => {
    if (!showSuggestions) return
    fetch("/api/users/search?q=")
      .then((r) => r.json())
      .then((d) => setSuggestions(d.users ?? []))
      .catch(() => {})
  }, [showSuggestions])

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

  // When typing: show search results. When not typing but focused with suggestions: show friends.
  const query = q.trim()
  const activeList = query.length > 0 ? results : suggestions
  const visible = activeList.filter((u) => !exclude.has(u.id))
  const showDropdown = focused && (query.length > 0 || (showSuggestions && visible.length > 0))

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
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search friends by name…"
            autoComplete="off"
          />
          {showDropdown && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
              {loading ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
              ) : visible.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No matches among your friends or shared groups.
                </p>
              ) : (
                <>
                  {query.length === 0 && showSuggestions && (
                    <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">Friends</p>
                  )}
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
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
