import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";

export const metadata = { title: "Roadmap" };

const upcoming = [
  { phase: 4, title: "Roadmap engine", body: "Phases, topics and subtopics as data — with prerequisite-aware locking and unlock reasons." },
  { phase: 5, title: "Resource engine", body: "Curated, attributed resources per topic: docs, labs, videos, CTFs — with freshness metadata." },
  { phase: 6, title: "Daily learning", body: "Today's mission, timed sessions and topic-level practice tracking." },
];

export default function RoadmapPage() {
  return (
    <div className="space-y-6">
      <section className="animate-rise">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Learn → Practice → Test → Build</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Roadmap</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
          The interactive phase/topic tree with prerequisites, unlock reasons and the
          LEARN → PRACTICE → TEST → BUILD → REVIEW → DEMONSTRATE loop. The engine is built in Phase 4.
        </p>
      </section>

      <Card>
        <CardHeader
          title="Arriving in Phase 4"
          subtitle="The roadmap is data-driven, not hard-coded — it needs the database first"
          action={<Badge tone="accent">Phase 4</Badge>}
        />
        <EmptyState
          title="The roadmap engine is next on the build plan"
          body="Phases 0–17 (Orientation through Specialization), topics with estimated time and difficulty, prerequisite locks with plain-language reasons, and per-topic detail pages."
          className="border-none bg-transparent"
        />
        <ul className="mt-2 grid gap-3 sm:grid-cols-3">
          {upcoming.map((u) => (
            <li key={u.title} className="rounded-xl border border-hairline bg-surface-2/60 p-4">
              <Badge tone="neutral">Phase {u.phase}</Badge>
              <p className="mt-2 text-sm font-semibold text-ink-high">{u.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-medium">{u.body}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
