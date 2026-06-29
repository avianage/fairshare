import { prisma } from "./prisma"
import { notifyUsers } from "./notifications"

export interface AuditEntry {
  actorId?: string
  action: string
  targetId?: string
  meta?: Record<string, unknown>
  ip?: string
}

const SUSPICIOUS_THRESHOLDS = {
  "login.failure": { window: 10 * 60 * 1000, count: 5 },
  "expense.delete": { window: 60 * 1000, count: 1, checkAge: true },
  "expense.create": { window: 60 * 1000, count: 5 },
  "forbidden": { window: 5 * 60 * 1000, count: 3 },
} as const

async function isSuspicious(entry: AuditEntry): Promise<boolean> {
  const { action, actorId, ip, targetId } = entry
  const since = new Date()

  if (action === "login.failure") {
    const window = SUSPICIOUS_THRESHOLDS["login.failure"].window
    since.setTime(Date.now() - window)

    // 5+ failures from same IP in 10 min
    if (ip) {
      const ipCount = await prisma.auditLog.count({
        where: { action: "login.failure", ip, createdAt: { gte: since } },
      })
      if (ipCount >= 4) return true
    }
    // 3+ failures on same account in 10 min
    if (actorId) {
      const userCount = await prisma.auditLog.count({
        where: { action: "login.failure", actorId, createdAt: { gte: since } },
      })
      if (userCount >= 2) return true
    }
  }

  if (action === "expense.delete" && targetId) {
    // Deleted within 60s of creation
    const expense = await prisma.expense.findUnique({
      where: { id: targetId },
      select: { createdAt: true },
    })
    if (expense && Date.now() - expense.createdAt.getTime() < 60_000) return true
  }

  if (action === "expense.create" && actorId) {
    // 5+ expenses created in 60s
    since.setTime(Date.now() - SUSPICIOUS_THRESHOLDS["expense.create"].window)
    const count = await prisma.auditLog.count({
      where: { action: "expense.create", actorId, createdAt: { gte: since } },
    })
    if (count >= 4) return true
  }

  if (action === "forbidden" && actorId) {
    since.setTime(Date.now() - SUSPICIOUS_THRESHOLDS["forbidden"].window)
    const count = await prisma.auditLog.count({
      where: { action: "forbidden", actorId, createdAt: { gte: since } },
    })
    if (count >= 2) return true
  }

  return false
}

export async function auditLog(entry: AuditEntry) {
  try {
    const suspicious = await isSuspicious(entry)

    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetId: entry.targetId,
        meta: entry.meta ?? {},
        ip: entry.ip,
        suspicious,
      },
    })

    // Push-notify all admins when something suspicious is detected
    if (suspicious) {
      const admins = await prisma.user.findMany({
        where: { isAdmin: true },
        select: { id: true },
      })
      const adminIds = admins.map((a) => a.id).filter((id) => id !== entry.actorId)
      if (adminIds.length > 0) {
        await notifyUsers(adminIds, {
          type: "security_alert",
          title: "Suspicious activity detected",
          body: `Action: ${entry.action}${entry.ip ? ` from ${entry.ip}` : ""}`,
          url: "/admin/audit",
        })
      }
    }
  } catch {
    // Audit logging must never crash the caller
  }
}

export function getClientIp(request: Request): string {
  const headers = request as unknown as { headers: { get: (k: string) => string | null } }
  return (
    headers.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    headers.headers.get("x-real-ip") ??
    "unknown"
  )
}
