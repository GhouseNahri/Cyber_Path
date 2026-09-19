import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "ok" | "warn" | "danger" | "info";

const tones: Record<BadgeTone, string> = {
  neutral: "border-hairline bg-surface-2 text-ink-medium",
  accent: "border-transparent bg-accent/15 text-accent-soft",
  ok: "border-transparent bg-ok/15 text-ok",
  warn: "border-transparent bg-warn/15 text-warn",
  danger: "border-transparent bg-danger/15 text-danger",
  info: "border-transparent bg-info/15 text-info",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
