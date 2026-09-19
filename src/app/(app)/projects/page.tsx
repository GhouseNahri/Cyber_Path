import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";

export const metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <section className="animate-rise">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Build real things</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Projects</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
          Project ideas from beginner to advanced — with milestones, requirements, GitHub links
          and clear authorized-use boundaries. Built in Phase 10.
        </p>
      </section>
      <Card>
        <CardHeader title="Project tracker" subtitle="IDEA → PLANNED → BUILDING → COMPLETED → PUBLISHED" action={<Badge tone="accent">Phase 10</Badge>} />
        <EmptyState
          title="Ideas will be waiting for you"
          body="Beginner: password strength analyzer, log analyzer, file integrity monitor. Intermediate: SIEM-style dashboards, secure APIs. Advanced: detection pipelines. Each defines legal/authorized usage."
          className="border-none bg-transparent"
        />
      </Card>
    </div>
  );
}
