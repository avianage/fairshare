import { redirect } from "next/navigation"
import Link from "next/link"
import { Settings, Wallet, ShieldCheck, ChevronRight, Users, User } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const metadata = { title: "Profile · Fairshare" }

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [user, groupCount, directExpenses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, username: true, email: true, createdAt: true },
    }),
    prisma.groupMember.count({ where: { userId: session.user.id } }),
    prisma.expense.findMany({
      where: {
        groupId: null,
        deletedAt: null,
        OR: [
          { payerId: session.user.id },
          { participants: { some: { userId: session.user.id } } },
        ],
      },
      select: {
        payerId: true,
        participants: {
          select: { userId: true },
        },
      },
    }),
  ])

  if (!user) redirect("/login")

  const initial = (user.name ?? "?").charAt(0).toUpperCase()
  const joined = new Date(user.createdAt).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // Calculate distinct individuals with whom this user has non-group expenses
  const directUserIds = new Set<string>()
  for (const exp of directExpenses) {
    if (exp.payerId !== session.user.id) {
      directUserIds.add(exp.payerId)
    }
    for (const p of exp.participants) {
      if (p.userId !== session.user.id) {
        directUserIds.add(p.userId)
      }
    }
  }
  const directCount = directUserIds.size

  const quickLinks = [
    { href: "/personal", icon: Wallet, label: "Personal Expenses", description: "Individual expenses not tied to a group" },
    { href: "/profile/settings", icon: Settings, label: "Account & Security", description: "Name, username, password" },
    ...(session.user.isAdmin ? [{ href: "/admin", icon: ShieldCheck, label: "Admin Panel", description: "Manage users and platform settings" }] : []),
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Avatar + identity */}
      <div className="flex items-center gap-5">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/15 text-3xl font-bold text-primary border border-primary/20 shadow-sm">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="text-xl font-bold truncate">{user.name}</p>
          {user.username && (
            <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
          )}
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">Member since {joined}</p>
        </div>
        <Link
          href="/profile/settings"
          className="ml-auto shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Account settings"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/groups"
          className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm hover:border-primary/25 hover:shadow hover:scale-[1.01] active:scale-[0.99] transition-all duration-300"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </span>
          <div>
            <p className="text-lg font-semibold leading-none">{groupCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{groupCount === 1 ? "Group" : "Groups"}</p>
          </div>
        </Link>

        <Link
          href="/direct-expenses"
          className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm hover:border-primary/25 hover:shadow hover:scale-[1.01] active:scale-[0.99] transition-all duration-300"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </span>
          <div>
            <p className="text-lg font-semibold leading-none">{directCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{directCount === 1 ? "Direct Connection" : "Direct Connections"}</p>
          </div>
        </Link>
      </div>

      {/* Quick links */}
      <div className="rounded-xl border bg-card/65 backdrop-blur-md overflow-hidden shadow-sm">
        {quickLinks.map((link, i) => (
          <Link
            key={link.href}
            href={link.href}
            className={`group flex items-center gap-4 px-4 py-4 transition-all duration-300 hover:bg-accent/40 ${
              i > 0 ? "border-t" : ""
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm transition-transform duration-300 group-hover:scale-105">
              <link.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">{link.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{link.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </div>
  )
}
