import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { ThemeToggle } from "@/components/ThemeToggle"

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
    { icon: "🔔", label: "Push notifications" },
    { icon: "📱", label: "Installable PWA" },
    { icon: "🌙", label: "Dark mode support" },
    { icon: "🔒", label: "Secure & Private" },
    { icon: "🤖", label: "AI expense entry" },
  ]

  const navItems = ["Dashboard", "Groups", "Personal", "Budgets", "Ledger", "Statement", "Insights", "Friends", "Profile"]

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground selection:bg-primary/20">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px] dark:bg-primary/5" />
      <div className="pointer-events-none absolute top-1/3 right-1/4 h-[400px] w-[400px] rounded-full bg-success/5 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-10 left-1/3 h-[500px] w-[500px] rounded-full bg-warning/5 blur-[120px]" />

      {/* Nav */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b bg-background/60 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur-md transition-all">
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="Fairshare Logo" className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg object-contain shadow-sm" />
          <span className="hidden min-[360px]:inline text-lg sm:text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80">Fairshare</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="w-20 sm:w-28 inline-flex h-8 sm:h-9 items-center justify-center rounded-xl border border-border bg-background text-xs sm:text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-95 shadow-sm"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="w-20 sm:w-28 inline-flex h-8 sm:h-9 items-center justify-center rounded-xl bg-primary text-xs sm:text-sm font-medium text-primary-foreground transition-all duration-200 hover:bg-primary/95 hover:shadow-md active:scale-95 shadow-sm"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-20 pb-12 text-center md:pt-28">
        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/10">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Open source · Alpha · PWA
        </span>

        <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl leading-tight">
          Split bills fairly. <br />
          <span className="bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">Settle up easily.</span>
        </h1>

        <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg leading-relaxed">
          Fairshare lets you track shared expenses in groups or one-on-one, see who owes
          whom across everything, and record settlements with a single tap.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="w-48 inline-flex h-12 items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/95 hover:shadow-xl hover:shadow-primary/30 active:scale-95"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="w-48 inline-flex h-12 items-center justify-center rounded-xl border border-border bg-background/50 backdrop-blur-sm text-base font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/40 hover:shadow-md active:scale-95"
          >
            Sign in
          </Link>
        </div>

        {/* Dashboard Mockup */}
        <div className="mt-16 w-full max-w-5xl px-4 md:mt-24">
          <div className="group relative rounded-2xl border bg-card/65 p-1.5 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-primary/20">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-tr from-primary/10 via-transparent to-success/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative overflow-hidden rounded-[14px] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0f1117] text-left shadow-inner">

              {/* Browser chrome */}
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/8 bg-slate-100 dark:bg-white/5 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-red-500/70" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
                <span className="h-3 w-3 rounded-full bg-green-500/70" />
                <span className="ml-4 text-xs font-mono text-slate-400 dark:text-white/30 select-none">fairshare.avianage.in/dashboard</span>
              </div>

              {/* App shell */}
              <div className="flex min-h-[420px]">

                {/* Sidebar — hidden on small screens */}
                <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-slate-200 dark:border-white/8 bg-slate-100 dark:bg-[#0c0e14] px-2 py-4 gap-1">
                  {/* Logo */}
                  <div className="flex items-center gap-2 px-3 py-2 mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icon.png" alt="" className="h-6 w-6 rounded-md" />
                    <span className="font-bold text-sm text-slate-800 dark:text-white">Fairshare</span>
                  </div>
                  {navItems.map((item) => (
                    <div
                      key={item}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${item === "Dashboard"
                          ? "bg-primary/10 dark:bg-primary/15 text-primary"
                          : "text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white"
                        }`}
                    >
                      <span className="h-3.5 w-3.5 rounded-sm bg-current opacity-60" />
                      {item}
                    </div>
                  ))}
                  {/* User row */}
                  <div className="mt-auto flex items-center gap-2 border-t border-slate-200 dark:border-white/8 px-3 pt-4">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">M</div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700 dark:text-white/70">Marcus Webb</p>
                      <p className="text-[9px] text-slate-400 dark:text-white/30">marcus@example.com</p>
                    </div>
                  </div>
                </aside>

                {/* Main content */}
                <main className="flex-1 overflow-hidden p-5">
                  {/* Top bar */}
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Dashboard</h2>
                      <p className="text-[11px] text-slate-500 dark:text-white/40">Your balances across all groups.</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500 dark:text-white/35">
                      <span>Marcus Webb</span>
                      <span className="h-5 w-5 rounded-full border border-slate-200 dark:border-white/10 flex items-center justify-center text-[10px]">🔔</span>
                      <span className="h-5 w-5 rounded-full border border-slate-200 dark:border-white/10 flex items-center justify-center text-[10px]">☀️</span>
                      <span className="rounded-md border border-slate-200 dark:border-white/10 px-2 py-0.5">Sign out</span>
                    </div>
                  </div>

                  {/* Balance cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="rounded-xl border-t-2 border-t-green-500 bg-white dark:bg-white/5 border-x border-b border-slate-200 dark:border-x-transparent dark:border-b-transparent p-3 shadow-sm dark:shadow-none">
                      <p className="text-[10px] text-slate-500 dark:text-white/45 leading-tight">Total owed to you</p>
                      <p className="mt-1.5 text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">₹3,240.00</p>
                    </div>
                    <div className="rounded-xl border-t-2 border-t-amber-500 bg-white dark:bg-white/5 border-x border-b border-slate-200 dark:border-x-transparent dark:border-b-transparent p-3 shadow-sm dark:shadow-none">
                      <p className="text-[10px] text-slate-500 dark:text-white/45 leading-tight">Total you owe</p>
                      <p className="mt-1.5 text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">₹1,875.50</p>
                    </div>
                    <div className="rounded-xl border-t-2 border-t-indigo-500 bg-white dark:bg-white/5 border-x border-b border-slate-200 dark:border-x-transparent dark:border-b-transparent p-3 shadow-sm dark:shadow-none">
                      <p className="text-[10px] text-slate-500 dark:text-white/45 leading-tight">Net balance</p>
                      <p className="mt-1.5 text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">+₹1,364.50</p>
                    </div>
                  </div>

                  {/* Budget card */}
                  <div className="mt-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent p-4 shadow-sm dark:shadow-none">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">🐷</span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-white/70">Monthly Budget</span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-white/30">View →</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">₹8,430.00</p>
                      <p className="text-[10px] text-slate-500 dark:text-white/35">of ₹15,000.00</p>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                      <div className="h-full w-[44%] rounded-full bg-gradient-to-r from-primary to-indigo-500" />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-white/35">56% remaining</p>
                  </div>

                  {/* Groups */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-3.5 transition-all duration-300 hover:border-primary/20 dark:hover:border-white/20 shadow-sm dark:shadow-none">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-sm" aria-hidden>🏖️</span>
                        <span className="truncate text-xs font-semibold text-slate-800 dark:text-white/90">Weekend Crew</span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                        <span className="rounded bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 text-slate-500 dark:text-white/50 font-medium">
                          4 members
                        </span>
                        <span className="rounded bg-slate-100 dark:bg-white/10 px-2 py-0.5 font-semibold text-slate-500 dark:text-white/50">
                          Settled up
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col rounded-xl border border-slate-200 dark:border-y-white/10 dark:border-r-white/10 border-l-4 border-l-amber-500 bg-white dark:bg-white/5 p-3.5 transition-all duration-300 hover:border-primary/20 dark:hover:border-white/20 shadow-sm dark:shadow-none">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-sm" aria-hidden>🏠</span>
                        <span className="truncate text-xs font-semibold text-slate-800 dark:text-white/90">Koregaon Flatmates</span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                        <span className="rounded bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 text-slate-500 dark:text-white/50 font-medium">
                          3 members
                        </span>
                        <span className="rounded bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
                          You owe ₹1,875.50
                        </span>
                      </div>
                    </div>
                  </div>
                </main>
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

      {/* Coming soon teaser */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-16">
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-indigo-500/5 p-8 text-center shadow-sm">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/8 blur-[80px]" />
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Early Alpha
          </span>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight">More powerful features on the way</h3>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground leading-relaxed">
            Fairshare is actively being built. Dynamic currency conversion, personalised financial insights, budgets, statements, and a full personal finance suite are coming soon.
          </p>
          <div className="mt-6 grid grid-cols-1 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center gap-3 max-w-[280px] min-[420px]:max-w-md sm:max-w-none mx-auto">
            {[
              { icon: "💱", label: "Currency conversion" },
              { icon: "📈", label: "Financial insights" },
              { icon: "📄", label: "Statements & reports" },
              { icon: "🗂️", label: "Budget tracking" },
            ].map((item) => (
              <span
                key={item.label}
                className="w-full sm:w-auto inline-flex items-center justify-start sm:justify-center gap-3 pl-8 pr-4 sm:px-4 py-2.5 text-xs font-medium text-muted-foreground rounded-full border border-border/60 bg-card/80 whitespace-nowrap"
              >
                <span className="text-sm" aria-hidden>{item.icon}</span>
                <span>{item.label}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 bg-card/15 px-6 pt-16 pb-8 backdrop-blur-md relative mt-16">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
        <div className="mx-auto max-w-5xl">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12">

            {/* Column 1: Brand & Tagline */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left gap-4 md:col-span-2">
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.png" alt="Fairshare Logo" className="h-6 w-6 rounded-lg object-contain shadow-sm" />
                <span className="text-lg font-bold tracking-tight text-foreground">Fairshare</span>
              </div>
              <p className="max-w-xs text-sm text-muted-foreground leading-relaxed">
                Split expenses fairly, optimize debt networks, and settle up with friends or groups instantly.
              </p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mt-1">
                <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success border border-success/10">
                  Active Dev
                </span>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/10">
                  Open Source
                </span>
              </div>
            </div>

            {/* Column 2: Capabilities */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left gap-3.5">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">Capabilities</span>
              <ul className="space-y-2.5 text-sm text-muted-foreground flex flex-col items-start mx-auto md:mx-0 w-fit">
                {extras.map((e) => (
                  <li key={e.label} className="flex items-center gap-2">
                    <span className="text-base" aria-hidden>{e.icon}</span>
                    <span>{e.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Legal & Resources */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left gap-3.5">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">Legal</span>
              <ul className="space-y-2.5 text-sm text-muted-foreground flex flex-col items-center md:items-start">
                <li><Link href="/terms" className="transition-colors hover:text-foreground">Terms of Service</Link></li>
                <li><Link href="/privacy" className="transition-colors hover:text-foreground">Privacy Policy</Link></li>
                <li><Link href="/cookies" className="transition-colors hover:text-foreground">Cookie Policy</Link></li>
                <li><Link href="/guidelines" className="transition-colors hover:text-foreground">Community Guidelines</Link></li>
              </ul>
            </div>

          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/20 pt-8 text-xs text-muted-foreground/60">
            <p>Built with Next.js &middot; Open source.</p>
            <p className="flex items-center gap-4">
              <span>
                Built by{" "}
                <a
                  href="https://avianage.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-foreground underline underline-offset-4 decoration-border/60 hover:text-primary hover:decoration-primary/60 transition-colors"
                >
                  Aakash Joshi
                </a>
              </span>
              <span className="text-border/40">|</span>
              <a
                href="https://github.com/avianage/fairshare"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-foreground underline underline-offset-4 decoration-border/60 hover:text-primary hover:decoration-primary/60 transition-colors"
              >
                GitHub
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
