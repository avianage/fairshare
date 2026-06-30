import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

export type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  placeholder?: string
  renderOption?: (opt: { value: string; label: string }) => React.ReactNode
}

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, children, value, onChange, placeholder, renderOption, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)

    // Helper to extract text content from React children without comma-joins of arrays
    const getChildrenText = React.useCallback((node: React.ReactNode): string => {
      if (node === null || node === undefined) return ""
      if (typeof node === "string" || typeof node === "number") return String(node)
      if (Array.isArray(node)) return node.map(getChildrenText).join("")
      if (React.isValidElement<{ children?: React.ReactNode }>(node))
        return getChildrenText(node.props.children)
      return ""
    }, [])

    // Parse options from children
    const options = React.useMemo(() => {
      const list: { value: string; label: string; className?: string }[] = []
      React.Children.forEach(children, (child) => {
        if (
          React.isValidElement<{ value?: string; children?: React.ReactNode; className?: string }>(child) &&
          child.type === "option"
        ) {
          list.push({
            value: String(child.props.value ?? ""),
            label: getChildrenText(child.props.children),
            className: child.props.className,
          })
        }
      })
      return list
    }, [children, getChildrenText])

    // Find the currently selected option's label
    const selectedOption = options.find((opt) => opt.value === value)
    const displayLabel = selectedOption ? selectedOption.label : (placeholder || "Select...")

    // Close dropdown on click outside
    React.useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const handleSelect = (val: string) => {
      if (onChange) {
        const event = {
          target: { value: val, name: props.name, id: props.id },
          currentTarget: { value: val },
        } as React.ChangeEvent<HTMLSelectElement>
        onChange(event)
      }
      setIsOpen(false)
    }

    return (
      <div className="relative w-full" ref={containerRef}>
        {/* Custom trigger button that looks like standard input */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-left",
            className
          )}
          disabled={props.disabled}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
        </button>

        {/* Dropdown Options list overlay */}
        {isOpen && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-card p-1 text-sm text-foreground shadow-md animate-in fade-in-50 slide-in-from-top-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                  opt.value === value && "bg-accent text-accent-foreground font-medium",
                  opt.className
                )}
              >
                {renderOption ? renderOption(opt) : opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Hidden native select so form validation/refs/defaults work as before */}
        <select
          ref={ref}
          value={value}
          onChange={onChange}
          className="sr-only"
          {...props}
        >
          {children}
        </select>
      </div>
    )
  }
)
NativeSelect.displayName = "NativeSelect"

export { NativeSelect }
