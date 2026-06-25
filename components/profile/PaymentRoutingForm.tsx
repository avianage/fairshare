"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function PaymentRoutingForm({ initialValue }: { initialValue: boolean }) {
  const [enabled, setEnabled] = useState(initialValue)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    const next = !enabled
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowPaymentRouting: next }),
      })
      if (!res.ok) { toast.error("Could not save setting."); return }
      setEnabled(next)
      toast.success(next ? "Smart payment routing enabled." : "Smart payment routing disabled.")
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment preferences</CardTitle>
        <CardDescription>Control how others can settle debts through you.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border bg-muted/40 p-4 text-sm space-y-2">
          <p className="font-medium">How smart payment routing works</p>
          <p className="text-muted-foreground leading-relaxed">
            When someone owes a mutual friend who in turn owes you, the app can suggest they pay you directly — skipping the middle step entirely.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Example:</span> Alice owes Bob ₹500, and Bob owes you ₹500. Normally that&apos;s 2 payments. With routing on, the app suggests Alice pays you directly — just 1 payment, and Bob&apos;s debt cancels out automatically.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Turn this <span className="font-medium text-foreground">off</span> if you prefer all payments to come only from people you&apos;ve personally split expenses with.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">Allow smart payment routing</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {enabled ? "Others may be routed to pay you directly." : "Only direct counterparties will pay you."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={saving}
            onClick={toggle}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
              enabled ? "bg-primary" : "bg-input"
            }`}
          >
            <span
              className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
