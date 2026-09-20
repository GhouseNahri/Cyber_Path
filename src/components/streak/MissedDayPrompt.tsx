"use client";

import { useTransition } from "react";
import { Badge, Card, CardHeader, buttonClasses } from "@/components/ui";
import { recordMissedDay } from "@/lib/streak/actions";
import { MISSED_REASON_LABELS, type MissedReasonCategory } from "@/lib/streak/messages";

const REASONS = Object.keys(MISSED_REASON_LABELS) as MissedReasonCategory[];

type Props = {
  /** The day being reported (yesterday in the user's timezone). */
  dayKey: string;
  /** Already-reported reason for this day, if any. */
  existingReason: string | null;
};

/** "What happened yesterday?" — honest self-report that Phase 7+ analytics
 *  will mine for patterns. Never shown for days the user actually studied. */
export function MissedDayPrompt({ dayKey, existingReason }: Props) {
  const [pending, startTransition] = useTransition();

  function submit(reason: MissedReasonCategory, text?: string) {
    startTransition(async () => {
      await recordMissedDay({ dayKey, reason, text });
    });
  }

  return (
    <Card>
      <CardHeader
        title="What happened yesterday?"
        subtitle="Be honest — the patterns help tune your daily plan"
        action={<Badge tone="warn">unlogged day</Badge>}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const custom = String(fd.get("reason_text") ?? "").trim();
          const checked = fd.get("reason");
          if (typeof checked === "string" && checked) submit(checked as MissedReasonCategory, custom || undefined);
        }}
      >
        <fieldset className="flex flex-wrap gap-2" disabled={pending}>
          <legend className="sr-only">Pick what happened</legend>
          {REASONS.map((r) => (
            <label key={r} className="cursor-pointer">
              <input type="radio" name="reason" value={r} className="peer sr-only" />
              <span className="inline-block rounded-full border border-hairline bg-surface-2 px-3 py-1.5 text-[13px] text-ink-medium transition-colors peer-checked:border-accent peer-checked:bg-accent/15 peer-checked:text-accent-soft peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                {MISSED_REASON_LABELS[r]}
              </span>
            </label>
          ))}
        </fieldset>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="reason_text" className="sr-only">
            Optional details
          </label>
          <input
            id="reason_text"
            name="reason_text"
            type="text"
            maxLength={500}
            placeholder="Optional — what got in the way?"
            className="min-w-0 flex-1 rounded-xl border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink-high placeholder:text-ink-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button type="submit" className={buttonClasses({ variant: "primary", size: "sm" })} disabled={pending}>
            {pending ? "Saving…" : "Log it"}
          </button>
        </div>
      </form>
    </Card>
  );
}
