"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"]
const MAX_BYTES = 5 * 1024 * 1024

export function ReceiptManager({
  groupId,
  expenseId,
  receiptUrl,
  canManage,
}: {
  groupId: string
  expenseId: string
  receiptUrl: string | null
  canManage: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const base = `/api/groups/${groupId}/expenses/${expenseId}/receipt`

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-selecting the same file later
    if (!file) return

    // Client-side guards (server re-validates by magic bytes regardless).
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Only JPEG, PNG, or WebP images are allowed.")
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error("That image is larger than 5MB.")
      return
    }

    setBusy(true)
    const form = new FormData()
    form.append("file", file)
    try {
      const res = await fetch(base, { method: "POST", body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? "Could not upload the receipt.")
        return
      }
      toast.success("Receipt uploaded.")
      router.refresh()
    } catch {
      toast.error("Something went wrong uploading the receipt.")
    } finally {
      setBusy(false)
    }
  }

  async function removeReceipt() {
    if (!confirm("Remove this receipt?")) return
    setBusy(true)
    try {
      const res = await fetch(base, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? "Could not remove the receipt.")
        return
      }
      toast.success("Receipt removed.")
      router.refresh()
    } catch {
      toast.error("Something went wrong removing the receipt.")
    } finally {
      setBusy(false)
    }
  }

  if (receiptUrl) {
    return (
      <div className="mt-3 flex items-center gap-3">
        <a
          href={receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block h-16 w-16 overflow-hidden rounded-md border bg-muted/50"
          title="View receipt"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={receiptUrl}
            alt="Receipt"
            className="h-full w-full object-cover"
          />
        </a>
        <div className="flex flex-col gap-1">
          <a
            href={receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            View receipt
          </a>
          {canManage && (
            <button
              type="button"
              onClick={removeReceipt}
              disabled={busy}
              className="text-left text-xs text-muted-foreground hover:text-destructive"
            >
              {busy ? "Removing…" : "Remove"}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!canManage) return null

  return (
    <div className="mt-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFile}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Uploading…" : "Add receipt"}
      </Button>
    </div>
  )
}
