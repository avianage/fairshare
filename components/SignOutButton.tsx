"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"

/**
 * Signs the user out. Before redirecting, it purges all service-worker caches
 * so no per-user data (e.g. the cached /api/dashboard response) lingers on a
 * shared device.
 */
export function SignOutButton() {
  async function handleSignOut() {
    try {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {
      // Cache API may be unavailable; sign out regardless.
    }
    await signOut({ callbackUrl: "/login" })
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="inline-flex h-9 items-center justify-center rounded-xl border border-border/80 bg-card/50 text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground hover:border-primary/20 hover:shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-9 sm:w-auto sm:px-3.5 sm:gap-2"
      title="Sign out"
    >
      <LogOut className="h-[1.1rem] w-[1.1rem]" />
      <span className="hidden sm:inline text-sm font-semibold">Sign out</span>
    </button>
  )
}
