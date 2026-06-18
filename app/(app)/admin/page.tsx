import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { AdminDashboard } from "@/components/admin/AdminDashboard"

export const metadata = { title: "Admin · Fairshare" }

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!session.user.isAdmin) redirect("/dashboard")

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <Link
          href="/profile"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors md:hidden"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Profile
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Control Panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            User management, role promotions, and platform moderation.
          </p>
        </div>
      </div>
      <AdminDashboard currentUserId={session.user.id} />
    </div>
  )
}
