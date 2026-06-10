import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Lightweight NextAuth instance — Edge-safe (no Prisma, no bcrypt).
// Only performs JWT cookie verification.
const { auth } = NextAuth(authConfig)

// Routes that require an authenticated session
const PROTECTED_PAGES = ["/dashboard", "/groups", "/profile"]
const PROTECTED_API_PREFIXES = ["/api/groups", "/api/dashboard"]
// POST /api/invite requires auth; GET is public (invite link preview)
const POST_PROTECTED_API = ["/api/invite"]

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

  if (needsAuth(pathname, method) && !session) {
    // API routes → 401 JSON (don't redirect clients that expect JSON)
    if (pathname.startsWith("/api/")) {
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
