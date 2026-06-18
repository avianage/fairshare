"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getApiError } from "@/lib/api-error"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { formatINR } from "@/lib/format"

/**
 * Settles the current user's outstanding direct balance with `toUserId`.
 * Only shown when the current user owes the other person.
 */
export function DirectSettleButton({
  toUserId,
  toName,
  amount,
}: {
  toUserId: string
  toName: string
  amount: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function settle() {
    setBusy(true)
    try {
      const res = await fetch("/api/direct-settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId, amount }),
      })
      if (!res.ok) {
        toast.error(await getApiError(res, "Could not record the settlement."))
        setBusy(false)
        return
      }
      toast.success(`Settled ${formatINR(amount)} with ${toName}.`)
      setOpen(false)
      setBusy(false)
      router.refresh()
    } catch {
      toast.error("Something went wrong.")
      setBusy(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Settle up {formatINR(amount)}</Button>
      <ConfirmDialog
        open={open}
        title={`Settle up with ${toName}?`}
        description={`This records that you paid ${toName} ${formatINR(amount)}.`}
        confirmLabel={`Pay ${formatINR(amount)}`}
        busy={busy}
        onConfirm={settle}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}
