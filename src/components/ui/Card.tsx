import type { ElementType, HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  as?: ElementType;
  /** Adds the subtle accent gradient along the top edge. */
  glow?: boolean;
  /** Extra padding scale; "none" for layout-embedded cards. */
  pad?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
};

const pads = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

export function Card({ as: Tag = "div", glow = false, pad = "md", className = "", children, ...rest }: CardProps) {
  const cls = [
    "surface-card",
    glow ? "surface-glow" : "",
    pads[pad],
    "transition-colors",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  );
}

type CardHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
};

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="font-display text-base font-semibold text-ink-high">{title}</h2>
        {subtitle ? <p className="mt-1 text-[13px] text-ink-medium">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
