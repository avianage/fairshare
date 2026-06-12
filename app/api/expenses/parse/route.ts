import { NextRequest, NextResponse } from "next/server"
import type Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { anthropic, NLP_MODEL } from "@/lib/anthropic"
import { rateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"

const MAX_TEXT = 500

// We accept the client's text only. `knownParticipants` is built server-side
// from the user's real relationships — never trusted from the client (prevents
// ID injection / leaking arbitrary user IDs into the prompt).
const bodySchema = z.object({
  text: z.string().min(1).max(2000),
})

// Shape Claude must return. Validated before it ever reaches the client.
const parsedSchema = z.object({
  description: z.string().max(200).nullable().catch(null),
  amount: z.number().positive().max(999999.99).nullable().catch(null),
  payerId: z.string().nullable().catch(null),
  participantIds: z.array(z.string()).catch([]),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .catch(null),
  splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE", "SHARES"]).catch("EQUAL"),
  confidence: z.enum(["high", "medium", "low"]).catch("low"),
})

// Strip HTML tags + control chars, collapse whitespace, hard-cap length.
function sanitize(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT)
}

// The user's known contacts: group co-members + people from past direct expenses.
async function knownParticipants(userId: string) {
  const [memberships, directCo] = await Promise.all([
    prisma.groupMember.findMany({ where: { userId }, select: { groupId: true } }),
    prisma.directParticipant.findMany({
      where: { expense: { groupId: null, participants: { some: { userId } } } },
      select: { userId: true },
    }),
  ])
  const groupIds = memberships.map((m) => m.groupId)
  const coMembers = groupIds.length
    ? await prisma.groupMember.findMany({
        where: { groupId: { in: groupIds }, userId: { not: userId } },
        select: { userId: true },
      })
    : []

  const ids = new Set<string>([
    ...coMembers.map((m) => m.userId),
    ...directCo.map((p) => p.userId),
  ])
  ids.delete(userId)
  if (ids.size === 0) return []

  return prisma.user.findMany({
    where: { id: { in: Array.from(ids) } },
    select: { id: true, name: true },
  })
}

function systemPrompt(
  today: string,
  participants: { id: string; name: string }[],
  currentUserId: string
) {
  return `You are a parser for an expense splitting app. Extract structured data from the user's natural language input. Today's date is ${today}.

The current user's id is "${currentUserId}". Known participants (name -> id mapping), as JSON:
${JSON.stringify(participants)}

Return ONLY valid JSON in this exact shape:
{
  "description": "string",
  "amount": number,
  "payerId": "string | null",
  "participantIds": ["string"],
  "date": "YYYY-MM-DD | null",
  "splitType": "EQUAL",
  "confidence": "high | medium | low"
}

Rules:
- If amount is ambiguous, return null for amount.
- Match participant names case-insensitively; partial match is fine.
- If the user says "I paid" or "paid by me", payerId is the current user's id.
- Always include the payer in participantIds. Include the current user when they are involved.
- Never invent participant IDs not in the known list (the current user's id is always allowed).
- splitType is always "EQUAL" unless the user explicitly specifies otherwise.
- If confidence is low, still return your best guess.
- Output JSON only — no prose, no code fences.`
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  // Per-USER rate limit (10/min) in addition to the per-IP middleware cap.
  const rl = rateLimit(`nlp-parse:user:${userId}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfter },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    )
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Natural-language parsing is not configured" },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Could not parse" }, { status: 422 })
  }

  const text = sanitize(parsed.data.text)
  if (text.length === 0) {
    return NextResponse.json({ error: "Could not parse" }, { status: 422 })
  }

  const participants = await knownParticipants(userId)
  const today = new Date().toISOString().slice(0, 10)

  let raw: string
  try {
    const message = await anthropic.messages.create({
      model: NLP_MODEL,
      max_tokens: 512,
      system: systemPrompt(today, participants, userId),
      // NOTE: never log `text` — it's user content (privacy).
      messages: [{ role: "user", content: text }],
    })
    raw = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
  } catch {
    // Don't leak provider errors or the input.
    return NextResponse.json({ error: "Could not parse" }, { status: 422 })
  }

  // Claude may wrap JSON in stray text/fences — extract the first {...} block.
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) {
    return NextResponse.json({ error: "Could not parse" }, { status: 422 })
  }

  let json: unknown
  try {
    json = JSON.parse(match[0])
  } catch {
    return NextResponse.json({ error: "Could not parse" }, { status: 422 })
  }

  const result = parsedSchema.safeParse(json)
  if (!result.success) {
    return NextResponse.json({ error: "Could not parse" }, { status: 422 })
  }

  // Defense in depth: drop any participant/payer id the model invented.
  const allowedIds = new Set([userId, ...participants.map((p) => p.id)])
  const cleaned = {
    ...result.data,
    payerId:
      result.data.payerId && allowedIds.has(result.data.payerId)
        ? result.data.payerId
        : null,
    participantIds: result.data.participantIds.filter((id) => allowedIds.has(id)),
  }

  // Resolve matched ids → names (server-side only) so the client can prefill
  // the participant chips without exposing the full contact list.
  const nameById = new Map(participants.map((p) => [p.id, p.name]))
  const matchedParticipants = cleaned.participantIds
    .filter((id) => id !== userId)
    .map((id) => ({ id, name: nameById.get(id) ?? "" }))

  return NextResponse.json({ parsed: cleaned, matchedParticipants })
}
