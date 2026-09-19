import { Badge } from "./Badge";

type StatCardProps = {
  label: string;
  value: string;
  /** Optional sub-line, e.g. "this week" or a delta. */
  hint?: string;
  tone?: "neutral" | "accent" | "ok" | "warn";
  icon?: React.ReactNode;
};

const toneRing: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "text-ink-medium",
  accent: "text-accent",
  ok: "text-ok",
  warn: "text-warn",
};

/** Compact stat for dashboard metrics. Value is caller-supplied — the card
 *  never invents numbers, which keeps zero states honest. */
export function StatCard({ label, value, hint, tone = "neutral", icon }: StatCardProps) {
  return (
    <div className="surface-card flex flex-col gap-1 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-medium">{label}</span>
        {icon ? <span className={toneRing[tone]} aria-hidden="true">{icon}</span> : null}
      </div>
      <div className="font-display text-2xl font-semibold tabular-nums text-ink-high">{value}</div>
      {hint ? (
        <div className="text-xs text-ink-medium">
          {hint}
        </div>
      ) : null}
      {/* Screen-reader-friendly semantic label */}
      <span className="sr-only">{`${label}: ${value}${hint ? ` (${hint})` : ""}`}</span>
    </div>
  );
}

export { Badge };
