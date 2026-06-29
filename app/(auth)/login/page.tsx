import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { LoginForm } from "@/components/auth/LoginForm"

export default function LoginPage({
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
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/50 px-3 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        <LoginForm callbackUrl={searchParams.callbackUrl ?? "/dashboard"} />
      </div>
    </div>
  )
}
