import type { MonthBucketView, SkillGrowthPointView, TypeMixView } from "@/lib/analytics/labs-queries";

/** One bar per month — completions only, honest zero months. */
export function MonthlyLabBars({ buckets }: { buckets: MonthBucketView[] }) {
  const max = Math.max(...buckets.map((b) => b.completed), 1);
  return (
    <div role="img" aria-label="Completed labs per month for the last 6 months" className="w-full">
      <div className="flex h-28 items-end gap-2">
        {buckets.map((b) => {
          const h = b.completed > 0 ? Math.max(3, (b.completed / max) * 100) : 2;
          return (
            <div
              key={b.key}
              className="flex min-w-0 flex-1 flex-col items-center justify-end"
              title={`${b.label}: ${b.completed} completed`}
            >
              <div
                className={`w-full rounded-t-sm ${b.completed > 0 ? "bg-accent/80" : "bg-ink-low/15"}`}
                style={{ height: `${h}%` }}
              />
              <span className="mt-1 text-[9px] text-ink-low">{b.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Cumulative labs (bars) + distinct evidenced skills (line overlay), drawn
 * as a lightweight inline SVG — no chart library.
 */
export function SkillGrowthChart({ points }: { points: SkillGrowthPointView[] }) {
  const w = 100;
  const h = 100;
  const maxLabs = Math.max(...points.map((p) => p.labs), 1);
  const maxSkills = Math.max(...points.map((p) => p.skills), 1);
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  const linePoints = points
    .map((p, i) => {
      const x = i * step;
      const y = h - (p.skills / maxSkills) * (h - 12);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div role="img" aria-label="Cumulative completed labs and distinct skills per month" className="w-full">
      <div className="relative h-28 w-full">
        <div className="absolute inset-0 flex items-end gap-2">
          {points.map((p) => {
            const bh = p.labs > 0 ? Math.max(3, (p.labs / maxLabs) * 100) : 2;
            return (
              <div
                key={p.key}
                className="flex min-w-0 flex-1 flex-col items-center justify-end"
                title={`${p.label}: ${p.labs} lab${p.labs === 1 ? "" : "s"}, ${p.skills} skill${p.skills === 1 ? "" : "s"}`}
              >
                <div
                  className={`w-full rounded-t-sm ${p.labs > 0 ? "bg-accent/50" : "bg-ink-low/15"}`}
                  style={{ height: `${bh}%` }}
                />
              </div>
            );
          })}
        </div>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden="true"
        >
          <polyline
            points={linePoints}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            className="text-accent"
          />
        </svg>
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-low">
        <span>{points[0]?.label ?? ""}</span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2 rounded-sm bg-accent/50" /> labs
          <span aria-hidden className="ml-1 inline-block h-0.5 w-3 bg-accent" /> skills
        </span>
        <span>{points.at(-1)?.label ?? ""}</span>
      </div>
    </div>
  );
}

/** Horizontal share bars for the completed-by-type mix. */
export function LabTypeBars({ mix }: { mix: TypeMixView[] }) {
  const max = Math.max(...mix.map((c) => c.count), 1);
  return (
    <ul className="space-y-2">
      {mix.map((c) => (
        <li key={c.labType}>
          <div className="flex items-baseline justify-between gap-2 text-[12px]">
            <span className="text-ink-medium">{c.label}</span>
            <span className="font-mono text-ink-low">{c.count}</span>
          </div>
          <div
            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
            role="img"
            aria-label={`${c.label}: ${c.count} completed`}
          >
            <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.max(8, (c.count / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
