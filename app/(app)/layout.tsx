import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { SignOutButton } from "@/components/SignOutButton"
import { ThemeToggle } from "@/components/ThemeToggle"
import { SidebarNav, MobileNav } from "@/components/AppNav"
import { AddExpenseFAB } from "@/components/fab/AddExpenseFAB"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const initial = (session.user.name ?? "?").charAt(0).toUpperCase()

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar — hidden on mobile, where a top nav row takes over */}
      <aside className="hidden w-64 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt="Fairshare Logo"
            className="h-8 w-8 rounded-lg object-contain"
          />
          <span className="text-lg font-semibold tracking-tight">Fairshare</span>
        </div>
        <SidebarNav />
        <div className="border-t p-3">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/60"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {session.user.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {session.user.email}
              </span>
            </span>
          </Link>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-card/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/60 sm:px-6">
          <span className="flex items-center gap-2 text-lg font-semibold md:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.png"
              alt="Fairshare Logo"
              className="h-7 w-7 rounded-lg object-contain"
            />
            Fairshare
          </span>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {session.user.name}
            </span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>

        {/* Mobile nav row */}
        <MobileNav />
      </div>

      {/* Persistent floating add-expense button (authenticated pages only) */}
      <AddExpenseFAB
        currentUser={{ id: session.user.id, name: session.user.name ?? "You" }}
      />
    </div>
  )
}
