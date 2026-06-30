"use client"

import { useCallback, useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type InviteInfo = { groupName: string; inviterName: string }
type Status = "loading" | "valid" | "invalid"

export default function InvitePage(
  props: {
    params: Promise<{ token: string }>
  }
) {
  const params = use(props.params);
  const { token } = params
  const router = useRouter()
  const { status: authStatus } = useSession()

  const [status, setStatus] = useState<Status>("loading")
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Guards against the auto-join effect firing more than once.
  const autoJoined = useRef(false)

  const loginUrl = `/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`

  // Load a preview of the invite (public endpoint, no auth needed).
  useEffect(() => {
    let cancelled = false
    fetch(`/api/invite/${token}`)
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          setStatus("invalid")
          return
        }
        setInfo(await res.json())
        setStatus("valid")
      })
      .catch(() => {
        if (!cancelled) setStatus("invalid")
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const accept = useCallback(async () => {
    setError(null)
    setAccepting(true)
    try {
      const res = await fetch(`/api/invite/${token}`, { method: "POST" })

      // Not signed in — send to login and come back here afterwards.
      if (res.status === 401) {
        router.push(loginUrl)
        return
      }

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 404) setStatus("invalid")
        else setError(data?.error ?? "Could not accept this invite.")
        setAccepting(false)
        return
      }

      router.push(`/groups/${data.groupId}`)
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
      setAccepting(false)
    }
  }, [token, router, loginUrl])

  // Once we know the invite is valid AND the visitor is authenticated, join
  // them automatically — no extra click needed for logged-in users.
  useEffect(() => {
    if (
      status === "valid" &&
      authStatus === "authenticated" &&
      !autoJoined.current
    ) {
      autoJoined.current = true
      accept()
    }
  }, [status, authStatus, accept])

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        {(status === "loading" ||
          (status === "valid" && authStatus !== "unauthenticated")) && (
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {authStatus === "authenticated" ? "Joining the group…" : "Checking invite…"}
          </CardContent>
        )}

        {status === "invalid" && (
          <>
            <CardHeader>
              <CardTitle>Invite unavailable</CardTitle>
              <CardDescription>
                This invite link is invalid, has expired, or has already been
                used.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/groups">Go to your groups</Link>
              </Button>
            </CardContent>
          </>
        )}

        {/* Valid invite, but the visitor still needs to authenticate. */}
        {status === "valid" && info && authStatus === "unauthenticated" && (
          <>
            <CardHeader>
              <CardTitle>You&apos;re invited</CardTitle>
              <CardDescription>
                <span className="font-medium text-foreground">
                  {info.inviterName}
                </span>{" "}
                invited you to join{" "}
                <span className="font-medium text-foreground">
                  {info.groupName}
                </span>{" "}
                on Fairshare.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button asChild className="w-full" disabled={accepting}>
                <Link href={loginUrl}>Log in to join</Link>
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                New to Fairshare?{" "}
                <Link
                  href={`/register?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
                  className="text-primary hover:underline"
                >
                  Create an account
                </Link>
              </p>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
