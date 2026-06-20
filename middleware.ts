import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { rateLimit, policyForPath } from "@/lib/rate-limit"
import { logHttp } from "@/lib/logger"

// Lightweight NextAuth instance — Edge-safe (no Prisma, no bcrypt).
// Only performs JWT cookie verification.
const { auth } = NextAuth(authConfig)

/**
 * Best-effort client IP. Behind a reverse proxy (nginx/traefik/caddy in front
 * of the Docker container) X-Forwarded-For is set; the left-most entry is the
 * original client. Falls back to NextRequest.ip, then a shared "unknown" bucket.
 */
function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  // `ip` is present on some platforms; not in the public type.
  return (req as NextRequest & { ip?: string }).ip ?? "unknown"
}

// Apply the rate-limit policy for this request, or null if within limits / N/A.
function enforceRateLimit(req: NextRequest): NextResponse | null {
  const policy = policyForPath(req.nextUrl.pathname)
  if (!policy) return null

  const key = `${policy.bucket}:${clientIp(req)}`
  const result = rateLimit(key, policy.limit, policy.windowMs)
  if (result.allowed) return null

  logHttp({
    method: req.method,
    path: req.nextUrl.pathname,
    status: 429,
    msg: `rate-limited (${policy.bucket})`,
  })
  return NextResponse.json(
    { error: "Too many requests", retryAfter: result.retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "Cache-Control": "no-store",
      },
    }
  )
}

// Routes that require an authenticated session
const PROTECTED_PAGES = ["/dashboard", "/groups", "/profile", "/ledger", "/admin", "/friends", "/direct-expenses", "/personal", "/insights", "/budgets", "/expenses"]
const PROTECTED_API_PREFIXES = ["/api/groups", "/api/dashboard", "/api/uploads", "/api/profile", "/api/expenses", "/api/ledger", "/api/direct-settle", "/api/users", "/api/admin", "/api/friends", "/api/friend-requests", "/api/notifications", "/api/budgets", "/api/insights"]
// POST requires auth; GET is public (invite link previews)
const POST_PROTECTED_API = ["/api/invite", "/api/friend-invite"]

function needsAuth(pathname: string, method: string): boolean {
  if (PROTECTED_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/")))
    return true
  if (PROTECTED_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/")))
    return true
  if (method === "POST" && POST_PROTECTED_API.some((p) => pathname === p || pathname.startsWith(p + "/")))
    return true
  return false
}

// NextAuth v5: auth() wraps the middleware handler and provides req.auth
export default auth((req: NextRequest & { auth: unknown }) => {
  const { nextUrl, method } = req
  const { pathname } = nextUrl
  const session = req.auth

  // Rate limiting runs first, before auth — abusive traffic is rejected even
  // when unauthenticated (e.g. register / login brute force).
  const limited = enforceRateLimit(req)
  if (limited) return limited

  if (needsAuth(pathname, method) && !session) {
    // API routes → 401 JSON (don't redirect clients that expect JSON)
    if (pathname.startsWith("/api/")) {
      logHttp({ method, path: pathname, status: 401, msg: "unauthorized" })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Pages → redirect to /login preserving the intended destination
    const loginUrl = new URL("/login", nextUrl.origin)
    loginUrl.searchParams.set(
      "callbackUrl",
      pathname + (nextUrl.search ? nextUrl.search : "")
    )
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  // Run on all paths except Next.js internals and static assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
