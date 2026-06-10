"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { signIn } from "next-auth/react"
import Link from "next/link"
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

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/\d/, "Password must contain at least one number"),
})

type RegisterFields = z.infer<typeof registerSchema>

type PasswordStrength = "weak" | "ok" | "strong"

function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < 8) return "weak"
  const checks = [/\d/, /[A-Z]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length
  if (checks >= 2) return "strong"
  if (checks >= 1) return "ok"
  return "weak"
}

const strengthConfig: Record<
  PasswordStrength,
  { label: string; barClass: string; textClass: string; width: string }
> = {
  weak: {
    label: "Weak",
    barClass: "bg-red-500",
    textClass: "text-red-500",
    width: "w-1/3",
  },
  ok: {
    label: "Fair",
    barClass: "bg-yellow-500",
    textClass: "text-yellow-600",
    width: "w-2/3",
  },
  strong: {
    label: "Strong",
    barClass: "bg-green-500",
    textClass: "text-green-600",
    width: "w-full",
  },
}

function PasswordStrengthBar({ password }: { password: string }) {
  if (!password) return null
  const strength = getPasswordStrength(password)
  const { label, barClass, textClass, width } = strengthConfig[strength]
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full transition-all duration-300 ${barClass} ${width}`} />
      </div>
      <p className={`text-xs ${textClass}`}>Password strength: {label}</p>
    </div>
  )
}

export function RegisterForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFields>({ resolver: zodResolver(registerSchema) })

  const passwordValue = watch("password", "")

  async function onSubmit(data: RegisterFields) {
    setIsLoading(true)
    setServerError(null)

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setServerError(body.error ?? "Registration failed. Please try again.")
      setIsLoading(false)
      return
    }

    // Auto sign-in after successful registration
    const signInResult = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    if (signInResult?.error) {
      // Account created but sign-in failed — send them to login
      router.push("/login")
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>Start splitting expenses with Fairshare</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {serverError && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {serverError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Alice Smith"
              autoComplete="name"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password ? (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            ) : (
              <PasswordStrengthBar password={passwordValue} />
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
