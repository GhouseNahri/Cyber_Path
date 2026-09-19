import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";

export const metadata = { title: "Career" };

export default function CareerPage() {
  return (
    <div className="space-y-6">
      <section className="animate-rise">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Skills + evidence, not promises</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Career paths</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
          Explore SOC, pentesting, AppSec, cloud security and more — with realistic
          responsibilities, skills, labs and portfolio guidance. No employment guarantees;
          certifications labeled optional unless a role truly requires them. Built in Phase 11.
        </p>
      </section>
      <Card>
        <CardHeader title="Career explorer" subtitle="Mapped to NIST NICE work-role categories where relevant" action={<Badge tone="accent">Phase 11</Badge>} />
        <EmptyState
          title="Career explorer arrives with your skill data"
          body="Each path lists foundational skills, recommended modules, labs, project ideas and portfolio requirements — so you can branch when you're ready, not forced on day one."
          className="border-none bg-transparent"
        />
      </Card>
    </div>
  );
}
