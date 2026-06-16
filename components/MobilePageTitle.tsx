"use client"

import { usePathname } from "next/navigation"

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/groups": "Groups",
  "/balances": "Balances",
  "/profile": "Profile",
  "/personal": "Personal",
  "/friends": "Friends",
  "/admin": "Admin",
  "/direct-expenses": "Non-group Expenses",
}

export function MobilePageTitle() {
  const pathname = usePathname()
  const key = "/" + (pathname?.split("/")[1] ?? "")
  const title = TITLES[key] ?? "Fairshare"
  return <span className="text-base font-semibold">{title}</span>
}
