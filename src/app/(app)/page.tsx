import Link from "next/link";
import { Badge, Card, CardHeader, StatCard, ProgressBar, ProgressRing, EmptyState, buttonClasses } from "@/components/ui";
import { getSkillsOverview } from "@/lib/roadmap/skills";
import { timeGreeting, formatToday } from "@/lib/greeting";
import { getProfile } from "@/lib/profile";
import { getRoadmapOverview } from "@/lib/roadmap/queries";
import { STAGE_ORDER } from "@/lib/roadmap/types";
import { getMissionState, getStudyTotals } from "@/lib/session/queries";
import { TASK_KIND_META } from "@/lib/session/types";
import { getStreakData } from "@/lib/streak/queries";
import { completionMessage } from "@/lib/streak/messages";
import { StreakCard, MissedDayPrompt } from "@/components/streak";
import { yesterdayKey } from "@/lib/streak/messages";
import { getRevisionQueue } from "@/lib/revision/queries";
import { RevisionQueueCard } from "@/components/revision/RevisionQueueCard";

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

  const missionState = await getMissionState();
  const studyTotals = await getStudyTotals();
  const streakData = await getStreakData();
  const revisionData = await getRevisionQueue();

  // Post-mission completion line — only when today is already qualified.
  const completion =
    streakData.ok && streakData.streak.todayQualified
      ? completionMessage(streakData.streak.current, streakData.todayKey)
      : null;
  const titleBySlug = new Map(
    hasRoadmap ? overview.phases.flatMap((p) => p.topics).map((t) => [t.slug, t.title] as const) : []
  );

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
        <StatCard
          label="Streak"
          value={
            streakData.ok
              ? streakData.streak.atRiskToday && !streakData.streak.todayQualified
                ? `${streakData.streak.current}*`
                : `${streakData.streak.current} day${streakData.streak.current === 1 ? "" : "s"}`
              : "—"
          }
          hint={
            streakData.ok
              ? streakData.streak.atRiskToday && !streakData.streak.todayQualified
                ? "On the board — today decides if it grows"
                : streakData.streak.todayQualified
                  ? "Today is locked in"
                  : "Complete one task to start"
              : "Starts with your first session"
          }
          tone="accent"
        />
        <StatCard
          label="Study time"
          value={studyTotals ? formatStudyTime(studyTotals.seconds) : "—"}
          hint={studyTotals ? `${studyTotals.sessions} session${studyTotals.sessions === 1 ? "" : "s"} logged` : "Appears once migrations run"}
 />
        <StatCard
          label="Topics"
          value={totals ? `${totals.completed}/${totals.topics}` : "—"}
          hint={totals ? `${totals.in_progress} in progress` : "Run the roadmap migrations"}
        />
        <StatCard label="Daily goal" value={`${goal} min`} hint={profile?.preferred_study_time ? `Prefers ${profile.preferred_study_time} sessions` : "Set in onboarding"} />
      </section>

      {/* ── Completion line (only after a qualified day) ─────────────── */}
      {completion ? (
        <section aria-live="polite" className="animate-rise rounded-xl border border-ok/30 bg-ok/[0.06] px-5 py-4">
          <p className="text-sm font-medium text-ink-high">{completion}</p>
        </section>
      ) : null}

      {/* ── Missed-day accountability ───────────────────────────────── */}
      {streakData.ok &&
        (streakData.missedResponse ? (
          <section aria-live="polite" className="animate-rise rounded-xl border border-hairline bg-surface-2/40 px-5 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">Yesterday, noted</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-medium">{streakData.missedResponse}</p>
          </section>
        ) : !streakData.streak.todayQualified ? (
          <MissedDayPrompt dayKey={yesterdayKey(streakData.todayKey)} existingReason={null} />
        ) : null)}

      {/* ── Today's mission ────────────────────────────────────────── */}
      {missionState.ok && missionState.mission.tasks.length > 0 ? (
        <Card glow>
          <CardHeader
            title="Today's mission"
            subtitle="Review → in-progress → fresh topics, sized to your goal"
            action={
              <Badge tone={missionState.mission.settled ? "ok" : "accent"}>
                {missionState.mission.settled ? "settled" : `${missionState.mission.remainingMinutes} min left`}
              </Badge>
            }
          />
          <ol className="space-y-3">
            {missionState.mission.tasks.map((t, i) => (
              <li key={t.id} className="rounded-xl border border-hairline bg-surface-2/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 font-mono text-[11px] text-ink-low">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-high">{t.title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-medium">{t.why}</p>
                    <p className="mt-1 font-mono text-[11px] text-ink-low">
                      {TASK_KIND_META[t.kind].label} · {titleBySlug.get(t.topic_slug) ?? t.topic_slug.replaceAll("-", " ")} · ~{t.planned_minutes} min
                    </p>
                  </div>
                  <Badge tone={t.status === "completed" ? "ok" : t.status === "skipped" ? "neutral" : t.status === "in_progress" ? "accent" : "info"}>
                    {t.status === "completed" ? "Done" : t.status === "skipped" ? "Skipped" : t.status === "in_progress" ? "Current" : "To do"}
                  </Badge>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[11px] text-ink-low">
              {missionState.mission.tasks.filter((t) => t.status === "completed").length}/{missionState.mission.tasks.length} tasks complete
            </p>
            <div className="flex items-center gap-2">
              <Link href="/session" className={buttonClasses({ variant: "primary", size: "sm" })}>
                {missionState.session && (missionState.session.status === "active" || missionState.session.status === "paused")
                  ? missionState.session.status === "paused"
                    ? "Resume session"
                    : "Continue session"
                  : "Start session"}
              </Link>
              <Link href="/history" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                History
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Streak ─────────────────────────────────────────────────── */}
        {streakData.ok ? (
          <StreakCard
            current={streakData.streak.current}
            longest={streakData.streak.longest}
            totalActiveDays={streakData.streak.totalActiveDays}
            todayQualified={streakData.streak.todayQualified}
            atRiskToday={streakData.streak.atRiskToday}
            activity={streakData.activity}
          />
        ) : null}

        {/* ── Revision queue ────────────────────────────────────────── */}
        {revisionData.ok ? (
          <RevisionQueueCard
            due={revisionData.due}
            upcoming={revisionData.upcoming}
            graduatedCount={revisionData.graduatedCount}
            todayKey={revisionData.todayKey}
          />
        ) : (
          <Card>
            <CardHeader title="Revision queue" subtitle="Spaced review keeps knowledge from decaying" />
            <EmptyState
              title="Queue unavailable"
              body="Run migration 0011 in the Supabase SQL Editor and the spaced-repetition queue comes alive."
            />
          </Card>
        )}

        {/* ── Skills snapshot ───────────────────────────────────────── */}
        <Card>
          <CardHeader title="Skill snapshot" subtitle="Theory vs practice, kept separate" />
          <SkillSnapshot />
        </Card>
      </div>
    </div>
  );
}

/** Seconds → "2h 05m" / "45m" for the stat strip. */
function formatStudyTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
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
