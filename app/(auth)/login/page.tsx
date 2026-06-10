import { LoginForm } from "@/components/auth/LoginForm"

export default function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string }
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <LoginForm callbackUrl={searchParams.callbackUrl ?? "/dashboard"} />
    </div>
  )
}
