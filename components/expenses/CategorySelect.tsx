"use client"

import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { EXPENSE_CATEGORIES } from "@/lib/categories"

export function CategorySelect({
  id = "category",
  value,
  onChange,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Category</Label>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {EXPENSE_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.icon} {c.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  )
}
