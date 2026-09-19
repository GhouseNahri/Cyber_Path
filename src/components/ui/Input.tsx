import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Small helper text shown under the label. */
  hint?: ReactNode;
  /** Field-level error message (replaces hint visually). */
  error?: string | null;
};

/** Accessible labeled input: real <label htmlFor>, error wiring via
 *  aria-describedby/aria-invalid. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className = "", id: idProp, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const descId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={`w-full ${className}`}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-high">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={descId}
        className={`block h-11 w-full rounded-xl border bg-surface-2/70 px-3.5 text-sm text-ink-high placeholder:text-ink-low transition-colors focus-visible:outline-none ${
          error ? "border-danger/60" : "border-hairline focus:border-accent/50"
        }`}
        {...rest}
      />
      {error ? (
        <p id={descId} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className="mt-1.5 text-xs text-ink-medium">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
