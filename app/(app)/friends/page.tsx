import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FriendsList } from "@/components/friends/FriendsList"

export const metadata = { title: "Friends · Fairshare" }

export default async function FriendsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const friendships = await prisma.friendship.findMany({
    where: { userId: session.user.id },
    select: {
      createdAt: true,
      friend: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { friend: { name: "asc" } },
  })

  const initialFriends = friendships.map(({ friend, createdAt }) => ({
    ...friend,
    friendsSince: createdAt.toISOString(),
  }))

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Friends</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Friends can be added to direct expenses without needing a shared group.
        </p>
      </div>
      <FriendsList initialFriends={initialFriends} />
    </div>
  )
}
