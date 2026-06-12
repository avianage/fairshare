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
