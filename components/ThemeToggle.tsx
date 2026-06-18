"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch — the resolved theme is only known on the client.
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      // Theme-dependent text must wait for mount, or server ("dark") and client
      // ("light") disagree and React warns about a hydration mismatch.
      title={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : undefined}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-card/50 text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground hover:border-primary/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-[1.1rem] w-[1.1rem]" />
        ) : (
          <Moon className="h-[1.1rem] w-[1.1rem]" />
        )
      ) : (
        <Sun className="h-[1.1rem] w-[1.1rem] opacity-0" />
      )}
    </button>
  )
}
