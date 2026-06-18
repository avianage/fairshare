"use client"

import { useState } from "react"
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

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/\d/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })

type PasswordFields = z.infer<typeof passwordSchema>

export function PasswordForm() {
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFields>({ resolver: zodResolver(passwordSchema) })

  async function onSubmit(data: PasswordFields) {
    setIsLoading(true)
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }),
    })
    setIsLoading(false)

    if (!res.ok) {
      toast.error(await getApiError(res, "Could not change password"))
      return
    }

    toast.success("Password changed")
    reset()
  }

  return (
    <Card className="bg-card/65 backdrop-blur-md border border-border/80 shadow-sm overflow-hidden">
      <CardHeader className="border-b bg-muted/5">
        <CardTitle className="text-lg font-bold tracking-tight">Security &amp; Password</CardTitle>
        <CardDescription>
          You&apos;ll need your current password to set a new one.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              className="bg-background/40 focus-visible:ring-primary/40"
              aria-invalid={!!errors.currentPassword}
              {...register("currentPassword")}
            />
            {errors.currentPassword && (
              <p className="text-xs text-destructive mt-1">
                {errors.currentPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              className="bg-background/40 focus-visible:ring-primary/40"
              aria-invalid={!!errors.newPassword}
              {...register("newPassword")}
            />
            {errors.newPassword && (
              <p className="text-xs text-destructive mt-1">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="bg-background/40 focus-visible:ring-primary/40"
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive mt-1">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="border-t bg-muted/10 px-6 py-4 flex justify-end">
          <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/95 shadow transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]">
            {isLoading ? "Changing…" : "Change password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
