import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// GET /api/friends — list the caller's friends
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const friendships = await prisma.friendship.findMany({
    where: { userId: session.user.id },
    select: {
      createdAt: true,
      friend: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { friend: { name: "asc" } },
  })

  const friends = friendships.map(({ friend, createdAt }) => ({
    ...friend,
    friendsSince: createdAt,
  }))

  return NextResponse.json({ friends })
}
