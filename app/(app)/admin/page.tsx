import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AdminDashboard } from "@/components/admin/AdminDashboard"

export const metadata = { title: "Admin · Fairshare" }

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!session.user.isAdmin) redirect("/dashboard")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          User management and monitoring.
        </p>
      </div>
      <AdminDashboard currentUserId={session.user.id} />
    </div>
  )
}
