import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const MAX_RESULTS = 10

// GET /api/users/search?q=<query>
// Returns users the caller already has a relationship with — a shared group, a
// prior direct expense, OR a friendship — matched by name/email.
// When q is empty, returns up to 10 friends as suggestions (sorted by name).
// NEVER exposes emails to the client: only { id, name, avatar }.
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const me = session.user.id

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim()

  // Build the allowed set once — used for both empty-q suggestions and search
  const [myMemberships, directCoParticipants, myFriends] = await Promise.all([
    prisma.groupMember.findMany({
      where: { userId: me },
      select: { groupId: true },
    }),
    prisma.directParticipant.findMany({
      where: { expense: { groupId: null, participants: { some: { userId: me } } } },
      select: { userId: true },
    }),
    prisma.friendship.findMany({
      where: { userId: me },
      select: { friendId: true },
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
    ...myFriends.map((f) => f.friendId),
  ])
  allowedIds.delete(me)

  // Empty query → return friends as suggestions (before the user types)
  if (q.length === 0) {
    if (myFriends.length === 0) return NextResponse.json({ users: [] })
    const users = await prisma.user.findMany({
      where: { id: { in: myFriends.map((f) => f.friendId) } },
      select: { id: true, name: true, avatar: true },
      orderBy: { name: "asc" },
      take: MAX_RESULTS,
    })
    return NextResponse.json({ users })
  }

  if (allowedIds.size === 0) return NextResponse.json({ users: [] })

  const users = await prisma.user.findMany({
    where: {
      id: { in: Array.from(allowedIds) },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, avatar: true },
    take: MAX_RESULTS,
    orderBy: { name: "asc" },
  })

  return NextResponse.json({ users })
}
