/** Deterministic circular progress ring (SVG), accessible by default. */

type ProgressRingProps = {
  /** 0–100. Values are clamped; NaN/Infinity treated as 0. */
  value: number;
  size?: number;
  thickness?: number;
  label: string;
  /** Center caption above/below the percentage, e.g. "Phase 1". */
  caption?: string;
  className?: string;
};

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export function ProgressRing({
  value,
  size = 96,
  thickness = 8,
  label,
  caption,
  className = "",
}: ProgressRingProps) {
  const pct = clampPct(value);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div
      role="img"
      aria-label={`${label}: ${Math.round(pct)} percent`}
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true" focusable="false">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          className="stroke-surface-3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={depth(pct)}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className={pct >= 100 ? "stroke-ok" : "stroke-accent"}
          style={{ transition: "stroke-dasharray var(--dur-slow) var(--ease-out-expo)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-lg font-semibold tabular-nums text-ink-high">{Math.round(pct)}%</span>
        {caption ? <span className="text-[10px] uppercase tracking-[0.14em] text-ink-medium">{caption}</span> : null}
      </div>
    </div>
  );
}

function depth(pct: number): number {
  return 8;
}
