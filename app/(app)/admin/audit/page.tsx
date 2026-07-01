import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, ShieldAlert } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AuditLogTable } from "@/components/admin/AuditLogTable"
import { MuteAlertsToggle } from "@/components/admin/MuteAlertsToggle"

export const metadata = { title: "Audit Log · Fairshare" }

export default async function AuditLogPage(
  props: {
    searchParams: Promise<{ page?: string; action?: string; suspicious?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const session = await auth()
  if (!session?.user?.id || !session.user.isAdmin) redirect("/dashboard")

  const page = Math.max(1, parseInt(searchParams.page ?? "1"))
  const limit = 50
  const action = searchParams.action ?? undefined
  const suspicious = searchParams.suspicious === "true" ? true : undefined

  const where = {
    ...(action ? { action: { contains: action } } : {}),
    ...(suspicious !== undefined ? { suspicious } : {}),
  }

  const [logs, total, currentUser] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, actorId: true, action: true, targetId: true, meta: true, ip: true, suspicious: true, createdAt: true },
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { muteSecurityAlerts: true } }),
  ])

  const actorIds = [...new Set(logs.map((l) => l.actorId).filter(Boolean))] as string[]
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
    : []
  const actorMap = Object.fromEntries(actors.map((a) => [a.id, a]))
  const richLogs = logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString(), actor: l.actorId ? (actorMap[l.actorId] ?? null) : null }))

  const suspiciousCount = await prisma.auditLog.count({ where: { suspicious: true } })

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <Link
          href="/admin"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Admin
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              All significant actions across the platform.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {suspiciousCount > 0 && (
              <Link
                href="/admin/audit?suspicious=true"
                className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors self-start sm:self-auto"
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{suspiciousCount} suspicious</span>
              </Link>
            )}
            <MuteAlertsToggle initialMuted={currentUser?.muteSecurityAlerts ?? false} />
          </div>
        </div>
      </div>

      <AuditLogTable
        logs={richLogs}
        total={total}
        page={page}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        currentAction={action}
        showingSuspicious={suspicious === true}
      />
    </div>
  )
}
