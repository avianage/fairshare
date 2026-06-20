import { InsightsClient } from "@/components/insights/InsightsClient"

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold">Personal Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your exact out-of-pocket spending across all groups and direct expenses.
        </p>
      </div>
      <InsightsClient />
    </div>
  )
}
