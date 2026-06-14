"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, Scale, User, ShieldCheck, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"

const baseLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/balances", label: "Balances", icon: Scale },
  { href: "/friends", label: "Friends", icon: UserPlus },
  { href: "/profile", label: "Profile", icon: User },
]

const adminLink = { href: "/admin", label: "Admin", icon: ShieldCheck }

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/")
}

/** Vertical nav for the desktop sidebar. */
export function SidebarNav({ showAdmin }: { showAdmin?: boolean }) {
  const pathname = usePathname()
  const links = showAdmin ? [...baseLinks, adminLink] : baseLinks
  return (
    <nav className="flex-1 space-y-1.5 p-4 text-sm">
      {links.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3.5 py-2.5 font-medium transition-all duration-200",
              active
                ? "bg-primary/10 text-primary shadow-sm font-semibold"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r-full bg-primary" />
            )}
            <Icon className={cn("h-4 w-4 transition-transform duration-200 group-hover:scale-110", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

/** Horizontal bottom nav for mobile screens. */
export function MobileNav({ showAdmin }: { showAdmin?: boolean }) {
  const pathname = usePathname()
  const links = showAdmin ? [...baseLinks, adminLink] : baseLinks
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background/80 backdrop-blur-lg px-6 md:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        height: "calc(5rem + env(safe-area-inset-bottom))",
      }}
    >
      {links.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            className="relative flex flex-col items-center justify-center p-2 transition-transform active:scale-90"
            aria-label={label}
          >
            <Icon
              className={cn(
                "h-6 w-6 transition-all duration-200",
                active
                  ? "text-primary scale-110 stroke-[2.5px]"
                  : "text-muted-foreground hover:text-foreground stroke-[2px]"
              )}
            />
            {active && (
              <span className="absolute bottom-0 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
