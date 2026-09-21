import Link from "next/link";
import { Badge, Card, CardHeader, EmptyState, ProgressBar, StatCard } from "@/components/ui";
import { DailyBarChart, ReasonBars, WeeklyBarChart } from "@/components/analytics/Charts";
import { getAnalyticsData } from "@/lib/analytics/queries";
import { MISSED_REASON_LABELS } from "@/lib/streak/messages";

export const metadata = { title: "Analytics" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDay(key: string | null): string {
  if (!key) return "—";
  const [, m, d] = key.split("-");
  const mi = Number.parseInt(m ?? "1", 10) - 1;
  return `${d ?? "?"} ${MONTHS[mi] ?? m}`;
}

function fmtMinutes(m: number): string {
  if (m <= 0) return "0 min";
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  if (!data.ok) {
    return (
      <div className="space-y-6">
        <Header />
        <Card>
          <CardHeader
            title="Analytics unavailable"
            subtitle="Runs on the same data as your sessions and quizzes"
            action={<Badge tone="warn">Setup</Badge>}
          />
          <EmptyState
            title="Waiting on the data schema"
            body="The analytics tables are not reachable right now. If you just changed migrations, reload in a moment."
            className="border-none bg-transparent"
          />
        </Card>
      </div>
    );
  }

  const hasAnyActivity =
    data.summary30.totalMinutes > 0 ||
    data.quiz.totalAttempts > 0 ||
    data.missed.total > 0 ||
    data.revision.completed > 0 ||
    data.tasksCompleted30 > 0;

  return (
    <div className="space-y-6">
      <Header />

      {!hasAnyActivity ? (
        <Card>
          <EmptyState
            title="Analytics need history"
            body="After a few logged sessions you'll see weekly study graphs, missed-day reason patterns and your learning velocity. Zeros today are honest zeros."
            action={
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Start today&apos;s session
              </Link>
            }
            className="border-none bg-transparent"
          />
        </Card>
      ) : null}

      {/* ── Summary row ─────────────────────────────────────────── */}
      <section aria-label="30-day summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Study time (30d)" value={fmtMinutes(data.summary30.totalMinutes)} hint={`${data.summary30.activeDays} active day${data.summary30.activeDays === 1 ? "" : "s"}`} />
        <StatCard
          label="Avg / active day"
          value={fmtMinutes(data.summary30.avgMinutesPerActiveDay)}
          hint={data.summary30.bestDay ? `best ${fmtMinutes(data.summary30.bestDay.minutes)} on ${fmtDay(data.summary30.bestDay.key)}` : undefined}
        />
        <StatCard label="Tasks completed" value={String(data.tasksCompleted30)} hint="last 30 days" />
        <StatCard label="Projects done" value={String(data.projectsCompleted)} hint="completed or published" />
      </section>

      {/* ── Study time charts ───────────────────────────────────── */}
      <section aria-labelledby="study-time" className="space-y-4">
        <h2 id="study-time" className="font-display text-lg font-semibold tracking-tight">
          Study time
        </h2>
        <Card>
          <CardHeader
            title="Daily minutes — last 30 days"
            subtitle={data.velocity.pctOfGoal > 0 ? `${data.velocity.pctOfGoal}% of your ${data.goalMinutes}-minute daily goal` : `Goal: ${data.goalMinutes} min/day`}
          />
          <DailyBarChart buckets={data.daily30} goalMinutes={data.goalMinutes} />
        </Card>
        <Card>
          <CardHeader title="Weekly totals — last 8 weeks" subtitle="Dashed line marks your daily goal on the daily chart; weeks show raw totals" />
          <WeeklyBarChart buckets={data.weekly8} />
        </Card>
      </section>

      {/* ── Velocity + revision ─────────────────────────────────── */}
      <section aria-labelledby="momentum" className="space-y-4">
        <h2 id="momentum" className="font-display text-lg font-semibold tracking-tight">
          Momentum
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader title="Learning velocity" subtitle="Per-calendar-day average, honest about missed days" />
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-ink-medium">Average per day</span>
                  <span className="font-mono text-sm text-ink-high">{data.velocity.avgMinutesPerDay} min</span>
                </div>
                <ProgressBar value={Math.min(100, data.velocity.pctOfGoal)} label="Velocity vs daily goal" size="sm" />
                <p className="mt-1.5 text-[12px] text-ink-low">
                  {data.velocity.pctOfGoal >= 100
                    ? "You're meeting your daily goal on average."
                    : data.velocity.pctOfGoal >= 60
                      ? "Close to goal. Consistency beats intensity."
                      : "Well below goal — consider a smaller daily target you can keep."}
                </p>
              </div>
              <p className="text-[12px] text-ink-low">
                {data.velocity.activeDaysPerWeek} active day{data.velocity.activeDaysPerWeek === 1 ? "" : "s"} per week —{" "}
                {data.velocity.activeDaysPerWeek >= 5 ? "strong cadence." : "aim for more days, shorter sessions."}
              </p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Revision health" subtitle="Spaced-repetition queue (Phase 9)" />
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-hairline bg-surface-2/40 p-3">
                <p className="font-display text-xl font-semibold text-warn">{data.revision.due}</p>
                <p className="mt-0.5 text-[11px] text-ink-low">due now</p>
              </div>
              <div className="rounded-xl border border-hairline bg-surface-2/40 p-3">
                <p className="font-display text-xl font-semibold text-ink-high">{data.revision.upcoming7}</p>
                <p className="mt-0.5 text-[11px] text-ink-low">next 7 days</p>
              </div>
              <div className="rounded-xl border border-hairline bg-surface-2/40 p-3">
                <p className="font-display text-xl font-semibold text-ok">{data.revision.completed}</p>
                <p className="mt-0.5 text-[11px] text-ink-low">completed</p>
              </div>
            </div>
            {data.revision.due > 0 ? (
              <p className="mt-3 text-[12px] text-ink-low">Due reviews are ranked first in your daily mission.</p>
            ) : null}
          </Card>
        </div>
      </section>

      {/* ── Quiz performance ────────────────────────────────────── */}
      <section aria-labelledby="quiz-perf" className="space-y-4">
        <h2 id="quiz-perf" className="font-display text-lg font-semibold tracking-tight">
          Knowledge checks
        </h2>
        <Card>
          {data.quiz.totalAttempts === 0 ? (
            <EmptyState
              title="No quiz attempts yet"
              body="Pass the knowledge check on a topic to prove the Test stage — attempts and weak topics appear here."
              className="border-none bg-transparent"
            />
          ) : (
            <>
              <CardHeader
                title="Quiz performance"
                subtitle={`${data.quiz.totalAttempts} attempt${data.quiz.totalAttempts === 1 ? "" : "s"} · ${data.quiz.passRate}% of quizzed topics passed · avg best score ${data.quiz.avgBestScore}%`}
              />
              {data.weakestTopics.length > 0 ? (
                <div className="mt-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">Weakest topics</p>
                  <ul className="mt-2 divide-y divide-hairline">
                    {data.weakestTopics.map((t) => (
                      <li key={t.slug} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <Link href={`/roadmap/${t.slug}`} className="text-[13px] font-medium text-ink-high hover:text-accent hover:underline">
                            {t.title}
                          </Link>
                          <p className="text-[11px] text-ink-low">
                            best {t.best_pct}% · {t.attempts} attempt{t.attempts === 1 ? "" : "s"}
                            {t.passed ? " · passed" : ""}
                          </p>
                        </div>
                        {!t.passed ? <Badge tone="warn">retake</Badge> : <Badge tone="ok">passed</Badge>}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </Card>
      </section>

      {/* ── Missed-day patterns ─────────────────────────────────── */}
      <section aria-labelledby="patterns" className="space-y-4">
        <h2 id="patterns" className="font-display text-lg font-semibold tracking-tight">
          Patterns
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader title="Missed-day reasons" subtitle={`${data.missed.total} reported in the last 30 days`} />
            {data.missed.total === 0 ? (
              <EmptyState title="No missed days reported" body="When a day doesn't qualify, the dashboard asks why — patterns show up here." className="border-none bg-transparent" />
            ) : (
              <div className="space-y-4">
                <ReasonBars
                  byCategory={data.missed.byCategory.map((c) => ({
                    category: MISSED_REASON_LABELS[c.category as keyof typeof MISSED_REASON_LABELS] ?? c.category,
                    count: c.count,
                  }))}
                />
                {data.missed.avgPlannedMinutes != null && data.missed.avgActualMinutes != null ? (
                  <p className="text-[12px] leading-relaxed text-ink-low">
                    Planned sessions average {data.missed.avgPlannedMinutes} min; completed sessions average{" "}
                    {data.missed.avgActualMinutes} min.
                    {data.missed.suggestLowerTarget
                      ? " That gap plus the misses above suggests a smaller daily target would stick better."
                      : ""}
                  </p>
                ) : null}
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Low-confidence topics" subtitle="Completed but still shaky (self-rated 1–2 of 5)" />
            {data.weakConfidence.length === 0 ? (
              <EmptyState
                title="Nothing shaky right now"
                body="When you complete a topic but rate your confidence low, it lands here so you can revisit it."
                className="border-none bg-transparent"
              />
            ) : (
              <ul className="divide-y divide-hairline">
                {data.weakConfidence.map((w) => (
                  <li key={w.topic_slug} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/roadmap/${w.topic_slug}`} className="min-w-0 text-[13px] font-medium text-ink-high hover:text-accent hover:underline">
                      {w.title}
                    </Link>
                    <Badge tone="warn">{w.confidence}/5</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}

function Header() {
  return (
    <section className="animate-rise">
      <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Signals, not vanity metrics</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Analytics</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
        Study time, learning velocity, missed-session reasons, weak areas and revision
        completion — only metrics that change what you do next.
      </p>
    </section>
  );
}
