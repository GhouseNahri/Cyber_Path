"use client";

import { useTransition } from "react";
import { Badge, Button } from "@/components/ui";
import { setConfidence, setStage, setTopicStatus } from "@/lib/roadmap/actions";
import {
  STAGE_META,
  STAGE_ORDER,
  type StageKey,
  type UserTopicProgress,
} from "@/lib/roadmap/types";

type Props = {
  topicSlug: string;
  topicTitle: string;
  locked: boolean;
  unmetTitles: string[];
  progress: UserTopicProgress;
};

const CONFIDENCE_LABELS: Record<number, string> = {
  1: "Barely understand it",
  2: "Understand the basics",
  3: "Can explain it",
  4: "Can use it",
  5: "Can teach / troubleshoot it",
};

export function StageTracker({ topicSlug, topicTitle, locked, unmetTitles, progress }: Props) {
  const [pending, startTransition] = useTransition();

  if (locked) {
    return (
      <div className="rounded-xl border border-warn/30 bg-warn/10 p-4" role="status">
        <p className="text-sm font-semibold text-warn">This topic is locked</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-medium">
          Complete {unmetTitles.map((t) => `“${t}”`).join(" and ")} first —{" "}
          {topicTitle} builds directly on it.
        </p>
      </div>
    );
  }

  const active = progress.status !== "not_started";
  const stagesDone = STAGE_ORDER.filter((s) => progress.stages[s]).length;

  function toggle(stage: StageKey, done: boolean) {
    startTransition(async () => {
      await setStage(topicSlug, stage, done);
    });
  }

  function start() {
    startTransition(async () => {
      await setTopicStatus(topicSlug, "in_progress");
    });
  }

  function reset() {
    startTransition(async () => {
      await setTopicStatus(topicSlug, "not_started");
    });
  }

  function rateConfidence(value: number) {
    startTransition(async () => {
      await setConfidence(topicSlug, value);
    });
  }

  return (
    <div className="space-y-5">
      {/* Stage checklist */}
      <ul className="space-y-2" aria-label={`${topicTitle} learning stages`}>
        {STAGE_ORDER.map((stage) => {
          const done = progress.stages[stage];
          const hint = STAGE_META[stage];
          return (
            <li key={stage}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                  done
                    ? "border-ok/40 bg-ok/[0.07]"
                    : "border-hairline bg-surface-2/40 hover:border-accent/40 hover:bg-surface-2/70"
                } ${pending ? "opacity-70" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={done}
                  disabled={pending}
                  onChange={(e) => toggle(stage, e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent"
                  aria-label={`${hint.label}: ${hint.blurb}`}
                />
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${done ? "text-ok" : "text-ink-high"}`}>
                    {hint.label}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-medium">
                    {hint.blurb}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {/* Status row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {progress.status === "completed" ? (
            <Badge tone="ok">Completed</Badge>
          ) : active ? (
            <Badge tone="accent">In progress · {stagesDone}/4 stages</Badge>
          ) : (
            <Badge tone="neutral">Not started</Badge>
          )}
          {progress.confidence ? (
            <Badge tone="info">Confidence {progress.confidence}/5</Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {!active ? (
            <Button size="sm" onClick={start} disabled={pending}>
              Start this topic
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={reset} disabled={pending}>
              Reset progress
            </Button>
          )}
        </div>
      </div>

      {/* Confidence */}
      {active ? (
        <fieldset className="rounded-xl border border-hairline bg-surface-2/40 p-4">
          <legend className="px-1 text-[13px] font-medium text-ink-high">How confident are you?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => rateConfidence(value)}
                disabled={pending}
                aria-pressed={progress.confidence === value}
                title={CONFIDENCE_LABELS[value]}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  progress.confidence === value
                    ? "border-accent/60 bg-accent/10 text-accent-soft"
                    : "border-hairline bg-surface-2/60 text-ink-medium hover:text-ink-high"
                }`}
              >
                <span className="font-mono text-[11px]">{value}</span>
                <span className="hidden sm:inline">{CONFIDENCE_LABELS[value]}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-ink-low">
            Honest ratings shape what you&apos;re recommended next — there&apos;s no reward for inflating it.
          </p>
        </fieldset>
      ) : null}
    </div>
  );
}
