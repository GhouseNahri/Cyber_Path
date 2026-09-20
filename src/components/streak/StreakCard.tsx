import Link from "next/link";
import { Badge, Card, CardHeader, ProgressBar } from "@/components/ui";
import { STREAK_MILESTONES, nextMilestone } from "@/lib/streak/engine";
import type { DayActivity } from "@/lib/streak/engine";

type Props = {
  current: number;
  longest: number;
  totalActiveDays: number;
  todayQualified: boolean;
  atRiskToday: boolean;
  /** Recent activity (oldest-first) for the dot strip; newest ~14 days shown. */
  activity: DayActivity[];
};

function isQualified(a: DayActivity): boolean {
  return a.tasks_done >= 1 || a.seconds >= 15 * 60;
}

/** Streak card: current run, milestone progress, and the last 14 days as dots. */
export function StreakCard({ current, longest, totalActiveDays, todayQualified, atRiskToday, activity }: Props) {
  const next = nextMilestone(current);
  const prev = [...STREAK_MILESTONES].reverse().find((m) => m <= current) ?? 0;
  const pct = next === null ? 100 : Math.round(((current - prev) / (next - prev)) * 100);
  const dots = activity.slice(-14);

  return (
    <Card>
      <CardHeader
        title="Streak"
        subtitle="Counts days with real work — never just opens"
        action={
          <Badge tone={todayQualified ? "ok" : atRiskToday ? "warn" : "neutral"}>
            {todayQualified ? "today counts" : atRiskToday ? "at risk today" : "not started"}
          </Badge>
        }
      />

      <div className="flex items-end gap-6">
        <div>
          <p className="font-display text-4xl font-semibold tracking-tight">
            {current}
            <span className="ml-1 text-base font-medium text-ink-medium">{current === 1 ? "day" : "days"}</span>
          </p>
          <p className="mt-1 font-mono text-[11px] text-ink-low">
            longest {longest} · {totalActiveDays} active {totalActiveDays === 1 ? "day" : "days"}
          </p>
        </div>

        <div className="min-w-0 flex-1 pb-1">
          {next !== null ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-ink-medium">Next milestone</span>
                <span className="font-mono text-[11px] text-ink-low">
                  {current} / {next}
                </span>
              </div>
              <div className="mt-1.5">
                <ProgressBar value={pct} label={`Progress to ${next}-day milestone`} size="sm" />
              </div>
            </>
          ) : (
            <p className="text-[13px] text-ink-medium">Every milestone cleared. The roadmap salutes you.</p>
          )}
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap items-center gap-1.5" aria-label="Last 14 days of activity">
        {dots.map((d) => {
          const q = isQualified(d);
          const partial = !q && (d.tasks_done > 0 || d.seconds > 0);
          return (
            <li
              key={d.day_key}
              title={`${d.day_key}: ${q ? "qualified" : partial ? "some activity" : "no activity"}`}
              aria-label={`${d.day_key}: ${q ? "qualified" : partial ? "some activity" : "no activity"}`}
              className={
                q
                  ? "size-3 rounded-full bg-accent"
                  : partial
                    ? "size-3 rounded-full bg-accent/30"
                    : "size-3 rounded-full border border-hairline bg-surface-2"
              }
            />
          );
        })}
      </ul>

      <p className="mt-3 text-[13px] leading-relaxed text-ink-medium">
        {todayQualified
          ? "Today is locked in. See you tomorrow."
          : atRiskToday
            ? "One task or 15 focused minutes today keeps the run alive."
            : "Complete one task today to start your first run."}
      </p>

      <div className="mt-3">
        <Link href="/history" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
          View full history
          <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden="true">
            <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </Card>
  );
}
