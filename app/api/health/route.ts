import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Health endpoint is public (no auth) and must never be cached — it has to
// reflect the live DB state on every call (e.g. for a Docker HEALTHCHECK).
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// GET /api/health — liveness + DB connectivity probe.
export async function GET() {
  const version = process.env.APP_VERSION ?? "unknown"

  try {
    // Cheapest possible round-trip that proves the connection works.
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json(
      { status: "ok", db: "connected", version },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    // Log for container stdout/stderr; never expose internal error details.
    console.error(
      JSON.stringify({
        level: "error",
        path: "/api/health",
        status: 503,
        message: "Database health check failed",
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      })
    )
    return NextResponse.json(
      { status: "error", db: "disconnected", version },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}
