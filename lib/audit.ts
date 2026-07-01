import { Prisma } from "@prisma/client"
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
  "expense.delete": { fastWindow: 60 * 1000, repeatWindow: 10 * 60 * 1000 },
  "expense.create": { window: 60 * 1000, count: 5 },
  "forbidden": { window: 5 * 60 * 1000, count: 3 },
} as const

type SuspicionResult = { suspicious: boolean; extraMeta?: Record<string, unknown> }

/**
 * A delete is only interesting if it happened fast (<60s after creation) AND
 * wasn't done by the person who created it — a user fixing their own typo by
 * deleting-and-redoing an expense they just added is normal, not suspicious.
 * The original creator is looked up via the `expense.create` audit row for
 * this expense (there's no createdById column on Expense).
 */
async function isFastNonSelfDelete(entry: AuditEntry): Promise<boolean> {
  const { actorId, targetId } = entry
  if (!targetId || !actorId) return false

  const expense = await prisma.expense.findUnique({
    where: { id: targetId },
    select: { createdAt: true },
  })
  if (!expense) return false
  if (Date.now() - expense.createdAt.getTime() >= SUSPICIOUS_THRESHOLDS["expense.delete"].fastWindow) {
    return false
  }

  const createEntry = await prisma.auditLog.findFirst({
    where: { action: "expense.create", targetId },
    orderBy: { createdAt: "asc" },
    select: { actorId: true },
  })

  return !!createEntry && createEntry.actorId !== actorId
}

async function isSuspicious(entry: AuditEntry): Promise<SuspicionResult> {
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
      if (ipCount >= 4) return { suspicious: true }
    }
    // 3+ failures on same account in 10 min
    if (actorId) {
      const userCount = await prisma.auditLog.count({
        where: { action: "login.failure", actorId, createdAt: { gte: since } },
      })
      if (userCount >= 2) return { suspicious: true }
    }
  }

  if (action === "expense.delete" && targetId) {
    const fastNonSelf = await isFastNonSelfDelete(entry)
    if (!fastNonSelf) return { suspicious: false, extraMeta: { fastNonSelf: false } }

    // Not suspicious on its own — only when it's a repeat pattern by the same
    // actor within the last 10 minutes (a single fast non-self delete happens
    // legitimately, e.g. a group admin cleaning up an obvious duplicate).
    since.setTime(Date.now() - SUSPICIOUS_THRESHOLDS["expense.delete"].repeatWindow)
    const priorCount = await prisma.auditLog.count({
      where: {
        action: "expense.delete",
        actorId,
        createdAt: { gte: since },
        meta: { path: ["fastNonSelf"], equals: true },
      },
    })
    return { suspicious: priorCount >= 1, extraMeta: { fastNonSelf: true } }
  }

  if (action === "expense.create" && actorId) {
    // 5+ expenses created in 60s
    since.setTime(Date.now() - SUSPICIOUS_THRESHOLDS["expense.create"].window)
    const count = await prisma.auditLog.count({
      where: { action: "expense.create", actorId, createdAt: { gte: since } },
    })
    if (count >= 4) return { suspicious: true }
  }

  if (action === "forbidden" && actorId) {
    since.setTime(Date.now() - SUSPICIOUS_THRESHOLDS["forbidden"].window)
    const count = await prisma.auditLog.count({
      where: { action: "forbidden", actorId, createdAt: { gte: since } },
    })
    if (count >= 2) return { suspicious: true }
  }

  return { suspicious: false }
}

export async function auditLog(entry: AuditEntry) {
  try {
    const { suspicious, extraMeta } = await isSuspicious(entry)

    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetId: entry.targetId,
        meta: { ...entry.meta, ...extraMeta } as Prisma.InputJsonValue,
        ip: entry.ip,
        suspicious,
      },
    })

    // Push-notify all admins when something suspicious is detected
    if (suspicious) {
      const admins = await prisma.user.findMany({
        where: { isAdmin: true, muteSecurityAlerts: false },
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
