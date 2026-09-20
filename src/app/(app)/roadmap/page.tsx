import Link from "next/link";
import { Badge, Card, CardHeader, EmptyState, ProgressBar, buttonClasses } from "@/components/ui";
import { getRoadmapOverview } from "@/lib/roadmap/queries";
import { getBookmarkedSlugs } from "@/lib/notes/queries";
import { STAGE_ORDER, type TopicView } from "@/lib/roadmap/types";

export const metadata = { title: "Roadmap" };

const STATUS_DOT: Record<TopicView["progress"]["status"], { dot: string; label: string }> = {
  not_started: { dot: "bg-ink-low/40", label: "Not started" },
  in_progress: { dot: "bg-accent", label: "In progress" },
  completed: { dot: "bg-ok", label: "Completed" },
};

function TopicRowItem({ topic, bookmarked }: { topic: TopicView; bookmarked: boolean }) {
  const st = STATUS_DOT[topic.progress.status];
  const stagesDone = STAGE_ORDER.filter((s) => topic.progress.stages[s]).length;
  const pct = Math.round((stagesDone / STAGE_ORDER.length) * 100);

  return (
    <li className="group relative">
      <Link
        href={`/roadmap/${topic.slug}`}
        aria-disabled={topic.locked}
        className={`block rounded-xl border border-hairline bg-surface-2/40 p-4 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
          topic.locked
            ? "opacity-70 hover:border-hairline"
            : "hover:border-accent/40 hover:bg-surface-2/80"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-high">
              <span aria-hidden className={`size-2 shrink-0 rounded-full ${st.dot}`} />
              <span className="truncate">{topic.title}</span>
              {bookmarked ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5 shrink-0 text-accent" aria-label="Bookmarked">
                  <path d="M6 4h12a1 1 0 0 1 1 1v15.2a.6.6 0 0 1-.94.5L12 17l-6.06 3.7a.6.6 0 0 1-.94-.5V5a1 1 0 0 1 1-1Z" />
                </svg>
              ) : null}
              {topic.is_optional ? <Badge tone="neutral">optional</Badge> : null}
            </p>
            <p className="mt-1 line-clamp-1 text-[13px] text-ink-medium">{topic.summary}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[11px] text-ink-low">~{topic.estimated_minutes}m</p>
            {topic.locked ? (
              <Badge tone="warn">locked</Badge>
            ) : topic.progress.status === "completed" ? (
              <Badge tone="ok">done</Badge>
            ) : null}
          </div>
        </div>

        {topic.locked ? (
          <p className="mt-2 text-[12px] leading-relaxed text-warn">
            Locked — complete{" "}
            {topic.unmet.slice(0, 2).map((u, i) => (
              <span key={u.slug}>
                {i > 0 ? " and " : ""}
                <span className="font-medium">{u.title}</span>
              </span>
            ))}
            {topic.unmet.length > 2 ? ` +${topic.unmet.length - 2} more` : ""}.
          </p>
        ) : (
          <div className="mt-3">
            <ProgressBar value={pct} label={`${topic.title} progress`} size="sm" />
            <p className="mt-1 font-mono text-[11px] text-ink-low">
              {stagesDone}/{STAGE_ORDER.length} stages{topic.progress.confidence ? ` · confidence ${topic.progress.confidence}/5` : ""}
            </p>
          </div>
        )}
      </Link>
    </li>
  );
}

export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{ bookmarked?: string }>;
}) {
  const { bookmarked: bookmarkedParam } = await searchParams;
  const onlyBookmarked = bookmarkedParam === "1";
  const overview = await getRoadmapOverview();
  const bookmarks = await getBookmarkedSlugs();

  const phases = overview.ok
    ? onlyBookmarked
      ? overview.phases
          .map((p) => ({ ...p, topics: p.topics.filter((t) => bookmarks.has(t.slug)) }))
          .filter((p) => p.topics.length > 0)
      : overview.phases
    : [];

  return (
    <div className="space-y-8">
      <section className="animate-rise">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">
          Learn → Practice → Test → Build
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Roadmap</h1>
        {overview.ok ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
            {overview.totals.topics} topics across {overview.phases.length} phases.{" "}
            {overview.totals.unlocked_pending} are unlocked and waiting; prerequisites keep the rest
            locked until you&apos;re ready for them.
          </p>
        ) : (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
            Phases 0–4 (Orientation through Programming &amp; Scripting) with prerequisite-aware
            locking and the LEARN → PRACTICE → TEST → BUILD loop.
          </p>
        )}
      </section>

      {!overview.ok ? (
        <Card>
          <CardHeader
            title="Database content not seeded yet"
            subtitle="The roadmap schema migrations haven't been applied to your Supabase project"
            action={<Badge tone="warn">Setup</Badge>}
          />
          <EmptyState
            title="Waiting on migrations 0003–0005"
            body="Run the three SQL files from supabase/migrations in your Supabase SQL Editor (0003 schema, 0004 content, 0005 resources), then reload this page."
            className="border-none bg-transparent"
          />
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Link
              href="/roadmap"
              aria-current={!onlyBookmarked ? "page" : undefined}
              className={buttonClasses({ variant: onlyBookmarked ? "ghost" : "secondary", size: "sm" })}
            >
              All topics
            </Link>
            <Link
              href="/roadmap?bookmarked=1"
              aria-current={onlyBookmarked ? "page" : undefined}
              className={buttonClasses({ variant: onlyBookmarked ? "secondary" : "ghost", size: "sm" })}
            >
              Bookmarked{bookmarks.size > 0 ? ` (${bookmarks.size})` : ""}
            </Link>
          </div>

          {onlyBookmarked && phases.length === 0 ? (
            <Card>
              <EmptyState
                title="No bookmarks yet"
                body="Open any topic and tap Bookmark to keep it one click away — perfect for topics that look interesting but aren't your next step."
                action={
                  <Link href="/roadmap" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                    Browse all topics
                  </Link>
                }
              />
            </Card>
          ) : (
            phases.map((phase) => {
          const done = phase.topics.filter((t) => t.progress.status === "completed").length;
          const pct = phase.topics.length ? Math.round((done / phase.topics.length) * 100) : 0;
          return (
            <section key={phase.slug} className="animate-rise" aria-labelledby={`phase-${phase.slug}`}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-low">
                    Phase {phase.order_index}
                  </p>
                  <h2 id={`phase-${phase.slug}`} className="mt-0.5 font-display text-xl font-semibold tracking-tight">
                    {phase.title}
                  </h2>
                  {phase.tagline ? <p className="mt-0.5 text-[13px] text-ink-medium">{phase.tagline}</p> : null}
                </div>
                <div className="w-40">
                  <ProgressBar value={pct} label={`${phase.title} completion`} size="sm" />
                  <p className="mt-1 text-right font-mono text-[11px] text-ink-low">
                    {done}/{phase.topics.length}
                  </p>
                </div>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-medium">{phase.description}</p>

              <ul className="mt-4 grid gap-3 lg:grid-cols-2">
                {phase.topics.map((t) => (
                  <TopicRowItem key={t.slug} topic={t} bookmarked={bookmarks.has(t.slug)} />
                ))}
              </ul>
            </section>
          );
          })
          )}
        </>
      )}

      {!overview.ok ? null : (
        <p className="text-center text-[13px] text-ink-low">
          Phases 5+ (Security Fundamentals, Cryptography, Web, and beyond) are seeded in later build
          phases — the engine already supports them.
        </p>
      )}
    </div>
  );
}
