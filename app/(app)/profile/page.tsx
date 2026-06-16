import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ProfileForm } from "@/components/profile/ProfileForm"
import { PasswordForm } from "@/components/profile/PasswordForm"

export const metadata = { title: "Profile · Fairshare" }

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, username: true, email: true, createdAt: true, usernameChangedAt: true },
  })

  if (!user) redirect("/login")

  const usernameNextChangeAt = user.usernameChangedAt
    ? new Date(user.usernameChangedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account details and password.
        </p>
      </div>

      <ProfileForm
        defaultName={user.name}
        defaultUsername={user.username ?? ""}
        email={user.email}
        memberSince={user.createdAt.toISOString()}
        usernameNextChangeAt={usernameNextChangeAt}
      />

      <PasswordForm />
    </div>
  )
}
