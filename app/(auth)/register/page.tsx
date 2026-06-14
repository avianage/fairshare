import { RegisterForm } from "@/components/auth/RegisterForm"

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string }
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 selection:bg-primary/20">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[450px] w-[450px] -translate-x-1/2 rounded-full bg-primary/10 blur-[110px] dark:bg-primary/5" />
      <div className="pointer-events-none absolute -bottom-40 left-1/2 h-[450px] w-[450px] -translate-x-1/2 rounded-full bg-success/5 blur-[110px]" />
      
      <div className="relative w-full max-w-md">
        <RegisterForm callbackUrl={searchParams.callbackUrl ?? "/dashboard"} />
      </div>
    </div>
  )
}
