import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { SignOutButton } from "@/components/SignOutButton"
import { ThemeToggle } from "@/components/ThemeToggle"
import { PushSubscriber } from "@/components/PushSubscriber"
import { SidebarNav, MobileNav } from "@/components/AppNav"
import { AddExpenseFAB } from "@/components/fab/AddExpenseFAB"
import { MobilePageTitle } from "@/components/MobilePageTitle"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const initial = (session.user.name ?? "?").charAt(0).toUpperCase()

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar — hidden on mobile, where a top nav row takes over */}
      <aside className="hidden w-64 flex-col border-r bg-card/65 backdrop-blur-md md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt="Fairshare Logo"
            className="h-8 w-8 rounded-lg object-contain shadow-sm"
          />
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/85 bg-clip-text text-transparent">Fairshare</span>
        </div>
        <SidebarNav showAdmin={session.user.isAdmin} />
        <div className="border-t p-4 bg-muted/20">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-xl border border-transparent bg-transparent px-3 py-2.5 transition-all duration-300 hover:bg-accent hover:border-border hover:shadow-sm"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary border border-primary/20 shadow-sm">
              {initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold tracking-tight">
                {session.user.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground/80">
                {session.user.email}
              </span>
            </span>
          </Link>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/60 sm:px-6">
          {/* Mobile: avatar linking to profile + dynamic page title */}
          <div className="flex items-center gap-2.5 md:hidden">
            <Link
              href="/profile"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary border border-primary/20"
              aria-label="Profile"
            >
              {initial}
            </Link>
            <MobilePageTitle />
          </div>
          <div className="flex items-center gap-2 sm:gap-3 md:ml-auto">
            <span className="hidden text-sm text-muted-foreground md:inline">
              {session.user.name}
            </span>
            <PushSubscriber />
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-5 sm:pt-5 sm:pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>

        {/* Mobile nav row */}
        <MobileNav
          showAdmin={session.user.isAdmin}
          currentUser={{ id: session.user.id, name: session.user.name ?? "You" }}
        />
      </div>

      {/* Persistent floating add-expense button (authenticated pages only) */}
      <AddExpenseFAB
        currentUser={{ id: session.user.id, name: session.user.name ?? "You" }}
      />
    </div>
  )
}
