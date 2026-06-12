import { Skeleton } from "@/components/ui/skeleton"

export default function GroupLoading() {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-7 w-40" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
