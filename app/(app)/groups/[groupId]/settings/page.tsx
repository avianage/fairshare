import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { GroupSettings } from "@/components/groups/GroupSettings"

export default async function GroupSettingsPage({
  params,
}: {
  params: { groupId: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const membership = await prisma.groupMember.findUnique({
    where: {
      userId_groupId: { userId: session.user.id, groupId: params.groupId },
    },
    select: { role: true },
  })
  if (!membership) notFound()

  const group = await prisma.group.findFirst({
    where: { id: params.groupId, deletedAt: null },
    select: {
      id: true,
      name: true,
      emoji: true,
      description: true,
      members: {
        select: {
          role: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  })
  if (!group) notFound()

  const members = group.members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
  }))

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href={`/groups/${group.id}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to group
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Group settings</h1>

      <GroupSettings
        group={{
          id: group.id,
          name: group.name,
          emoji: group.emoji,
          description: group.description,
        }}
        members={members}
        isAdmin={membership.role === "ADMIN"}
        currentUserId={session.user.id}
      />
    </div>
  )
}
