import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";

export const metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <section className="animate-rise">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Signals, not vanity metrics</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Analytics</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
          Study time, learning velocity, missed-session reasons, weak areas and revision
          completion — only metrics that change what you do next. Built in Phase 12.
        </p>
      </section>
      <Card>
        <CardHeader title="Learning analytics" subtitle="Daily/weekly/monthly study, streak, patterns" action={<Badge tone="accent">Phase 12</Badge>} />
        <EmptyState
          title="Analytics need history"
          body="After a few logged sessions you'll see weekly study graphs, missed-day reason patterns and your learning velocity. Zeros today are honest zeros."
          className="border-none bg-transparent"
        />
      </Card>
    </div>
  );
}
