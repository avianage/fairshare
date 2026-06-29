import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyUsers } from "@/lib/notifications"
import { auditLog, getClientIp } from "@/lib/audit"

export const runtime = "nodejs"

type Params = { params: { requestId: string } }

// POST /api/friend-requests/[requestId]/accept — receiver accepts
// We use a sub-path via the filename convention; this route handles DELETE (decline/cancel)
// and is co-located with the accept action below.

// DELETE /api/friend-requests/[requestId] — cancel (sender) or decline (receiver)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const me = session.user.id

  const request = await prisma.friendRequest.findUnique({
    where: { id: params.requestId },
    select: { id: true, senderId: true, receiverId: true },
  })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (request.senderId !== me && request.receiverId !== me) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.friendRequest.delete({ where: { id: params.requestId } })
  void auditLog({ actorId: me, action: "friend.request_cancelled", targetId: params.requestId, ip: getClientIp(_req) })
  return NextResponse.json({ ok: true })
}

// PATCH /api/friend-requests/[requestId] — receiver accepts
export async function PATCH(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const me = session.user.id

  const request = await prisma.friendRequest.findUnique({
    where: { id: params.requestId },
    select: { id: true, senderId: true, receiverId: true },
  })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (request.receiverId !== me) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.$transaction([
    prisma.friendship.createMany({
      data: [
        { userId: me, friendId: request.senderId },
        { userId: request.senderId, friendId: me },
      ],
      skipDuplicates: true,
    }),
    prisma.friendRequest.delete({ where: { id: params.requestId } }),
  ])

  const acceptorName = (await prisma.user.findUnique({ where: { id: me }, select: { name: true } }))?.name ?? "Someone"
  void notifyUsers([request.senderId], {
    type: "friend_accepted",
    title: `${acceptorName} accepted your friend request`,
    body: "You are now friends on Fairshare.",
    url: "/friends",
  })
  void auditLog({ actorId: me, action: "friend.accepted", targetId: request.senderId, ip: getClientIp(_req) })

  return NextResponse.json({ ok: true })
}
