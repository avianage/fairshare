import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// GET /api/users/find?q=<query>
// Global user search for friend discovery — searches all users by name or username.
// Returns relationship context alongside each result so the UI can show the right action.
// Never exposes emails.
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const me = session.user.id

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim()
  if (q.length < 2) return NextResponse.json({ users: [] })

  const [users, myFriendIds, sentRequestIds, receivedRequestIds] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: { not: me },
        isBanned: false,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { username: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, username: true, avatar: true },
      take: 10,
      orderBy: { name: "asc" },
    }),
    prisma.friendship.findMany({
      where: { userId: me },
      select: { friendId: true },
    }),
    prisma.friendRequest.findMany({
      where: { senderId: me },
      select: { receiverId: true, id: true },
    }),
    prisma.friendRequest.findMany({
      where: { receiverId: me },
      select: { senderId: true, id: true },
    }),
  ])

  const friendSet = new Set(myFriendIds.map((f) => f.friendId))
  const sentMap = new Map(sentRequestIds.map((r) => [r.receiverId, r.id]))
  const receivedMap = new Map(receivedRequestIds.map((r) => [r.senderId, r.id]))

  const result = users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    avatar: u.avatar,
    // relationship: "friend" | "request_sent" | "request_received" | "none"
    relationship: friendSet.has(u.id)
      ? "friend"
      : sentMap.has(u.id)
      ? "request_sent"
      : receivedMap.has(u.id)
      ? "request_received"
      : "none",
    requestId: sentMap.get(u.id) ?? receivedMap.get(u.id) ?? null,
  }))

  return NextResponse.json({ users: result })
}
