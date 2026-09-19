import { buttonClasses } from "./Button";

type ErrorStateProps = {
  title?: string;
  message?: string;
  /** Optional reset function handed over by Next.js error boundaries. */
  reset?: () => void;
};

/** Friendly error state — never renders raw error details to the user. */
export function ErrorState({ title = "Something went wrong", message, reset }: ErrorStateProps) {
  return (
    <div className="surface-card surface-glow mx-auto max-w-lg p-8 text-center">
      <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-danger/15 text-danger" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
          <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="font-display text-lg font-semibold text-ink-high">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-medium">
        {message ?? "An unexpected error occurred. Your data is safe — try again in a moment."}
      </p>
      {reset ? (
        <div className="mt-6">
          <button onClick={reset} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}
