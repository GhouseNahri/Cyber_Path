import type { DayBucket, WeekBucket } from "@/lib/analytics/engine";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-14" -> "14 Sep" (deterministic, no locale drift between server/client). */
function shortDate(key: string): string {
  const [y, m, d] = key.split("-");
  if (!y || !m || !d) return key;
  const mi = Number.parseInt(m, 10) - 1;
  return `${d} ${MONTHS[mi] ?? m}`;
}

function minutes(seconds: number): number {
  return Math.round(seconds / 60);
}

function fmtMinutes(m: number): string {
  if (m <= 0) return "0 min";
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

/** Vertical bars for the last n days. Zero days render as honest flat marks. */
export function DailyBarChart({ buckets, goalMinutes }: { buckets: DayBucket[]; goalMinutes: number }) {
  const max = Math.max(goalMinutes * 60, ...buckets.map((b) => b.seconds), 60);
  return (
    <div role="img" aria-label={`Daily study minutes for the last ${buckets.length} days`} className="w-full">
      <div className="relative flex h-32 items-end gap-[3px]">
        {goalMinutes > 0 ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent/40"
            style={{ bottom: `${Math.min(96, (goalMinutes * 60 / max) * 100)}%` }}
          />
        ) : null}
        {buckets.map((b) => {
          const m = minutes(b.seconds);
          const h = b.seconds > 0 ? Math.max(3, (b.seconds / max) * 100) : 2;
          const [y, mo, d] = b.key.split("-");
          const isMonday = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 12)).getUTCDay() === 1;
          return (
            <div key={b.key} className="flex min-w-0 flex-1 flex-col items-center justify-end" title={`${shortDate(b.key)}: ${fmtMinutes(m)}`}>
              <div
                className={`w-full rounded-t-sm transition-colors ${b.seconds > 0 ? "bg-accent/80" : "bg-ink-low/15"}`}
                style={{ height: `${h}%` }}
              />
              {isMonday ? <span className="mt-1 hidden text-[9px] text-ink-low sm:block">{shortDate(b.key).split(" ")[0]}</span> : <span className="mt-1 hidden h-[13px] sm:block" />}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-low">
        <span>{shortDate(buckets[0]?.key ?? "")}</span>
        <span>goal {goalMinutes}m/day</span>
        <span>{shortDate(buckets.at(-1)?.key ?? "")}</span>
      </div>
    </div>
  );
}

/** One bar per week; the current (partial) week is marked honestly. */
export function WeeklyBarChart({ buckets }: { buckets: WeekBucket[] }) {
  const max = Math.max(...buckets.map((b) => b.seconds), 60);
  return (
    <div role="img" aria-label="Weekly study minutes for the last 8 weeks" className="w-full">
      <div className="flex h-28 items-end gap-2">
        {buckets.map((w) => {
          const m = minutes(w.seconds);
          const h = w.seconds > 0 ? Math.max(3, (w.seconds / max) * 100) : 2;
          return (
            <div key={w.startKey} className="flex min-w-0 flex-1 flex-col items-center justify-end" title={`Week of ${shortDate(w.startKey)}: ${fmtMinutes(m)} across ${w.days} day${w.days === 1 ? "" : "s"}`}>
              <div
                className={`w-full rounded-t-sm ${w.seconds > 0 ? "bg-accent/80" : "bg-ink-low/15"}`}
                style={{ height: `${h}%` }}
              />
              <span className="mt-1 text-[9px] text-ink-low">{shortDate(w.startKey)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Horizontal share bars for missed-day reasons. */
export function ReasonBars({ byCategory }: { byCategory: { category: string; count: number }[] }) {
  const max = Math.max(...byCategory.map((c) => c.count), 1);
  return (
    <ul className="space-y-2">
      {byCategory.map((c) => (
        <li key={c.category}>
          <div className="flex items-baseline justify-between gap-2 text-[12px]">
            <span className="text-ink-medium">{c.category.replace(/_/g, " ")}</span>
            <span className="font-mono text-ink-low">{c.count}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${c.category.replace(/_/g, " ")}: ${c.count} days`}>
            <div className="h-full rounded-full bg-warn/70" style={{ width: `${Math.max(8, (c.count / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
