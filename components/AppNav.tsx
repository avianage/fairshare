"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, Scale, User, ShieldCheck, UserPlus, Wallet, Plus, TrendingUp, PiggyBank } from "lucide-react"
import { cn } from "@/lib/utils"
import { AddExpenseModal } from "@/components/fab/AddExpenseModal"

const baseLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/personal", label: "Personal", icon: Wallet },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/balances", label: "Balances", icon: Scale },
  { href: "/insights", label: "Insights", icon: TrendingUp },
  { href: "/friends", label: "Friends", icon: UserPlus },
  { href: "/profile", label: "Profile", icon: User },
]

// Mobile bottom nav shows only 4 primary links + center "+" tab
const mobileLinks = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/balances", label: "Balances", icon: Scale },
  { href: "/profile", label: "Profile", icon: User },
]

const adminLink = { href: "/admin", label: "Admin", icon: ShieldCheck }

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/")
}

/** Vertical nav for the desktop sidebar. */
export function SidebarNav({ showAdmin, friendRequestCount = 0 }: { showAdmin?: boolean; friendRequestCount?: number }) {
  const pathname = usePathname()
  const links = showAdmin ? [...baseLinks, adminLink] : baseLinks
  return (
    <nav className="flex-1 space-y-1.5 p-4 text-sm">
      {links.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href)
        const badge = href === "/friends" && friendRequestCount > 0 ? friendRequestCount : 0
        const isAdmin = href === "/admin"
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3.5 py-2.5 font-medium transition-all duration-200",
              active
                ? isAdmin
                  ? "bg-destructive/10 text-destructive shadow-sm font-semibold"
                  : "bg-primary/10 text-primary shadow-sm font-semibold"
                : isAdmin
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            {active && (
              <span className={cn(
                "absolute left-0 top-1/4 h-1/2 w-1 rounded-r-full",
                isAdmin ? "bg-destructive" : "bg-primary"
              )} />
            )}
            <Icon className={cn(
              "h-4 w-4 transition-transform duration-200 group-hover:scale-110",
              active
                ? isAdmin
                  ? "text-destructive"
                  : "text-primary"
                : isAdmin
                  ? "text-destructive"
                  : "text-muted-foreground group-hover:text-foreground"
            )} />
            <span className="flex-1">{label}</span>
            {badge > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function mobilePageContext(pathname: string): { initialGroupId?: string; initialMode?: "solo" | "person" | "anyone" } {
  const groupMatch = pathname.match(/^\/groups\/([^/]+)/)
  if (groupMatch && groupMatch[1] !== "new") return { initialGroupId: groupMatch[1] }
  if (pathname === "/personal") return { initialMode: "solo" }
  if (pathname.startsWith("/direct-expenses/")) return { initialMode: "person" }
  return {}
}

/** Horizontal bottom nav for mobile screens. */
export function MobileNav({
  currentUser,
}: {
  showAdmin?: boolean
  currentUser?: { id: string; name: string }
}) {
  const pathname = usePathname()
  const [modalOpen, setModalOpen] = useState(false)
  const ctx = mobilePageContext(pathname)

  // Split mobile links around the center "+" button
  const left = mobileLinks.slice(0, 2)
  const right = mobileLinks.slice(2)

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-end justify-around border-t border-border bg-background/90 backdrop-blur-lg md:hidden"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          height: "calc(4.5rem + env(safe-area-inset-bottom))",
        }}
      >
        {left.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 pb-2 pt-2 transition-transform active:scale-90"
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-all duration-200",
                  active ? "text-primary stroke-[2.5px]" : "text-muted-foreground stroke-[2px]"
                )}
              />
              <span className={cn("text-[10px] font-medium leading-none", active ? "text-primary" : "text-muted-foreground")}>
                {label}
              </span>
            </Link>
          )
        })}

        {/* Center "+" tab */}
        <div className="flex flex-1 flex-col items-center justify-end pb-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            aria-label="Add expense"
            className="flex h-12 w-12 -translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-90 hover:scale-105"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {right.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 pb-2 pt-2 transition-transform active:scale-90"
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-all duration-200",
                  active ? "text-primary stroke-[2.5px]" : "text-muted-foreground stroke-[2px]"
                )}
              />
              <span className={cn("text-[10px] font-medium leading-none", active ? "text-primary" : "text-muted-foreground")}>
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {currentUser && (
        <AddExpenseModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          currentUser={currentUser}
          initialGroupId={ctx.initialGroupId}
          initialMode={ctx.initialMode}
        />
      )}
    </>
  )
}
