/**
 * Extract a user-friendly error message from a non-ok API response.
 * Handles 429 rate-limit responses explicitly so users understand why
 * their action failed rather than seeing a generic error.
 */
export async function getApiError(res: Response, fallback: string): Promise<string> {
  if (res.status === 429) {
    const data = await res.json().catch(() => null)
    const sec: number | undefined = data?.retryAfter
    return sec
      ? `Too many requests — please try again in ${sec}s.`
      : "Too many requests — please slow down and try again."
  }
  const data = await res.json().catch(() => null)
  return data?.error ?? fallback
}
