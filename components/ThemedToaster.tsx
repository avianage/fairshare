"use client"

import { Toaster } from "sonner"
import { useTheme } from "next-themes"

/** sonner Toaster wired to follow the active next-themes theme. */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      theme={(resolvedTheme as "light" | "dark") ?? "system"}
    />
  )
}
