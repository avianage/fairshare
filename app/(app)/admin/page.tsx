import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, ScrollText } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AdminDashboard } from "@/components/admin/AdminDashboard"

export const metadata = { title: "Admin · Fairshare" }

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!session.user.isAdmin) redirect("/dashboard")

  const suspiciousCount = await prisma.auditLog.count({ where: { suspicious: true } })

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
          <div className="mt-3">
            <Link
              href="/admin/audit"
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ScrollText className="h-4 w-4" />
              View Audit Log
              {suspiciousCount > 0 && (
                <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                  {suspiciousCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
      <AdminDashboard currentUserId={session.user.id} currentUserIsOwner={session.user.isOwner === true} />
    </div>
  )
}
