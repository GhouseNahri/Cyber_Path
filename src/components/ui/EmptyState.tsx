import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  body: string;
  icon?: ReactNode;
  /** Primary action — a real button or link provided by the caller. */
  action?: ReactNode;
  className?: string;
};

/** Honest empty state. Never invents data — describes what will exist and
 *  offers the next action. */
export function EmptyState({ title, body, icon, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`surface-glow flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline-strong bg-surface/60 px-6 py-10 text-center ${className}`}>
      {icon ? (
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-surface-2 text-accent" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-[15px] font-semibold text-ink-high">{title}</h3>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-medium">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
