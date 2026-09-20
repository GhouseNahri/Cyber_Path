import Link from "next/link";
import { Badge, Card, CardHeader, EmptyState, buttonClasses } from "@/components/ui";
import { getHistory } from "@/lib/session/queries";
import { getProfile } from "@/lib/profile";
import { getStreakData } from "@/lib/streak/queries";
import { MISSED_REASON_LABELS, type MissedReasonCategory } from "@/lib/streak/messages";
import type { ActivityDay, SessionHistoryRow } from "@/lib/session/types";

export const metadata = { title: "History" };

function fmtMinutes(sec: number | null): string {
  if (sec === null) return "—";
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

function fmtDate(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const CELL_TONES = ["bg-surface-2", "bg-ok/25", "bg-ok/50", "bg-ok/75", "bg-ok"];

function CalendarHeatmap({ calendar, goalMinutes }: { calendar: ActivityDay[]; goalMinutes: number }) {
  // Group into columns of 7 (weeks), oldest → newest.
  const cols: ActivityDay[][] = [];
  for (let i = 0; i < calendar.length; i += 7) cols.push(calendar.slice(i, i + 7));

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-1.5">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-1.5">
            {col.map((d) => {
              const ratio = goalMinutes > 0 && d.seconds > 0 ? Math.min(4, Math.ceil((d.seconds / 60 / goalMinutes) * 4)) : 0;
              const tone = CELL_TONES[ratio];
              return (
                <div
                  key={d.day_key}
                  title={`${fmtDate(d.day_key)} · ${fmtMinutes(d.seconds) || "0m"} · ${d.tasks_done} task${d.tasks_done === 1 ? "" : "s"}`}
                  aria-label={`${fmtDate(d.day_key)}: ${fmtMinutes(d.seconds) || "0m"}, ${d.tasks_done} tasks`}
                  className={`size-3.5 rounded-[4px] ${tone} ${d.day_key === calendar[calendar.length - 1]?.day_key ? "ring-1 ring-accent" : ""}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 font-mono text-[10px] text-ink-low">
        less <span className="inline-flex gap-0.5 align-middle">{CELL_TONES.map((c, i) => <span key={i} className={`inline-block size-2.5 rounded-[3px] ${c}`} />)}</span> more · goal {goalMinutes} min/day
      </p>
    </div>
  );
}

export default async function HistoryPage() {
  const profile = await getProfile();
  const history = await getHistory(8);
  const streakData = await getStreakData(56);
  const missedDays = streakData.ok ? streakData.recentMissed : [];

  return (
    <div className="space-y-6">
      <section className="animate-rise">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-medium">Study history</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Your <span className="text-gradient">record</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-medium">
          Every session you finish lands here with honest time — pauses subtracted, nothing inflated.
        </p>
      </section>

      {!history.ok ? (
        <Card>
          <CardHeader title="History unavailable" subtitle="Migrations not applied" />
          <EmptyState
            title="Waiting on migrations 0006/0008"
            body="Apply the daily-learning migrations and your history appears."
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="Last 8 weeks" subtitle="Days studied against your daily goal" />
            <CalendarHeatmap calendar={history.calendar} goalMinutes={profile?.daily_goal_minutes ?? 45} />
          </Card>

          {missedDays.length > 0 ? (
            <Card>
              <CardHeader
                title={`${missedDays.length} missed ${missedDays.length === 1 ? "day" : "days"}`}
                subtitle="Self-reported — feeds the pattern analysis that tunes your plan"
              />
              <ul className="divide-y divide-hairline">
                {missedDays.slice(0, 8).map((m) => (
                  <li key={m.day_key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                    <span className="text-sm font-semibold text-ink-high">{fmtDate(m.day_key)}</span>
                    <Badge tone="neutral">
                      {MISSED_REASON_LABELS[m.reason_category as MissedReasonCategory] ?? m.reason_category}
                    </Badge>
                    {m.reason_text ? (
                      <span className="w-full text-[12px] text-ink-medium italic">{m.reason_text}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {history.sessions.length === 0 ? (
            <Card>
              <EmptyState
                title="No sessions yet"
                body="Your first session is waiting. Start today&apos;s mission and it will be logged here."
                action={
                  <Link href="/session" className={buttonClasses({ variant: "primary", size: "sm" })}>
                    Go to today&apos;s mission
                  </Link>
                }
              />
            </Card>
          ) : (
            <Card>
              <CardHeader
                title={`${history.sessions.length} session${history.sessions.length === 1 ? "" : "s"}`}
                subtitle="Newest first"
              />
              <ul className="divide-y divide-hairline">
                {history.sessions.map((s: SessionHistoryRow) => (
                  <li key={s.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="text-sm font-semibold text-ink-high">{fmtDate(s.day_key)}</span>
                      <span className="font-mono text-[11px] text-ink-low">
                        {fmtMinutes(s.duration_seconds)} · {s.tasks_done}/{s.tasks_done + s.tasks_skipped} tasks
                      </span>
                      <Badge tone={s.status === "completed" ? "ok" : s.status === "abandoned" ? "neutral" : "info"}>
                        {s.status}
                      </Badge>
                    </div>
                    {s.topics.length > 0 ? (
                      <p className="mt-0.5 text-[12px] text-ink-medium">{s.topics.map(titleCase).join(", ")}</p>
                    ) : null}
                    {s.notes ? <p className="mt-1 text-[12px] text-ink-medium italic">{s.notes}</p> : null}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function titleCase(slug: string): string {
  return slug.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
