import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyUsers } from "@/lib/notifications"
import { auditLog, getClientIp } from "@/lib/audit"

export const runtime = "nodejs"

// GET /api/friend-requests — incoming + outgoing pending requests
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const me = session.user.id

  const [incoming, outgoing] = await Promise.all([
    prisma.friendRequest.findMany({
      where: { receiverId: me },
      select: {
        id: true,
        createdAt: true,
        sender: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendRequest.findMany({
      where: { senderId: me },
      select: {
        id: true,
        createdAt: true,
        receiver: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return NextResponse.json({ incoming, outgoing })
}

const sendSchema = z.object({ receiverId: z.string().min(1) })

// POST /api/friend-requests — send a friend request
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const me = session.user.id

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "receiverId is required" }, { status: 400 })
  }
  const { receiverId } = parsed.data

  if (receiverId === me) {
    return NextResponse.json({ error: "You can't add yourself." }, { status: 400 })
  }

  // Already friends?
  const existing = await prisma.friendship.findUnique({
    where: { userId_friendId: { userId: me, friendId: receiverId } },
    select: { id: true },
  })
  if (existing) return NextResponse.json({ error: "You're already friends." }, { status: 409 })

  // Request already sent?
  const alreadySent = await prisma.friendRequest.findUnique({
    where: { senderId_receiverId: { senderId: me, receiverId } },
    select: { id: true },
  })
  if (alreadySent) return NextResponse.json({ error: "Request already sent." }, { status: 409 })

  // If they already sent you a request, auto-accept instead
  const reverseRequest = await prisma.friendRequest.findUnique({
    where: { senderId_receiverId: { senderId: receiverId, receiverId: me } },
    select: { id: true },
  })
  if (reverseRequest) {
    await prisma.$transaction([
      prisma.friendship.createMany({
        data: [
          { userId: me, friendId: receiverId },
          { userId: receiverId, friendId: me },
        ],
      }),
      prisma.friendRequest.delete({ where: { id: reverseRequest.id } }),
    ])
    const myName = (await prisma.user.findUnique({ where: { id: me }, select: { name: true } }))?.name ?? "Someone"
    void notifyUsers([receiverId], {
      type: "friend_accepted",
      title: `${myName} accepted your friend request`,
      body: "You are now friends on Fairshare.",
      url: "/friends",
    })
    void auditLog({ actorId: me, action: "friend.accepted", targetId: receiverId, ip: getClientIp(request) })
    return NextResponse.json({ accepted: true }, { status: 201 })
  }

  // Target user must exist
  const target = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { id: true },
  })
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 })

  const req = await prisma.friendRequest.create({
    data: { senderId: me, receiverId },
    select: { id: true },
  })

  const senderName = (await prisma.user.findUnique({ where: { id: me }, select: { name: true } }))?.name ?? "Someone"
  void notifyUsers([receiverId], {
    type: "friend_request",
    title: `${senderName} sent you a friend request`,
    body: "Tap to view and respond.",
    url: "/friends",
  })

  void auditLog({ actorId: me, action: "friend.request", targetId: receiverId, ip: getClientIp(request) })
  return NextResponse.json({ id: req.id }, { status: 201 })
}
