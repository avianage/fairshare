/**
 * Shared display formatting. Currency defaults to Indian Rupees with the Indian
 * numbering system (1,00,000 not 100,000); relative time for activity rows.
 */

export function formatINR(amount: number): string {
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  })
}

export function formatMoney(amount: number, currency = "INR"): string {
  try {
    return amount.toLocaleString("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    })
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
]

/**
 * Formats an expense date with progressive relative time:
 * < 60 min  → "X mins ago"
 * < 24 h    → "X hours ago"
 * 1–6 days  → "X days ago"
 * older     → "20 Jun" (or "20 Jun 2024" for a different year)
 */
export function formatExpenseDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`

  return d.toLocaleDateString("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(d.getUTCFullYear() !== new Date().getUTCFullYear() ? { year: "numeric" } : {}),
  })
}

/** "2 hours ago", "yesterday", "in 3 days" — relative to now. */
export function formatRelativeTime(date: string | Date): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  let duration = (new Date(date).getTime() - Date.now()) / 1000 // seconds

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }
  return rtf.format(Math.round(duration), "year")
}
