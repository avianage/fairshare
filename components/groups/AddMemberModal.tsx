"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { X, UserPlus, Copy, Link } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function AddMemberModal({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

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

  function handleClose() {
    setOpen(false)
    setInviteUrl(null)
    setCopied(false)
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
          onClick={handleClose}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <h2 className="flex-1 font-semibold">Add member</h2>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                Share the link below — anyone with it can join this group. The link expires after 7 days.
              </div>

              {!inviteUrl ? (
                <Button
                  type="button"
                  onClick={generateInvite}
                  disabled={generating}
                  className="w-full gap-2"
                >
                  <Link className="h-4 w-4" />
                  {generating ? "Generating…" : "Generate invite link"}
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={inviteUrl}
                      onFocus={(e) => e.target.select()}
                      className="flex-1 text-xs"
                    />
                    <Button type="button" variant="secondary" onClick={copyInvite} className="shrink-0">
                      {copied ? "Copied!" : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={generateInvite}
                    disabled={generating}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Generate a new link
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
