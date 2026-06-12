"use client"

import { useState } from "react"
import { Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { SearchUser } from "@/components/fab/UserSearch"

export type ParsedExpense = {
  description: string | null
  amount: number | null
  payerId: string | null
  participantIds: string[]
  date: string | null
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES"
  confidence: "high" | "medium" | "low"
}

/**
 * Natural-language expense entry. Sends free text to /api/expenses/parse and
 * hands the structured result (plus resolved participant names) to the parent,
 * which prefills the editable form. The form stays fully editable afterward.
 */
export function NLPExpenseInput({
  onParsed,
}: {
  onParsed: (parsed: ParsedExpense, participants: SearchUser[]) => void
}) {
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function parse() {
    const value = text.trim()
    if (!value || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/expenses/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      })
      if (!res.ok) {
        setError("Couldn't understand that — fill in manually.")
        setLoading(false)
        return
      }
      const data = await res.json()
      const participants: SearchUser[] = (data.matchedParticipants ?? []).map(
        (p: { id: string; name: string }) => ({
          id: p.id,
          name: p.name,
          avatar: null,
        })
      )
      onParsed(data.parsed as ParsedExpense, participants)
    } catch {
      setError("Couldn't understand that — fill in manually.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1.5 rounded-xl border bg-accent/30 p-3">
      <div className="flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              parse()
            }
          }}
          placeholder="e.g. paid 500 for dinner with Rahul"
          disabled={loading}
        />
        <Button type="button" onClick={parse} disabled={loading || !text.trim()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="mr-1 h-4 w-4" /> Parse
            </>
          )}
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Type it naturally and we&apos;ll fill in the form — you can edit anything after.
        </p>
      )}
    </div>
  )
}
