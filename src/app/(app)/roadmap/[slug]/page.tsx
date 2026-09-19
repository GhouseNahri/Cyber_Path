import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { getTopicDetail } from "@/lib/roadmap/queries";
import { StageTracker } from "./StageTracker";

export const metadata = { title: "Topic" };

const TYPE_LABEL: Record<string, string> = {
  documentation: "Docs",
  article: "Article",
  video: "Video",
  course: "Course",
  interactive_lab: "Interactive lab",
  ctf: "CTF",
  book: "Book",
  cheat_sheet: "Cheat sheet",
  exercise: "Exercise",
};

const DIFF_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await getTopicDetail(slug);
  if (!detail) notFound();

  const { topic, phase, resources, skills } = detail;
  const hints = topic.stage_hints as Partial<Record<string, string>>;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <section className="animate-rise">
        <Link
          href="/roadmap"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-medium hover:text-ink-high"
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden="true">
            <path d="M19 12H5m6 6-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Roadmap
        </Link>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-low">
          Phase {phase.order_index} · {phase.title}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{topic.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={topic.difficulty === "advanced" ? "danger" : topic.difficulty === "intermediate" ? "warn" : "info"}>
            {DIFF_LABEL[topic.difficulty] ?? topic.difficulty}
          </Badge>
          <Badge tone="neutral">~{topic.estimated_minutes} min</Badge>
          {topic.is_optional ? <Badge tone="neutral">optional</Badge> : null}
          {topic.progress.status === "completed" ? (
            <Badge tone="ok">completed</Badge>
          ) : topic.progress.status === "in_progress" ? (
            <Badge tone="accent">in progress</Badge>
          ) : null}
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-high">{topic.summary}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left: stages + why ───────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          <Card glow>
            <CardHeader
              title="The learning loop"
              subtitle="Work through all four stages — a checkbox on Learn alone doesn't complete this topic"
            />
            <StageTracker
              topicSlug={topic.slug}
              topicTitle={topic.title}
              locked={topic.locked}
              unmetTitles={topic.unmet.map((u) => u.title)}
              progress={topic.progress}
            />
          </Card>

          <Card>
            <CardHeader title="Why this matters" subtitle="The reason this topic earns its place on your roadmap" />
            <p className="text-sm leading-relaxed text-ink-medium">{topic.why_it_matters}</p>
            {typeof hints.practice === "string" || typeof hints.test === "string" || typeof hints.build === "string" ? (
              <div className="mt-4 space-y-2 border-t border-hairline pt-4">
                {(["practice", "test", "build"] as const).map((k) =>
                  typeof hints[k] === "string" ? (
                    <p key={k} className="text-[13px] leading-relaxed text-ink-medium">
                      <span className="font-semibold capitalize text-ink-high">{k}: </span>
                      {hints[k]}
                    </p>
                  ) : null
                )}
              </div>
            ) : null}
          </Card>

          {/* ── Resources ──────────────────────────────────────────── */}
          <Card>
            <CardHeader
              title="Resources"
              subtitle="Curated sources — official docs first, verified dates shown honestly"
            />
            {resources.length === 0 ? (
              <EmptyState
                title="No resources curated for this topic yet"
                body="Later content phases fill this in. For now, the stage hints above point at what to do."
              />
            ) : (
              <ul className="divide-y divide-hairline">
                {resources.map((r) => (
                  <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-ink-high hover:text-accent hover:underline"
                      >
                        {r.title}
                        <span aria-hidden className="ml-1 inline-block">↗</span>
                      </a>
                      <span className="font-mono text-[11px] text-ink-low">
                        {r.provider} · {TYPE_LABEL[r.type] ?? r.type}
                        {r.estimated_minutes ? ` · ~${r.estimated_minutes}m` : ""}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {r.is_official ? <Badge tone="info">official</Badge> : null}
                      {r.is_free ? <Badge tone="ok">free</Badge> : <Badge tone="warn">paid</Badge>}
                      {r.last_verified ? (
                        <span className="text-[11px] text-ink-low">verified {r.last_verified}</span>
                      ) : (
                        <span className="text-[11px] text-warn">not yet verified</span>
                      )}
                    </div>
                    {r.notes ? <p className="mt-1 text-[12px] leading-relaxed text-ink-medium">{r.notes}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ── Right rail: prereqs + skills ─────────────────────────── */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Prerequisites" subtitle={topic.prereq_total === 0 ? "Nothing — this is a starting point" : `${topic.prereq_done}/${topic.prereq_total} completed`} />
            {topic.prereq_total === 0 ? (
              <p className="text-[13px] leading-relaxed text-ink-medium">
                No prerequisites. You can start here as soon as you&apos;re ready.
              </p>
            ) : (
              <ul className="space-y-2">
                {topic.unmet.map((u) => (
                  <li key={u.slug}>
                    <Link href={`/roadmap/${u.slug}`} className="group flex items-center justify-between gap-2 rounded-lg border border-warn/30 bg-warn/[0.06] px-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink-high group-hover:text-accent">{u.title}</span>
                        <span className="block text-[11px] text-ink-low">{u.phase_title}</span>
                      </span>
                      <Badge tone="warn">needed</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Skills practiced" subtitle="What this topic trains" />
            {skills.length === 0 ? (
              <p className="text-[13px] text-ink-medium">Mapped in a later phase.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <li key={s.slug}>
                    <Badge tone="neutral">{s.name}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
