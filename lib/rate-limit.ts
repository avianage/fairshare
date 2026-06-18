/**
 * In-memory sliding-window rate limiter, keyed by client IP + bucket name.
 *
 * Edge-safe (Map + Date.now only) and used from middleware. State is per
 * process instance — fine for a single-container Docker deployment. If you ever
 * run multiple replicas, move this to a shared store (Redis) since each replica
 * keeps its own counts.
 */

type Timestamps = number[]

const store = new Map<string, Timestamps>()

// Periodically drop stale keys so the Map can't grow unbounded. Pruning is done
// lazily (no setInterval — avoids Edge runtime concerns) on a time guard.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000
let lastSweep = Date.now()

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, ts] of store) {
    // A key is stale once its newest hit is older than an hour (our longest window).
    if (ts.length === 0 || ts[ts.length - 1] <= now - 60 * 60 * 1000) {
      store.delete(key)
    }
  }
}

export type RateLimitResult = {
  allowed: boolean
  /** Seconds until the caller may retry (0 when allowed). */
  retryAfter: number
  limit: number
  remaining: number
}

/**
 * Record a hit for `key` and report whether it's within `limit` over the
 * trailing `windowMs`. A rejected request is NOT counted (so a client hammering
 * the endpoint can't keep pushing its own window forward).
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const cutoff = now - windowMs
  const existing = store.get(key) ?? []

  // Drop timestamps outside the window (array is chronological).
  let firstFresh = 0
  while (firstFresh < existing.length && existing[firstFresh] <= cutoff) {
    firstFresh++
  }
  const recent = firstFresh > 0 ? existing.slice(firstFresh) : existing

  if (recent.length >= limit) {
    // Window full — retry once the oldest hit ages out.
    const retryAfter = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000))
    store.set(key, recent)
    return { allowed: false, retryAfter, limit, remaining: 0 }
  }

  recent.push(now)
  store.set(key, recent)
  return { allowed: true, retryAfter: 0, limit, remaining: limit - recent.length }
}

const HOUR_MS = 60 * 60 * 1000

// Per-bucket policy. `null` classification means "do not rate limit".
type Policy = { bucket: string; limit: number; windowMs: number }

/**
 * Decide which rate-limit policy applies to an API request, or null to skip.
 *
 * - register: 5/hour (account creation abuse)
 * - signin:   10/hour (credential stuffing) — covers the NextAuth credentials
 *             callback as well as /api/auth/signin
 * - auth housekeeping (session/csrf/providers/etc.): skipped — these are polled
 *   frequently by the client and limiting them would break the app
 * - everything else under /api: 100/hour
 */
const MINUTE_MS = 60 * 1000

export function policyForPath(pathname: string): Policy | null {
  // No rate limiting in development — avoids false 429s during local testing
  // and prevents the polling intervals we add from burning through the bucket.
  if (process.env.NODE_ENV === "development") return null

  // NLP parsing calls a paid LLM — strict 10/minute cap (abuse / cost control).
  if (pathname === "/api/expenses/parse") {
    return { bucket: "nlp-parse", limit: 10, windowMs: MINUTE_MS }
  }
  if (pathname === "/api/auth/register") {
    return { bucket: "register", limit: 5, windowMs: HOUR_MS }
  }
  if (
    pathname === "/api/auth/signin" ||
    pathname.startsWith("/api/auth/callback/credentials")
  ) {
    return { bucket: "signin", limit: 10, windowMs: HOUR_MS }
  }
  // Leave the rest of NextAuth's endpoints (session, csrf, providers, ...) alone.
  if (pathname.startsWith("/api/auth/")) {
    return null
  }
  if (pathname.startsWith("/api/")) {
    // 500/hour gives real users plenty of headroom even with background polling.
    return { bucket: "api", limit: 500, windowMs: HOUR_MS }
  }
  return null
}
