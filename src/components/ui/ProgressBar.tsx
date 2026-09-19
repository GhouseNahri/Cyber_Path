/** Horizontal progress bar with honest 0% support and accessible labeling. */

type ProgressBarProps = {
  /** 0–100, clamped. */
  value: number;
  label: string;
  tone?: "accent" | "ok" | "warn";
  className?: string;
};

export function ProgressBar({ value, label, tone = "accent", className = "" }: ProgressBarProps) {
  const pct = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className={`h-2 w-full overflow-hidden rounded-full bg-surface-3 ${className}`}
    >
      <div
        className={
          tone === "ok" ? "h-full rounded-full bg-ok" : tone === "warn" ? "h-full rounded-full bg-warn" : "h-full rounded-full bg-accent"
        }
        style={{ width: `${pct}%`, transition: "width var(--dur-slow) var(--ease-out-expo)" }}
      />
    </div>
  );
}
