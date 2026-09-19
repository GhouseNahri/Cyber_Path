import Link from "next/link";
import { Badge, Card, CardHeader, StatCard, ProgressBar, ProgressRing, EmptyState, buttonClasses } from "@/components/ui";
import { getSkillsOverview } from "@/lib/roadmap/skills";
import { timeGreeting, formatToday } from "@/lib/greeting";
import { getProfile } from "@/lib/profile";
import { getRoadmapOverview } from "@/lib/roadmap/queries";
import { STAGE_ORDER } from "@/lib/roadmap/types";

export default async function DashboardPage() {
  const profile = await getProfile();
  const name = profile?.display_name?.trim() || null;
  const greeting = timeGreeting(profile?.timezone ?? undefined);
  const today = formatToday(profile?.timezone ?? undefined);
  const goal = profile?.daily_goal_minutes ?? 45;

  const overview = await getRoadmapOverview();
  const hasRoadmap = overview.ok;

  // Next step: first unlocked, not-completed topic in phase order.
  const nextTopic = hasRoadmap
    ? overview.phases
        .flatMap((p) => p.topics)
        .find((t) => !t.locked && t.progress.status !== "completed") ?? null
    : null;

  const totals = hasRoadmap ? overview.totals : null;
  const roadmapPct = totals && totals.topics > 0 ? Math.round((totals.completed / totals.topics) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* ── Welcome ─────────────────────────────────────────────────── */}
      <section className="animate-rise" aria-labelledby="welcome-heading">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">{today}</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <h1 id="welcome-heading" className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting}{name ? `, ${name}` : ""}. <span className="text-gradient">What are we learning today?</span>
          </h1>
          <div className="flex items-center gap-2">
            <Badge tone="accent">Roadmap live</Badge>
          </div>
        </div>
      </section>

      {/* ── Stat strip ───────────────────────────────────────────────── */}
      <section aria-label="Learning metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Streak" value="0 days" hint="Starts with your first session" tone="accent" />
        <StatCard label="Study time" value="0h 0m" hint="Logged study time" />
        <StatCard
          label="Topics"
          value={totals ? `${totals.completed}/${totals.topics}` : "—"}
          hint={totals ? `${totals.in_progress} in progress` : "Run the roadmap migrations"}
        />
        <StatCard label="Daily goal" value={`${goal} min`} hint={profile?.preferred_study_time ? `Prefers ${profile.preferred_study_time} sessions` : "Set in onboarding"} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── What should I do now ──────────────────────────────────── */}
        <Card className="lg:col-span-2" glow>
          <CardHeader
            title="What should I do now?"
            subtitle="Computed from prerequisites and your progress — not a guess"
            action={<Badge tone="accent">Live</Badge>}
          />
          {!hasRoadmap ? (
            <EmptyState
              title="Roadmap content isn't seeded yet"
              body="Run migrations 0003–0005 in the Supabase SQL Editor (schema, topics, resources) and this becomes your personal next step."
              action={
                <Link href="/roadmap" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                  Open roadmap
                </Link>
              }
            />
          ) : totals && totals.completed === 0 && totals.in_progress === 0 ? (
            <div>
              <p className="text-sm leading-relaxed text-ink-medium">
                You haven&apos;t started yet. The cleanest opening move:
              </p>
              {nextTopic ? (
                <div className="mt-3 rounded-xl border border-accent/40 bg-accent/[0.07] p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">Start here</p>
                  <p className="mt-1 font-display text-lg font-semibold">{nextTopic.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-medium">{nextTopic.summary}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link href={`/roadmap/${nextTopic.slug}`} className={buttonClasses({ variant: "primary", size: "sm" })}>
                      Open topic
                    </Link>
                    <span className="font-mono text-[11px] text-ink-low">~{nextTopic.estimated_minutes} min</span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : nextTopic ? (
            <div>
              <p className="text-sm leading-relaxed text-ink-medium">
                {totals && totals.in_progress > 0
                  ? `You have ${totals.in_progress} topic${totals.in_progress === 1 ? "" : "s"} in progress. Continue here:`
                  : "Next unlocked topic on your path:"}
              </p>
              <div className="mt-3 rounded-xl border border-accent/40 bg-accent/[0.07] p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">Up next</p>
                <p className="mt-1 font-display text-lg font-semibold">{nextTopic.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-medium">{nextTopic.summary}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link href={`/roadmap/${nextTopic.slug}`} className={buttonClasses({ variant: "primary", size: "sm" })}>
                    Continue topic
                  </Link>
                  <span className="font-mono text-[11px] text-ink-low">
                    {STAGE_ORDER.filter((s) => nextTopic.progress.stages[s]).length}/4 stages done · ~{nextTopic.estimated_minutes} min
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Phases 0–4 complete"
              body="You've finished everything seeded so far. Security Fundamentals, Cryptography and the Web phases arrive in the next content drop."
            />
          )}
        </Card>

        {/* ── Roadmap progress ──────────────────────────────────────── */}
        <Card>
          <CardHeader title="Roadmap progress" subtitle="Phases 0–4 seeded so far" />
          <div className="flex items-center gap-5">
            <ProgressRing value={roadmapPct} label="Roadmap progress" caption="overall" />
            <div className="min-w-0 space-y-2 text-sm">
              <p className="text-ink-medium">
                <span className="font-semibold text-ink-high">{totals?.completed ?? 0} topics</span> completed
              </p>
              {totals ? (
                <ul className="space-y-1 font-mono text-[11px] text-ink-low">
                  <li>{totals.in_progress} in progress</li>
                  <li>{totals.unlocked_pending} unlocked, waiting</li>
                  <li>{totals.locked} locked by prerequisites</li>
                </ul>
              ) : null}
              <Link href="/roadmap" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
                Open roadmap
                <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden="true">
                  <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Revision queue ────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Revision queue"
            subtitle="Spaced review keeps knowledge from decaying"
            action={<Badge tone="neutral">Phase 9</Badge>}
          />
          <EmptyState
            title="Nothing to review yet"
            body="Topics you've completed enter a spaced revision schedule — 1, 3, 7, 14 and 30 days out. Complete a topic and it will appear here."
          />
        </Card>

        {/* ── Skills snapshot ───────────────────────────────────────── */}
        <Card>
          <CardHeader title="Skill snapshot" subtitle="Theory vs practice, kept separate" />
          <SkillSnapshot />
        </Card>
      </div>
    </div>
  );
}

/** Small server-rendered snapshot: top 4 skills by progress. */
async function SkillSnapshot() {
  const overview = await getSkillsOverview();

  if (!overview.ok || overview.skills.length === 0) {
    return (
      <EmptyState
        title="Skills populate as you work"
        body="Complete stages on topics and your skill graph fills in here."
      />
    );
  }

  const active = overview.skills.filter((s) => s.level !== "not_started").slice(0, 4);
  if (active.length === 0) {
    return (
      <EmptyState
        title="All skills waiting"
        body="Complete your first topic stage and the relevant skill starts moving."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {active.map((s) => (
        <li key={s.slug}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-medium text-ink-high">{s.name}</span>
            <span className="font-mono text-[11px] text-ink-low">
              T{s.theoryPct}% · P{s.practicalPct}%
            </span>
          </div>
          <ProgressBar value={s.theoryPct} label={`${s.name} theory`} size="sm" />
        </li>
      ))}
    </ul>
  );
}
