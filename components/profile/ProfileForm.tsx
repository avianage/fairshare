"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { getApiError } from "@/lib/api-error"
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
      toast.error(await getApiError(res, "Could not update profile"))
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
    <Card className="bg-card/65 backdrop-blur-md border border-border/80 shadow-sm overflow-hidden">
      <CardHeader className="border-b bg-muted/5">
        <CardTitle className="text-lg font-bold tracking-tight">Account Profile</CardTitle>
        <CardDescription>Member since {joined}</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              className="bg-background/40 focus-visible:ring-primary/40"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Username</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground text-sm font-medium">@</span>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                className="pl-7 bg-background/40 focus-visible:ring-primary/40 font-medium"
                disabled={!canChangeUsername}
                aria-invalid={!!errors.username}
                {...register("username")}
              />
            </div>
            {errors.username ? (
              <p className="text-xs text-destructive">{errors.username.message}</p>
            ) : !canChangeUsername ? (
              <p className="text-xs text-muted-foreground/80 bg-warning/5 border border-warning/10 rounded-lg p-2.5 mt-1">
                Username can be changed again on <span className="font-semibold text-foreground">{nextChangeDate}</span>.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Can be changed once every 30 days</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address</Label>
            <Input id="email" type="email" value={email} disabled readOnly className="bg-muted/40 text-muted-foreground/80 cursor-not-allowed border-dashed" />
            <p className="text-xs text-muted-foreground/80">
              Email address cannot be changed.
            </p>
          </div>
        </CardContent>

        <CardFooter className="border-t bg-muted/10 px-6 py-4 flex justify-end">
          <Button type="submit" disabled={isLoading || !isDirty} className="bg-primary hover:bg-primary/95 shadow transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]">
            {isLoading ? "Saving…" : "Save changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
