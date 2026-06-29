import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b bg-background/60 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="Fairshare" className="h-7 w-7 rounded-lg object-contain" />
            <span className="font-bold tracking-tight">Fairshare</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/50 px-3 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
      <footer className="border-t px-6 py-6 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-4">
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <span className="text-border">·</span>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <span className="text-border">·</span>
          <Link href="/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
          <span className="text-border">·</span>
          <Link href="/guidelines" className="hover:text-foreground transition-colors">Guidelines</Link>
        </div>
      </footer>
    </div>
  )
}
