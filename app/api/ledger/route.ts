import { NextResponse } from "next/server"
import { unstable_cache } from "next/cache"
import { auth } from "@/lib/auth"
import { getGlobalDebts } from "@/lib/globalBalances"

export const runtime = "nodejs"

// GET /api/ledger — net debts for the current user across groups + direct
// expenses. Cached for 30s per user (keyed by userId, so one user's cache can
// never serve another's balances).
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id
  const cached = unstable_cache(
    () => getGlobalDebts(userId),
    ["global-debts", userId],
    { revalidate: 30, tags: [`global-debts:${userId}`] }
  )

  const data = await cached()
  return NextResponse.json(data)
}
