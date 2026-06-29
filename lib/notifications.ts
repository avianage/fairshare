import { prisma } from "./prisma"
import { sendPushToUsers } from "./push"

export interface NotificationPayload {
  type: string
  title: string
  body: string
  url?: string
}

export async function notifyUsers(userIds: string[], payload: NotificationPayload) {
  if (userIds.length === 0) return

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, ...payload })),
  })

  void sendPushToUsers(userIds, {
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
  })
}
