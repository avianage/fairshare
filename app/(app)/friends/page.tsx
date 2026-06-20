import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FriendsList } from "@/components/friends/FriendsList"

export const metadata = { title: "Friends · Fairshare" }

export default async function FriendsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  const [friendships, adminGroupRows, friendRequests] = await Promise.all([
    prisma.friendship.findMany({
      where: { userId },
      select: {
        createdAt: true,
        friend: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { friend: { name: "asc" } },
    }),
    prisma.groupMember.findMany({
      where: { userId, role: "ADMIN", group: { deletedAt: null } },
      select: { group: { select: { id: true, name: true, emoji: true } } },
      orderBy: { group: { name: "asc" } },
    }),
    prisma.friendRequest.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      select: {
        id: true,
        createdAt: true,
        sender: { select: { id: true, name: true, avatar: true } },
        receiver: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const friendIds = friendships.map((f) => f.friend.id)
  const adminGroups = adminGroupRows.map((m) => ({
    id: m.group.id,
    name: m.group.name,
    emoji: m.group.emoji,
  }))
  const adminGroupIds = adminGroups.map((g) => g.id)

  // Shared group count per friend
  const sharedGroupRows = friendIds.length > 0
    ? await prisma.groupMember.groupBy({
        by: ["userId"],
        where: {
          userId: { in: friendIds },
          group: { deletedAt: null, members: { some: { userId } } },
        },
        _count: true,
      })
    : []
  const sharedGroupCountMap = Object.fromEntries(
    sharedGroupRows.map((r) => [r.userId, r._count])
  )

  // Which admin groups each friend is already in
  const friendMemberships = friendIds.length > 0 && adminGroupIds.length > 0
    ? await prisma.groupMember.findMany({
        where: { userId: { in: friendIds }, groupId: { in: adminGroupIds } },
        select: { userId: true, groupId: true },
      })
    : []
  const friendGroupMembershipMap: Record<string, Set<string>> = {}
  for (const row of friendMemberships) {
    if (!friendGroupMembershipMap[row.userId]) {
      friendGroupMembershipMap[row.userId] = new Set()
    }
    friendGroupMembershipMap[row.userId].add(row.groupId)
  }

  const initialFriends = friendships.map(({ friend, createdAt }) => ({
    id: friend.id,
    name: friend.name,
    avatar: friend.avatar,
    friendsSince: createdAt.toISOString(),
    sharedGroupCount: sharedGroupCountMap[friend.id] ?? 0,
    availableGroups: adminGroups.filter(
      (g) => !friendGroupMembershipMap[friend.id]?.has(g.id)
    ),
  }))

  const incoming = friendRequests
    .filter((r) => r.receiver.id === userId)
    .map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), sender: r.sender }))
  const outgoing = friendRequests
    .filter((r) => r.sender.id === userId)
    .map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), receiver: r.receiver }))

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold">Friends</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find people by name or username, or share your invite link.
        </p>
      </div>
      <FriendsList
        initialFriends={initialFriends}
        initialIncoming={incoming}
        initialOutgoing={outgoing}
      />
    </div>
  )
}
