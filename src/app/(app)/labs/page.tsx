import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";

export const metadata = { title: "Labs" };

export default function LabsPage() {
  return (
    <div className="space-y-6">
      <section className="animate-rise">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Hands-on, always authorized</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Labs</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
          A tracker for hands-on practice: provider labs, CTFs and home-lab exercises — with
          notes, evidence and skills demonstrated. Built in Phase 8.
        </p>
      </section>
      <Card>
        <CardHeader title="Lab tracker" subtitle="NOT STARTED → IN PROGRESS → COMPLETED → REVISIT" action={<Badge tone="accent">Phase 8</Badge>} />
        <EmptyState
          title="Your first lab is waiting"
          body="Start with Linux or networking fundamentals, then log what you did and what it proved. All practical work stays inside authorized environments — labs, CTFs and systems you own."
          className="border-none bg-transparent"
        />
      </Card>
    </div>
  );
}
