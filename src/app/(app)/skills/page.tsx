import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";

export const metadata = { title: "Skills" };

export default function SkillsPage() {
  return (
    <div className="space-y-6">
      <section className="animate-rise">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Evidence over checkboxes</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Skills</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
          A skill graph with theory vs practical progress, confidence ratings and evidence —
          never an instant expert from clicking checkboxes. Built in Phase 8.
        </p>
      </section>
      <Card>
        <CardHeader title="Skill graph" subtitle="NOT STARTED → LEARNING → PRACTICING → COMPETENT → DEMONSTRATED" action={<Badge tone="accent">Phase 8</Badge>} />
        <EmptyState
          title="Skills populate from your roadmap work"
          body="Theory progress comes from study; practical progress comes from labs, quizzes and projects. Both are tracked separately so you always know the difference."
          className="border-none bg-transparent"
        />
      </Card>
    </div>
  );
}
