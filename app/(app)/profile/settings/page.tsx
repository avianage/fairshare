import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ProfileForm } from "@/components/profile/ProfileForm"
import { PasswordForm } from "@/components/profile/PasswordForm"
import { PaymentRoutingForm } from "@/components/profile/PaymentRoutingForm"
import { PushNotificationsForm } from "@/components/profile/PushNotificationsForm"

export const metadata = { title: "Account & Security · Fairshare" }

export default async function ProfileSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, username: true, email: true, createdAt: true, usernameChangedAt: true, allowPaymentRouting: true },
  })

  if (!user) redirect("/login")

  const usernameNextChangeAt = user.usernameChangedAt
    ? new Date(user.usernameChangedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="border-b pb-4">
        <Link
          href="/profile"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors md:hidden"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Profile
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account &amp; Security</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your name, username, and password.
          </p>
        </div>
      </div>

      <ProfileForm
        defaultName={user.name}
        defaultUsername={user.username ?? ""}
        email={user.email}
        memberSince={user.createdAt.toISOString()}
        usernameNextChangeAt={usernameNextChangeAt}
      />

      <PasswordForm />

      <PaymentRoutingForm initialValue={user.allowPaymentRouting} />

      <PushNotificationsForm />
    </div>
  )
}
