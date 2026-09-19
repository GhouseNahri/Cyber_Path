import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium tracking-tight " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out-expo " +
  "focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 select-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink shadow-rest hover:bg-accent-soft hover:shadow-lift active:translate-y-px",
  secondary:
    "border border-hairline-strong bg-surface-2 text-ink-high hover:bg-surface-3 hover:border-accent/40 active:translate-y-px",
  ghost: "text-ink-medium hover:bg-surface-2 hover:text-ink-high",
  danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: Omit<BaseProps, "children">): string {
  return [base, variants[variant], sizes[size], className].filter(Boolean).join(" ");
}

type ButtonProps = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
    href?: undefined;
  };

type ButtonLinkProps = BaseProps & {
  href: string;
  external?: boolean;
  "aria-label"?: string;
};

/** Button visual, real element: <button> or <a> (internal via next/link). */
export function Button(props: ButtonProps | ButtonLinkProps) {
  const { variant, size, className = "", children } = props;
  const cls = buttonClasses({ variant, size, className });

  if ("href" in props && props.href) {
    if (props.external) {
      return (
        <a href={props.href} className={cls} target="_blank" rel="noopener noreferrer" aria-label={props["aria-label"]}>
          {children}
        </a>
      );
    }
    return (
      <Link href={props.href} className={cls} aria-label={props["aria-label"]}>
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, className: _c, children: _n, ...rest } = props as ButtonProps;
  return (
    <button {...rest} className={cls}>
      {children}
    </button>
  );
}
