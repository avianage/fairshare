import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { mkdir, writeFile, unlink } from "node:fs/promises"
import path from "node:path"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ForbiddenError, requireGroupMember } from "@/lib/auth-helpers"
import {
  MAX_RECEIPT_BYTES,
  sniffImageType,
  uploadDir,
  resolveUploadPath,
} from "@/lib/uploads"

type Params = { params: { groupId: string; expenseId: string } }

// Load the (non-deleted) expense and the caller's role; authorize payer-or-admin.
// Returns a NextResponse on failure, or the expense + role on success.
async function authorize(groupId: string, expenseId: string, userId: string) {
  let membership
  try {
    membership = await requireGroupMember(groupId, userId)
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
    }
    throw e
  }

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, groupId, deletedAt: null },
    select: { id: true, payerId: true, receiptUrl: true },
  })
  if (!expense) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  }

  const isPayer = expense.payerId === userId
  const isAdmin = membership.role === "ADMIN"
  if (!isPayer && !isAdmin) {
    return {
      error: NextResponse.json(
        { error: "Only the payer or a group admin can manage the receipt" },
        { status: 403 }
      ),
    }
  }
  return { expense }
}

// POST — upload a receipt image (multipart/form-data, field "file").
export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const authz = await authorize(params.groupId, params.expenseId, session.user.id)
  if (authz.error) return authz.error
  const { expense } = authz

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 })
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    return NextResponse.json(
      { error: "File exceeds the 5MB limit" },
      { status: 413 }
    )
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  // Validate by magic bytes — the client's Content-Type is NOT trusted.
  const detected = sniffImageType(bytes)
  if (!detected) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, or WebP images are allowed" },
      { status: 415 }
    )
  }

  // Random server-generated filename — the client's filename is never used.
  const filename = `${randomUUID()}.${detected.ext}`
  const dir = uploadDir()
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, filename), bytes)

  // If the expense already had a receipt, best-effort remove the old file.
  if (expense.receiptUrl) {
    const oldName = expense.receiptUrl.split("/").pop()
    const oldPath = oldName ? resolveUploadPath(oldName) : null
    if (oldPath) await unlink(oldPath).catch(() => {})
  }

  const receiptUrl = `/api/uploads/${filename}`
  await prisma.expense.update({
    where: { id: expense.id },
    data: { receiptUrl },
  })

  return NextResponse.json({ receiptUrl }, { status: 201 })
}

// DELETE — remove the receipt (same payer-or-admin auth).
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const authz = await authorize(params.groupId, params.expenseId, session.user.id)
  if (authz.error) return authz.error
  const { expense } = authz

  if (!expense.receiptUrl) {
    return NextResponse.json({ error: "No receipt to remove" }, { status: 404 })
  }

  const name = expense.receiptUrl.split("/").pop()
  const filePath = name ? resolveUploadPath(name) : null
  if (filePath) await unlink(filePath).catch(() => {})

  await prisma.expense.update({
    where: { id: expense.id },
    data: { receiptUrl: null },
  })

  return NextResponse.json({ success: true })
}
