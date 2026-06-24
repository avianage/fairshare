"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  value: string // YYYY-MM-DD or ""
  onChange: (value: string) => void
  placeholder?: string
  min?: string // YYYY-MM-DD
  max?: string // YYYY-MM-DD
  className?: string
  "aria-label"?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick date",
  min,
  max,
  className,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const date = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined
  const validDate = date && isValid(date) ? date : undefined

  const minDate = min ? parse(min, "yyyy-MM-dd", new Date()) : undefined
  const maxDate = max ? parse(max, "yyyy-MM-dd", new Date()) : undefined

  function handleSelect(selected: Date | undefined) {
    onChange(selected ? format(selected, "yyyy-MM-dd") : "")
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={ariaLabel}
          className={cn(
            "justify-start text-left font-normal bg-background/50 hover:bg-background border-input",
            !validDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 opacity-60" />
          <span className="text-xs sm:text-sm">
            {validDate ? format(validDate, "dd MMM yyyy") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={validDate}
          onSelect={handleSelect}
          disabled={(d) => {
            if (minDate && d < minDate) return true
            if (maxDate && d > maxDate) return true
            return false
          }}
          defaultMonth={validDate ?? minDate}
        />
        {validDate && (
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => { onChange(""); setOpen(false) }}
            >
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
