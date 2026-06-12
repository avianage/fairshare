import { Prisma } from "@prisma/client"

/**
 * Shared Prisma include + JSON serializer for expenses, so every route returns
 * the same shape and converts Decimal → number at exactly one boundary.
 */
export const expenseInclude = {
  payer: { select: { id: true, name: true, avatar: true } },
  splits: {
    select: { amount: true, user: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ExpenseInclude

export type ExpenseWithRelations = Prisma.ExpenseGetPayload<{
  include: typeof expenseInclude
}>

export function serializeExpense(e: ExpenseWithRelations) {
  return {
    id: e.id,
    description: e.description,
    amount: e.amount.toNumber(),
    category: e.category,
    splitType: e.splitType,
    notes: e.notes,
    receiptUrl: e.receiptUrl,
    date: e.date,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    payer: e.payer,
    splits: e.splits.map((s) => ({ user: s.user, amount: s.amount.toNumber() })),
  }
}

/**
 * Include + serializer for *direct* (non-group) expenses. Same shape as the
 * group serializer plus the explicit participant list (group expenses derive
 * participants from membership; direct ones store them in DirectParticipant).
 */
export const directExpenseInclude = {
  payer: { select: { id: true, name: true, avatar: true } },
  splits: {
    select: { amount: true, user: { select: { id: true, name: true } } },
  },
  participants: {
    select: { user: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ExpenseInclude

export type DirectExpenseWithRelations = Prisma.ExpenseGetPayload<{
  include: typeof directExpenseInclude
}>

export function serializeDirectExpense(e: DirectExpenseWithRelations) {
  return {
    id: e.id,
    description: e.description,
    amount: e.amount.toNumber(),
    category: e.category,
    splitType: e.splitType,
    notes: e.notes,
    receiptUrl: e.receiptUrl,
    date: e.date,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    payer: e.payer,
    splits: e.splits.map((s) => ({ user: s.user, amount: s.amount.toNumber() })),
    participants: e.participants.map((p) => p.user),
  }
}
