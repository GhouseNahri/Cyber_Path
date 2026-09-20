"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonClasses } from "@/components/ui";
import { setRevisionIntervals } from "@/lib/revision/actions";
import { DEFAULT_INTERVALS } from "@/lib/revision/engine";

/** Editable spaced-repetition ladder. 1–6 positive day-steps, ascending.
 *  Changes affect future scheduling only — existing reviews keep their dates. */
export function RevisionIntervalsForm({ initial }: { initial: number[] }) {
  const [text, setText] = useState(initial.join(", "));
  const [message, setMessage] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const save = () => {
    const parsed = text
      .split(/[,\s]+/)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isFinite(n));
    if (parsed.length === 0) {
      setMessage({ tone: "danger", text: "Enter at least one interval (days between reviews)." });
      return;
    }
    startTransition(async () => {
      const res = await setRevisionIntervals(parsed);
      if (res.ok) {
        setText(parsed.join(", "));
        setMessage({ tone: "ok", text: "Schedule saved — it applies to reviews scheduled from now on." });
        router.refresh();
      } else {
        setMessage({ tone: "danger", text: res.error });
      }
    });
  };

  const dirty = text !== initial.join(", ");

  return (
    <div>
      <label htmlFor="revision-intervals" className="block text-sm font-medium text-ink-high">
        Days between reviews
      </label>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-medium">
        Comma-separated ladder, up to 6 steps. Default: {DEFAULT_INTERVALS.join(", ")}. Changing this
        affects reviews scheduled from now on — already-scheduled dates stay put.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          id="revision-intervals"
          value={text}
          onChange={(e) => setText(e.target.value)}
          inputMode="numeric"
          className="w-56 rounded-xl border border-hairline bg-surface-2 px-3 py-2 font-mono text-sm text-ink-high placeholder:text-ink-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button type="button" onClick={save} disabled={pending || !dirty} className={buttonClasses({ variant: "primary", size: "sm" })}>
          {pending ? "Saving…" : "Save schedule"}
        </button>
        {dirty ? (
          <button
            type="button"
            onClick={() => {
              setText(initial.join(", "));
              setMessage(null);
            }}
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            Reset
          </button>
        ) : null}
      </div>
      {message ? (
        <p aria-live="polite" className={message.tone === "ok" ? "mt-2 text-sm text-ok" : "mt-2 text-sm text-danger"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
