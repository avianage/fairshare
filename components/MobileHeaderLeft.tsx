"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft } from "lucide-react"

interface MobileHeaderLeftProps {
  initial: string
}

export function MobileHeaderLeft({ initial }: MobileHeaderLeftProps) {
  const pathname = usePathname()

  let backHref: string | null = null
  if (pathname === "/direct-expenses") {
    backHref = "/groups"
  } else if (pathname === "/profile/settings") {
    backHref = "/profile"
  } else if (pathname === "/groups/new") {
    backHref = "/groups"
  } else if (pathname === "/admin") {
    backHref = "/profile"
  } else if (pathname?.startsWith("/groups/") && pathname !== "/groups/new") {
    backHref = "/groups"
  }

  if (backHref) {
    return (
      <Link
        href={backHref}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-card/50 text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground hover:border-primary/20 hover:shadow-sm active:scale-95"
        aria-label="Go back"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
    )
  }

  return (
    <Link
      href="/profile"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary border border-primary/20 transition-all duration-200 hover:scale-105 active:scale-95"
      aria-label="Profile"
    >
      {initial}
    </Link>
  )
}
