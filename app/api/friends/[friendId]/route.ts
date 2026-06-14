import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// DELETE /api/friends/[friendId] — remove friendship (both directions)
export async function DELETE(_req: Request, { params }: { params: { friendId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const me = session.user.id
  const { friendId } = params

  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { userId: me, friendId },
        { userId: friendId, friendId: me },
      ],
    },
  })

  return NextResponse.json({ success: true })
}
