import webPush from "web-push"
import { prisma } from "./prisma"

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@fairshare.local",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

export interface PushPayload {
  title: string
  body: string
  url: string
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!process.env.VAPID_PUBLIC_KEY) return

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  })

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webPush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        )
      } catch (err: unknown) {
        if ((err as { statusCode?: number }).statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => null)
        }
      }
    })
  )
}
