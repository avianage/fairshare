import { useEffect, useState } from "react"

/** Ticks down from `seconds` to 0, one second at a time. Pass `null` to disable. */
export function useCountdown(seconds: number | null): number | null {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => setRemaining(seconds), [seconds])

  useEffect(() => {
    if (!remaining || remaining <= 0) return
    const timer = setTimeout(() => setRemaining((r) => (r ? r - 1 : 0)), 1000)
    return () => clearTimeout(timer)
  }, [remaining])

  return remaining
}

export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}
