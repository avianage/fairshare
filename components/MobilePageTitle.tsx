"use client"

import { usePathname } from "next/navigation"

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/groups": "Groups",
  "/ledger": "Ledger",
  "/profile": "Profile",
  "/profile/settings": "Account & Security",
  "/personal": "Personal",
  "/friends": "Friends",
  "/admin": "Admin",
  "/direct-expenses": "Non-group Expenses",
  "/statement": "Statement",
}

export function MobilePageTitle() {
  const pathname = usePathname()
  // Check exact path first (handles sub-routes like /profile/settings), then fall back to first segment
  const title = TITLES[pathname ?? ""] ?? TITLES["/" + (pathname?.split("/")[1] ?? "")] ?? "Fairshare"
  return <span className="block truncate text-base font-semibold tracking-tight whitespace-nowrap">{title}</span>
}
