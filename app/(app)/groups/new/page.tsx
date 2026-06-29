"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD"]

export default function NewGroupPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("")
  const [description, setDescription] = useState("")
  const [currency, setCurrency] = useState("INR")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          emoji: emoji.trim() || undefined,
          description: description.trim() || undefined,
          currency,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? "Could not create group. Please try again.")
        setSubmitting(false)
        return
      }

      const { group } = await res.json()
      router.refresh()
      router.push(`/groups/${group.id}?welcome=1`)
    } catch {
      setError("Something went wrong. Please try again.")
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/groups"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to groups
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">New group</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Goa Trip"
            minLength={2}
            maxLength={50}
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emoji">Emoji</Label>
            <Input
              id="emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="🏖️"
              className="text-center text-lg"
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <NativeSelect
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Weekend getaway expenses"
            maxLength={500}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting || name.trim().length < 2}>
            {submitting ? "Creating…" : "Create group"}
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link href="/groups">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
