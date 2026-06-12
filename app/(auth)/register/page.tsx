import { RegisterForm } from "@/components/auth/RegisterForm"

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string }
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <RegisterForm callbackUrl={searchParams.callbackUrl ?? "/dashboard"} />
    </div>
  )
}
