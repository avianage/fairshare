import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { directExpenseVisibilityWhere } from "@/lib/directExpenses"
import * as XLSX from "xlsx"

export type StatementItem = {
  type: "expense" | "settlement"
  id: string
  groupName: string | null
  description: string
  amount: number
  date: string
  category?: string
  involvedUsers: { name: string }[]
}

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const { searchParams } = req.nextUrl
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
  const typeFilter = searchParams.get("type") // "expense" | "settlement" | null
  const groupIdFilter = searchParams.get("groupId") // group id | "direct" | null
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined
  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined

  // All groups the user has ever been in (including soft-deleted).
  const allMemberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true, group: { select: { name: true } } },
  })
  const allGroupIds = allMemberships.map((m) => m.groupId)
  const groupNameMap = new Map(allMemberships.map((m) => [m.groupId, m.group.name]))

  const dateRange = from || to
    ? { gte: from, lte: to ? new Date(to.getTime() + 86_400_000 - 1) : undefined }
    : undefined

  const includeGroups = !typeFilter || typeFilter === "expense"
  const includeSettlements = !typeFilter || typeFilter === "settlement"
  const includeGroupTx = !groupIdFilter || groupIdFilter !== "direct"
  const includeDirect = !groupIdFilter || groupIdFilter === "direct"

  const [groupExpenses, groupSettlements, directExpenses, directSettlements] = await Promise.all([
    includeGroups && includeGroupTx && allGroupIds.length
      ? prisma.expense.findMany({
          where: {
            groupId: groupIdFilter && groupIdFilter !== "direct" ? groupIdFilter : { in: allGroupIds },
            deletedAt: null,
            OR: [{ payerId: userId }, { splits: { some: { userId } } }],
            ...(dateRange ? { date: dateRange } : {}),
          },
          select: {
            id: true,
            description: true,
            amount: true,
            date: true,
            category: true,
            groupId: true,
            payer: { select: { name: true } },
            splits: { select: { user: { select: { name: true } } } },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        })
      : Promise.resolve([]),

    includeSettlements && includeGroupTx && allGroupIds.length
      ? prisma.settlement.findMany({
          where: {
            groupId: groupIdFilter && groupIdFilter !== "direct" ? groupIdFilter : { in: allGroupIds },
            OR: [{ senderId: userId }, { receiverId: userId }],
            ...(dateRange ? { createdAt: dateRange } : {}),
          },
          select: {
            id: true,
            amount: true,
            createdAt: true,
            groupId: true,
            sender: { select: { name: true } },
            receiver: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),

    includeGroups && includeDirect
      ? prisma.expense.findMany({
          where: {
            ...directExpenseVisibilityWhere(userId),
            ...(dateRange ? { date: dateRange } : {}),
          },
          select: {
            id: true,
            description: true,
            amount: true,
            date: true,
            category: true,
            payer: { select: { name: true } },
            splits: { select: { user: { select: { name: true } } } },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        })
      : Promise.resolve([]),

    includeSettlements && includeDirect
      ? prisma.settlement.findMany({
          where: {
            groupId: null,
            OR: [{ senderId: userId }, { receiverId: userId }],
            ...(dateRange ? { createdAt: dateRange } : {}),
          },
          select: {
            id: true,
            amount: true,
            createdAt: true,
            sender: { select: { name: true } },
            receiver: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ])

  const items: StatementItem[] = [
    ...groupExpenses.map((e) => ({
      type: "expense" as const,
      id: e.id,
      groupName: e.groupId ? (groupNameMap.get(e.groupId) ?? null) : null,
      description: e.description,
      amount: e.amount.toNumber(),
      date: e.date.toISOString(),
      category: e.category ?? undefined,
      involvedUsers: [{ name: e.payer.name }, ...e.splits.map((s) => ({ name: s.user.name }))],
    })),
    ...directExpenses.map((e) => ({
      type: "expense" as const,
      id: e.id,
      groupName: null,
      description: e.description,
      amount: e.amount.toNumber(),
      date: e.date.toISOString(),
      category: e.category ?? undefined,
      involvedUsers: [{ name: e.payer.name }, ...e.splits.map((s) => ({ name: s.user.name }))],
    })),
    ...groupSettlements.map((s) => ({
      type: "settlement" as const,
      id: s.id,
      groupName: s.groupId ? (groupNameMap.get(s.groupId) ?? null) : null,
      description: `${s.sender.name} paid ${s.receiver.name}`,
      amount: s.amount.toNumber(),
      date: s.createdAt.toISOString(),
      involvedUsers: [{ name: s.sender.name }, { name: s.receiver.name }],
    })),
    ...directSettlements.map((s) => ({
      type: "settlement" as const,
      id: s.id,
      groupName: null,
      description: `${s.sender.name} paid ${s.receiver.name}`,
      amount: s.amount.toNumber(),
      date: s.createdAt.toISOString(),
      involvedUsers: [{ name: s.sender.name }, { name: s.receiver.name }],
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const total = items.length

  if (searchParams.get("format") === "xlsx") {
    const rows = items.map((i) => ({
      Date: new Date(i.date).toLocaleDateString("en-IN"),
      Type: i.type,
      Description: i.description,
      Group: i.groupName ?? "Direct",
      "Amount (₹)": i.amount,
      Involved: [...new Set(i.involvedUsers.map((u) => u.name))].join(", "),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Statement")
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="fairshare-statement.xlsx"',
      },
    })
  }

  if (searchParams.get("format") === "csv") {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
    const rows = [
      ["Date", "Type", "Description", "Group", "Amount (₹)", "Involved"].join(","),
      ...items.map((i) =>
        [
          escape(new Date(i.date).toLocaleDateString("en-IN")),
          escape(i.type),
          escape(i.description),
          escape(i.groupName ?? "Direct"),
          i.amount.toFixed(2),
          escape([...new Set(i.involvedUsers.map((u) => u.name))].join("; ")),
        ].join(",")
      ),
    ].join("\r\n")
    return new Response(rows, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="fairshare-statement.csv"',
      },
    })
  }

  const paginated = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  return NextResponse.json({ items: paginated, total, page, pageSize: PAGE_SIZE })
}
