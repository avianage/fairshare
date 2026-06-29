"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
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

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
})

type LoginFields = z.infer<typeof loginSchema>

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter()
  const [authError, setAuthError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFields>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginFields) {
    setIsLoading(true)
    setAuthError(null)

    const result = await signIn("credentials", {
      identifier: data.identifier,
      password: data.password,
      redirect: false,
    })

    if (result?.error) {
      // Generic message — never reveal which field was wrong
      setAuthError("Invalid email or password")
      setIsLoading(false)
      return
    }

    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md border-border/40 bg-card/75 backdrop-blur-lg shadow-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-indigo-500 to-primary/80" />
      <CardHeader className="space-y-1 pt-6">
        <div className="flex items-center gap-2 mb-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="Logo" className="h-6 w-6 rounded object-contain shadow-sm" />
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Fairshare</span>
        </div>
        <CardTitle className="text-2xl font-extrabold tracking-tight">Welcome back</CardTitle>
        <CardDescription>Sign in to your Fairshare account</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {authError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {authError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="identifier" className="text-xs font-medium text-muted-foreground">Email or Username</Label>
            <Input
              id="identifier"
              type="text"
              placeholder="@username or email-address"
              autoComplete="username"
              className="bg-background/50 focus:bg-background transition-all"
              aria-invalid={!!errors.identifier}
              {...register("identifier")}
            />
            {errors.identifier && (
              <p className="text-xs text-destructive">{errors.identifier.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="pr-10 bg-background/50 focus:bg-background transition-all"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 pb-6">
          <Button type="submit" className="w-full font-semibold transition-all hover:bg-primary/95 hover:shadow-md" disabled={isLoading}>
            {isLoading ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Don&apos;t have an account?{" "}
            <Link
              href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="font-medium text-primary hover:underline"
            >
              Create one
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
