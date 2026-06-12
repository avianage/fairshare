"use client"

import { useEffect, useState } from "react"
import { Share, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const VISITS_KEY = "fs_visit_count"
const DISMISS_KEY = "fs_install_dismissed_until"
const DISMISS_DAYS = 7
const MIN_VISITS = 2

// The beforeinstallprompt event isn't in the standard lib types.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  // iPhone/iPad/iPod, plus iPadOS 13+ which masquerades as a Mac with touch.
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  )
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes this non-standard flag when launched from the home screen.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

type Mode = "android" | "ios" | null

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [mode, setMode] = useState<Mode>(null)

  useEffect(() => {
    // Count visits (once per mount/session entry).
    const visits = Number(localStorage.getItem(VISITS_KEY) ?? "0") + 1
    localStorage.setItem(VISITS_KEY, String(visits))

    const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) ?? "0")
    const suppressed = Date.now() < dismissedUntil
    const eligible = visits >= MIN_VISITS && !suppressed && !isStandalone()

    // iOS has no beforeinstallprompt — show a manual "Add to Home Screen" tip.
    if (eligible && isIos()) {
      setMode("ios")
    }

    const onBeforeInstall = (e: Event) => {
      // Stop Chrome's mini-infobar; we present our own banner instead.
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      if (eligible) setMode("android")
    }

    const onInstalled = () => {
      setMode(null)
      setDeferred(null)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice.catch(() => { })
    setMode(null)
    setDeferred(null)
  }

  function dismiss() {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(DISMISS_KEY, String(until))
    setMode(null)
  }

  if (mode === null) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto flex max-w-md items-start gap-3 rounded-xl border bg-card p-4 shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon.png"
          alt="Fairshare Logo"
          className="h-10 w-10 shrink-0 rounded-lg object-contain"
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Add Fairshare to your home screen</p>
          {mode === "android" ? (
            <p className="text-xs text-muted-foreground">
              Install the app for quick access and a full-screen experience.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Tap the{" "}
              <Share className="inline h-3.5 w-3.5 -translate-y-px" aria-label="Share" />{" "}
              Share button in Safari, then <span className="font-medium">Add to Home Screen</span>.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {mode === "android" ? (
            <>
              <Button size="sm" onClick={install}>
                Install
              </Button>
              <button
                type="button"
                onClick={dismiss}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Not now
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
