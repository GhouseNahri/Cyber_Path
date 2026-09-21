"use client";

import { useState, useTransition } from "react";
import { Badge, Button, buttonClasses } from "@/components/ui";
import { submitQuizAttempt } from "@/lib/quiz/actions";
import type { AttemptSummary, ClientQuestion } from "@/lib/quiz/queries";
import { PASS_PCT } from "@/lib/quiz/engine";

type ReviewItem = {
  position: number;
  correct: boolean;
  correctChoiceId: string;
  chosen: string | null;
  explanation: string;
};

type ResultState = {
  passed: boolean;
  scorePct: number;
  correctCount: number;
  total: number;
  attemptNumber: number;
  review: ReviewItem[];
};

type Props = {
  topicSlug: string;
  questions: ClientQuestion[];
  attempts: AttemptSummary[];
  bestPct: number | null;
  passed: boolean;
};

const KIND_LABEL: Record<ClientQuestion["kind"], string> = {
  mcq: "multiple choice",
  tf: "true or false",
  scenario: "scenario",
};

/**
 * Per-topic knowledge check. Questions arrive WITHOUT answers (stripped
 * server-side); scoring happens in the submit action. One question at a
 * time, keyboard-navigable, with a per-question explanation review after
 * submitting.
 */
export function QuizCard({ topicSlug, questions, attempts, bestPct, passed }: Props) {
  const [mode, setMode] = useState<"idle" | "running" | "done">("idle");
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<(string | null)[]>(() => questions.map(() => null));
  const [result, setResult] = useState<ResultState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = questions[idx];
  const answeredCount = picked.filter((p) => p !== null).length;
  const allAnswered = answeredCount === questions.length;

  function start() {
    setPicked(questions.map(() => null));
    setIdx(0);
    setResult(null);
    setError(null);
    setMode("running");
  }

  function choose(choiceId: string) {
    setPicked((prev) => prev.map((p, i) => (i === idx ? choiceId : p)));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await submitQuizAttempt(topicSlug, picked);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res);
      setMode("done");
    });
  }

  // ── Results view ──────────────────────────────────────────────────────
  if (mode === "done" && result) {
    return (
      <div>
        <div
          className={
            result.passed
              ? "rounded-xl border border-ok/30 bg-ok/[0.07] p-4"
              : "rounded-xl border border-warn/30 bg-warn/[0.07] p-4"
          }
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-lg font-semibold">{result.passed ? "Passed" : "Not this time"}</p>
            <Badge tone={result.passed ? "ok" : "warn"}>attempt {result.attemptNumber}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-medium">
            {result.correctCount}/{result.total} correct · {result.scorePct}% (pass is {PASS_PCT}%)
          </p>
          {!result.passed ? (
            <p className="mt-1 text-[13px] text-ink-medium">
              Read the explanations below, revisit the topic, and try again — attempts are unlimited.
            </p>
          ) : null}
        </div>

        <ul className="mt-4 space-y-3">
          {questions.map((q) => {
            const r = result.review.find((x) => x.position === q.position);
            const chosenText = q.choices.find((c) => c.id === r?.chosen)?.text ?? "left unanswered";
            const correctText = q.choices.find((c) => c.id === r?.correctChoiceId)?.text ?? "";
            return (
              <li key={q.position} className="rounded-xl border border-hairline bg-surface-2/40 p-4">
                <div className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 font-mono text-sm ${r?.correct ? "text-ok" : "text-warn"}`}
                  >
                    {r?.correct ? "✓" : "✗"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-high">{q.question}</p>
                    <p className="mt-1 text-[13px] text-ink-medium">
                      You chose: <span className={r?.correct ? "text-ok" : "text-warn"}>{chosenText}</span>
                    </p>
                    {!r?.correct ? (
                      <p className="text-[13px] text-ink-medium">
                        Correct: <span className="text-ok">{correctText}</span>
                      </p>
                    ) : null}
                    {r?.explanation ? (
                      <p className="mt-1.5 border-t border-hairline pt-1.5 text-[13px] leading-relaxed text-ink-medium">
                        {r.explanation}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={start}>
            Retake quiz
          </Button>
        </div>
      </div>
    );
  }

  // ── Running view ──────────────────────────────────────────────────────
  if (mode === "running" && current) {
    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">
            Question {idx + 1} of {questions.length} · {KIND_LABEL[current.kind]}
          </p>
          <div className="flex gap-1.5" aria-hidden="true">
            {questions.map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full ${
                  picked[i] ? "bg-accent" : i === idx ? "bg-ink-medium" : "bg-ink-low/40"
                }`}
              />
            ))}
          </div>
        </div>

        <p className="mt-3 text-sm font-medium leading-relaxed text-ink-high" aria-live="polite">
          {current.question}
        </p>

        <div className="mt-3 space-y-2" role="radiogroup" aria-label={`Question ${idx + 1} choices`}>
          {current.choices.map((c) => {
            const selected = picked[idx] === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => choose(c.id)}
                className={`flex w-full items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-[13px] leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                  selected
                    ? "border-accent/60 bg-accent/[0.08] text-ink-high"
                    : "border-hairline bg-surface-2/40 text-ink-medium hover:border-accent/30 hover:text-ink-high"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
                    selected ? "border-accent bg-accent/20" : "border-ink-low/50"
                  }`}
                >
                  {selected ? <span className="size-1.5 rounded-full bg-accent" /> : null}
                </span>
                {c.text}
              </button>
            );
          })}
        </div>

        {error ? (
          <p
            className="mt-3 rounded-lg border border-danger/30 bg-danger/[0.07] px-3 py-2 text-[13px] text-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIdx((v) => Math.max(0, v - 1))}
            disabled={idx === 0 || pending}
          >
            Back
          </Button>
          {idx < questions.length - 1 ? (
            <Button variant="primary" size="sm" onClick={() => setIdx((v) => v + 1)}>
              Next
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={submit} disabled={!allAnswered || pending}>
              {pending ? "Scoring…" : `Submit (${answeredCount}/${questions.length})`}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Idle view ─────────────────────────────────────────────────────────
  return (
    <div>
      {attempts.length > 0 ? (
        <div className="mb-4 space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">
            {attempts.length} attempt{attempts.length === 1 ? "" : "s"} · best {bestPct}% ·{" "}
            {passed ? "passed" : `pass is ${PASS_PCT}%`}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {attempts.slice(-6).map((a) => (
              <li key={a.attempt_number}>
                <Badge tone={a.passed ? "ok" : a.score_pct >= PASS_PCT - 20 ? "warn" : "neutral"}>
                  #{a.attempt_number} · {a.score_pct}%
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[13px] leading-relaxed text-ink-medium">
          {questions.length} questions — scenarios, concepts, and judgment calls. {PASS_PCT}% to pass; the quiz
          marks the Test stage when you do.
        </p>
      )}
      {error ? (
        <p
          className="mb-3 rounded-lg border border-danger/30 bg-danger/[0.07] px-3 py-2 text-[13px] text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <button type="button" className={buttonClasses({ variant: "primary", size: "sm" })} onClick={start}>
        {attempts.length === 0 ? "Start quiz" : passed ? "Practice again" : "Try again"}
      </button>
    </div>
  );
}
