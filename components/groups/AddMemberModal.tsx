"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { X, UserPlus, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AddMemberModal({ groupId }: { groupId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [adding, setAdding] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  // Disable background scrolling when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  async function handleAddEmail(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setAdding(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error ?? "Could not add member.")
      } else {
        toast.success(`Added ${data.member?.name ?? trimmed} to the group.`)
        setEmail("")
        setOpen(false)
        router.refresh()
      }
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setAdding(false)
    }
  }

  async function generateInvite() {
    setCopied(false)
    setGenerating(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/invite`, { method: "POST" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error ?? "Could not generate invite link.")
      } else {
        setInviteUrl(data.inviteUrl)
        toast.success("Invite link generated.")
      }
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setGenerating(false)
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success("Link copied to clipboard.")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy link.")
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Add
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-[450px] max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <h2 className="flex-1 font-semibold">Add new member</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Form 1: Add by email */}
              <form onSubmit={handleAddEmail} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="modal-member-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add by email</Label>
                  <p className="text-xs text-muted-foreground">
                    They must already have a Fairshare account.
                  </p>
                  <Input
                    id="modal-member-email"
                    type="email"
                    inputMode="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-background/50 focus:bg-background transition-colors"
                  />
                </div>
                <Button type="submit" disabled={adding || !email.trim()} className="w-full">
                  {adding ? "Adding..." : "Add member"}
                </Button>
              </form>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink mx-3 text-xs text-muted-foreground uppercase tracking-widest font-semibold">or</span>
                <div className="flex-grow border-t border-border"></div>
              </div>

              {/* Form 2: Invite Link */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invite via link</Label>
                  <p className="text-xs text-muted-foreground">
                    Generate a link for them to join this group.
                  </p>
                </div>
                {!inviteUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateInvite}
                    disabled={generating}
                    className="w-full"
                  >
                    {generating ? "Generating..." : "Generate invite link"}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={inviteUrl}
                      onFocus={(e) => e.target.select()}
                      className="flex-1 text-xs"
                    />
                    <Button type="button" variant="secondary" onClick={copyInvite} className="shrink-0">
                      {copied ? "Copied" : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
