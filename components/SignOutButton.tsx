"use client"

import { signOut } from "next-auth/react"

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
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      Sign out
    </button>
  )
}
