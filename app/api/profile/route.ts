import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores")
    .optional(),
})

const USERNAME_COOLDOWN_DAYS = 30

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = updateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { name } = parsed.data
  const username = parsed.data.username?.toLowerCase()
  const updateData: Record<string, unknown> = { name }

  if (username !== undefined) {
    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { username: true, usernameChangedAt: true },
    })

    if (current?.username !== username) {
      if (current?.usernameChangedAt) {
        const daysSince =
          (Date.now() - current.usernameChangedAt.getTime()) / (1000 * 60 * 60 * 24)
        if (daysSince < USERNAME_COOLDOWN_DAYS) {
          const daysLeft = Math.ceil(USERNAME_COOLDOWN_DAYS - daysSince)
          return NextResponse.json(
            { error: `You can change your username again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}` },
            { status: 429 }
          )
        }
      }

      const taken = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      })
      if (taken) {
        return NextResponse.json({ error: "This username is already taken" }, { status: 409 })
      }

      updateData.username = username
      updateData.usernameChangedAt = new Date()
    }
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: { id: true, name: true, username: true, email: true },
  })

  return NextResponse.json(user)
}
