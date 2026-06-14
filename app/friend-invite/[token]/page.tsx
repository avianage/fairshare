"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Status = "loading" | "valid" | "invalid" | "expired"

export default function FriendInvitePage({ params }: { params: { token: string } }) {
  const { token } = params
  const router = useRouter()
  const { status: authStatus } = useSession()

  const [status, setStatus] = useState<Status>("loading")
  const [inviterName, setInviterName] = useState<string | null>(null)
  const [result, setResult] = useState<"added" | "alreadyFriends" | "self" | null>(null)
  const autoAccepted = useRef(false)

  const loginUrl = `/login?callbackUrl=${encodeURIComponent(`/friend-invite/${token}`)}`

  // Public preview
  useEffect(() => {
    let cancelled = false
    fetch(`/api/friend-invite/${token}`)
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) { setStatus("invalid"); return }
        const d = await res.json()
        setInviterName(d.inviterName)
        setStatus("valid")
      })
      .catch(() => { if (!cancelled) setStatus("invalid") })
    return () => { cancelled = true }
  }, [token])

  const accept = useCallback(async () => {
    const res = await fetch(`/api/friend-invite/${token}`, { method: "POST" })
    if (res.status === 401) { router.push(loginUrl); return }
    if (res.status === 404) { setStatus("invalid"); return }
    const d = await res.json().catch(() => null)
    if (res.status === 409 && d?.error === "self") { setResult("self"); return }
    if (d?.alreadyFriends) { setResult("alreadyFriends"); return }
    setResult("added")
  }, [token, router, loginUrl])

  // Auto-accept once valid + authenticated
  useEffect(() => {
    if (status === "valid" && authStatus === "authenticated" && !autoAccepted.current) {
      autoAccepted.current = true
      accept()
    }
  }, [status, authStatus, accept])

  // Redirect to /friends after a short pause on success
  useEffect(() => {
    if (result === "added" || result === "alreadyFriends") {
      const t = setTimeout(() => router.push("/friends"), 1800)
      return () => clearTimeout(t)
    }
  }, [result, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">

        {/* Loading / accepting */}
        {(status === "loading" || (status === "valid" && authStatus !== "unauthenticated" && !result)) && (
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {authStatus === "authenticated" ? "Adding friend…" : "Checking invite…"}
          </CardContent>
        )}

        {/* Invalid / expired */}
        {status === "invalid" && (
          <>
            <CardHeader>
              <CardTitle>Invite unavailable</CardTitle>
              <CardDescription>
                This invite link is invalid or has expired. Ask {inviterName ?? "them"} to share a new one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline"><Link href="/friends">Go to Friends</Link></Button>
            </CardContent>
          </>
        )}

        {/* Self */}
        {result === "self" && (
          <>
            <CardHeader>
              <CardTitle>That&apos;s your own link</CardTitle>
              <CardDescription>You can&apos;t add yourself as a friend. Share the link with someone else.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline"><Link href="/friends">Go to Friends</Link></Button>
            </CardContent>
          </>
        )}

        {/* Already friends */}
        {result === "alreadyFriends" && (
          <>
            <CardHeader>
              <CardTitle>Already friends!</CardTitle>
              <CardDescription>You&apos;re already friends with {inviterName}. Redirecting…</CardDescription>
            </CardHeader>
          </>
        )}

        {/* Successfully added */}
        {result === "added" && (
          <>
            <CardHeader>
              <CardTitle>Friend added! 🎉</CardTitle>
              <CardDescription>
                You and {inviterName} are now friends on Fairshare. Redirecting…
              </CardDescription>
            </CardHeader>
          </>
        )}

        {/* Valid invite, unauthenticated visitor */}
        {status === "valid" && inviterName && authStatus === "unauthenticated" && !result && (
          <>
            <CardHeader>
              <CardTitle>Friend request</CardTitle>
              <CardDescription>
                <span className="font-medium text-foreground">{inviterName}</span> wants to add you as a friend on Fairshare.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full">
                <Link href={loginUrl}>Log in to accept</Link>
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                New to Fairshare?{" "}
                <Link
                  href={`/register?callbackUrl=${encodeURIComponent(`/friend-invite/${token}`)}`}
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
