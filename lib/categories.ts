// Expense categories — kept in sync with the `ExpenseCategory` enum in
// prisma/schema.prisma. Used by the form (picker) and card (icon + label).
export const EXPENSE_CATEGORIES = [
  { value: "FOOD", label: "Food & Drink", icon: "🍔" },
  { value: "GROCERIES", label: "Groceries", icon: "🛒" },
  { value: "TRANSPORT", label: "Transport", icon: "🚗" },
  { value: "TRAVEL", label: "Travel", icon: "✈️" },
  { value: "ACCOMMODATION", label: "Accommodation", icon: "🏨" },
  { value: "ENTERTAINMENT", label: "Entertainment", icon: "🎬" },
  { value: "SHOPPING", label: "Shopping", icon: "🛍️" },
  { value: "UTILITIES", label: "Utilities", icon: "💡" },
  { value: "HEALTH", label: "Health", icon: "🏥" },
  { value: "OTHER", label: "Other", icon: "📌" },
] as const

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number]["value"]

const CATEGORY_MAP = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c])
) as Record<string, (typeof EXPENSE_CATEGORIES)[number]>

export function categoryMeta(value: string) {
  return CATEGORY_MAP[value] ?? CATEGORY_MAP.OTHER
}
