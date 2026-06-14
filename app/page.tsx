import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function RootPage() {
  const session = await auth()
  if (session) redirect("/dashboard")

  const features = [
    {
      icon: "👥",
      title: "Group Expenses",
      desc: "Create shared spaces for trips, households, or projects. Split bills equally or customize by exact amounts, percentages, or shares.",
      color: "from-blue-500/10 to-indigo-500/10",
      iconColor: "text-indigo-500",
    },
    {
      icon: "💸",
      title: "Direct Expenses",
      desc: "Split bills one-on-one instantly. Add friends via a unique invite link and start tracking shared costs without group overhead.",
      color: "from-emerald-500/10 to-teal-500/10",
      iconColor: "text-emerald-500",
    },
    {
      icon: "⚖️",
      title: "Simplified Settlements",
      desc: "Our engine optimizes and simplifies debt networks, reducing total payments so everyone can settle up in a single tap.",
      color: "from-amber-500/10 to-orange-500/10",
      iconColor: "text-amber-500",
    },
  ]

  const extras = [
    { icon: "📊", label: "Spending charts" },
    { icon: "🔔", label: "Activity feed" },
    { icon: "📱", label: "Installable PWA" },
    { icon: "🌙", label: "Dark mode support" },
    { icon: "🔒", label: "Self-hosted & Private" },
    { icon: "🤖", label: "AI expense entry" },
  ]

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground selection:bg-primary/20">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px] dark:bg-primary/5" />
      <div className="pointer-events-none absolute top-1/3 right-1/4 h-[400px] w-[400px] rounded-full bg-success/5 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-10 left-1/3 h-[500px] w-[500px] rounded-full bg-warning/5 blur-[120px]" />

      {/* Nav */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b bg-background/60 px-6 py-4 backdrop-blur-md transition-all">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="Fairshare Logo" className="h-8 w-8 rounded-lg object-contain shadow-sm" />
          <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80">Fairshare</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/95 hover:shadow-md"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-20 pb-12 text-center md:pt-28">
        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/10">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Self-hosted · Open source · PWA
        </span>
        
        <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl leading-tight">
          Split bills fairly. <br />
          <span className="bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">Settle up easily.</span>
        </h1>
        
        <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg leading-relaxed">
          Fairshare lets you track shared expenses in groups or one-on-one, see who owes
          whom across everything, and record settlements — all on your own server.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/95 hover:shadow-xl hover:shadow-primary/25"
          >
            Create an account
          </Link>
          <Link
            href="/login"
            className="rounded-xl border bg-card px-8 py-3.5 text-base font-semibold transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/40 hover:shadow-md"
          >
            Sign in
          </Link>
        </div>

        {/* High-Fidelity App UI Mockup */}
        <div className="mt-16 w-full max-w-4xl px-4 md:mt-24">
          <div className="group relative rounded-2xl border bg-card/65 p-1.5 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-primary/20">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-tr from-primary/10 via-transparent to-success/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative overflow-hidden rounded-[14px] border bg-background text-left shadow-inner">
              {/* Window Controls */}
              <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-destructive/80" />
                <span className="h-3 w-3 rounded-full bg-warning/80" />
                <span className="h-3 w-3 rounded-full bg-success/80" />
                <span className="ml-4 text-xs font-mono text-muted-foreground select-none">fairshare.local/dashboard</span>
              </div>
              
              {/* Simulated App View */}
              <div className="grid gap-6 p-6 md:grid-cols-3">
                {/* Owed card */}
                <div className="rounded-xl border border-success/20 bg-success/5 p-5 transition-all hover:-translate-y-0.5 hover:shadow-sm">
                  <div className="flex items-center justify-between text-xs text-success/80">
                    <span>Total owed to you</span>
                    <span className="rounded bg-success/15 px-1.5 py-0.5 font-bold">📥 Recv</span>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-success tabular-nums">₹14,200.00</p>
                </div>
                
                {/* Owe card */}
                <div className="rounded-xl border border-warning/20 bg-warning/5 p-5 transition-all hover:-translate-y-0.5 hover:shadow-sm">
                  <div className="flex items-center justify-between text-xs text-warning/80">
                    <span>Total you owe</span>
                    <span className="rounded bg-warning/15 px-1.5 py-0.5 font-bold">📤 Pay</span>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-warning tabular-nums">₹3,150.00</p>
                </div>

                {/* Net balance */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 transition-all hover:-translate-y-0.5 hover:shadow-sm">
                  <div className="flex items-center justify-between text-xs text-primary/80">
                    <span>Net balance</span>
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 font-bold">⚖️ Net</span>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-primary tabular-nums">+₹11,050.00</p>
                </div>

                {/* Mock Live Splitting Simulator Widget */}
                <div className="rounded-xl border bg-card p-5 md:col-span-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3.5">
                    <div>
                      <h4 className="font-semibold text-sm">Demo Expense: Weekend Cabin Trip 🏔️</h4>
                      <p className="text-xs text-muted-foreground">Splitting ₹12,000.00 with 4 friends</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">Shares split type</span>
                  </div>
                  
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border bg-muted/20 p-3 text-center">
                      <span className="text-xs font-semibold text-muted-foreground block">Payer (You)</span>
                      <span className="text-sm font-bold block mt-1">₹3,000.00</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">(1 share)</span>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3 text-center">
                      <span className="text-xs font-semibold text-muted-foreground block">Alice</span>
                      <span className="text-sm font-bold block mt-1">₹6,000.00</span>
                      <span className="text-[10px] text-primary font-medium mt-0.5 block">(2 shares)</span>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3 text-center">
                      <span className="text-xs font-semibold text-muted-foreground block">Bob</span>
                      <span className="text-sm font-bold block mt-1">₹3,000.00</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">(1 share)</span>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3 text-center">
                      <span className="text-xs font-semibold text-muted-foreground block">Charlie</span>
                      <span className="text-sm font-bold block mt-1">₹0.00</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">(0 shares)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto w-full max-w-5xl px-6 py-20">
        <h2 className="mb-12 text-center text-3xl font-extrabold tracking-tight">Everything you need to split fairly</h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.color} ${f.iconColor} text-2xl transition-transform duration-300 group-hover:scale-110`} aria-hidden>
                {f.icon}
              </div>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Extras strip */}
      <section className="border-t bg-card/40 px-6 py-12 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-5">
          {extras.map((e) => (
            <span key={e.label} className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              <span aria-hidden>{e.icon}</span>
              {e.label}
            </span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8 text-center text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="order-2 sm:order-1">
            Built with Next.js · Self-hosted, your data stays yours.
          </p>
          <p className="order-1 flex items-center gap-4 sm:order-2">
            <span>
              Built by{" "}
              <a
                href="https://avianage.in"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground underline underline-offset-4 transition-colors hover:text-primary"
              >
                Aakash Joshi
              </a>
            </span>
            <span className="text-border">|</span>
            <a
              href="https://github.com/avianage/fairshare"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:text-foreground underline underline-offset-4"
            >
              GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

