"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
})

type ProfileFields = z.infer<typeof profileSchema>

export function ProfileForm({
  defaultName,
  defaultUsername,
  email,
  memberSince,
  usernameNextChangeAt,
}: {
  defaultName: string
  defaultUsername: string
  email: string
  memberSince: string
  usernameNextChangeAt: string | null
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFields>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: defaultName, username: defaultUsername },
  })

  const canChangeUsername =
    !usernameNextChangeAt || new Date(usernameNextChangeAt) <= new Date()

  async function onSubmit(data: ProfileFields) {
    setIsLoading(true)
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    setIsLoading(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? "Could not update profile")
      return
    }

    toast.success("Profile updated")
    router.refresh()
  }

  const joined = new Date(memberSince).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const nextChangeDate = usernameNextChangeAt
    ? new Date(usernameNextChangeAt).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Member since {joined}</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground text-sm">@</span>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                className="pl-7"
                disabled={!canChangeUsername}
                aria-invalid={!!errors.username}
                {...register("username")}
              />
            </div>
            {errors.username ? (
              <p className="text-xs text-destructive">{errors.username.message}</p>
            ) : !canChangeUsername ? (
              <p className="text-xs text-muted-foreground">
                Username can be changed again on {nextChangeDate}.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Can be changed once every 30 days</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} disabled readOnly />
            <p className="text-xs text-muted-foreground">
              Email can&apos;t be changed.
            </p>
          </div>
        </CardContent>

        <CardFooter>
          <Button type="submit" disabled={isLoading || !isDirty}>
            {isLoading ? "Saving…" : "Save changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
