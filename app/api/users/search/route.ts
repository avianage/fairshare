import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const MAX_RESULTS = 10

// GET /api/users/search?q=<query>
// Returns users the caller already has a relationship with — a shared group OR a
// prior direct expense — matched by name/email. NEVER returns all users, and
// NEVER exposes emails (privacy): only { id, name, avatar }.
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const me = session.user.id

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim()
  if (q.length === 0) {
    return NextResponse.json({ users: [] })
  }

  // 1. Build the set of users the caller is allowed to see.
  const [myMemberships, directCoParticipants] = await Promise.all([
    prisma.groupMember.findMany({
      where: { userId: me },
      select: { groupId: true },
    }),
    // Direct expenses (no group) the caller is part of → their other participants.
    prisma.directParticipant.findMany({
      where: { expense: { groupId: null, participants: { some: { userId: me } } } },
      select: { userId: true },
    }),
  ])

  const groupIds = myMemberships.map((m) => m.groupId)
  const coMembers = groupIds.length
    ? await prisma.groupMember.findMany({
        where: { groupId: { in: groupIds }, userId: { not: me } },
        select: { userId: true },
      })
    : []

  const allowedIds = new Set<string>([
    ...coMembers.map((m) => m.userId),
    ...directCoParticipants.map((p) => p.userId),
  ])
  allowedIds.delete(me) // never include the caller themselves
  if (allowedIds.size === 0) {
    return NextResponse.json({ users: [] })
  }

  // 2. Match by name OR email (parameterized `contains`, case-insensitive → ILIKE).
  //    Email is used for matching only — it is never returned to the client.
  const users = await prisma.user.findMany({
    where: {
      id: { in: Array.from(allowedIds) },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, avatar: true },
    take: MAX_RESULTS,
    orderBy: { name: "asc" },
  })

  return NextResponse.json({ users })
}
