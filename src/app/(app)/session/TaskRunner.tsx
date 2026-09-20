"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, CardHeader, buttonClasses } from "@/components/ui";
import { completeTask, skipTask, startTask } from "@/lib/session/task-actions";
import { endSession, pauseSession, resumeSession, startSession } from "@/lib/session/actions";
import { elapsedSeconds } from "@/lib/session/elapsed";
import {
  DIFFICULTY_LABELS,
  SKIP_REASONS,
  SKIP_REASON_LABELS,
  TASK_KIND_META,
  type DailyTask,
  type Mission,
  type StudySession,
  type TaskDifficulty,
  type SkipReason,
} from "@/lib/session/types";

type Props = {
  mission: Mission;
  session: StudySession | null;
  goalMinutes: number;
};

function fmtClock(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function fmtMinutes(sec: number | null): string {
  if (sec === null) return "—";
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

/**
 * Live elapsed seconds via the shared pure module — the server stays the
 * source of truth; this only renders it. Paused sessions freeze at the
 * pause moment (last_resumed_at).
 */
function useLiveElapsed(session: StudySession | null): number {
  const [now, setNow] = useState(() => Date.now());
  const open = !!session && (session.status === "active" || session.status === "paused");

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [open]);

  return useMemo(
    () => (session ? elapsedSeconds(session, now) : 0),
    [session, now],
  );
}

export function TaskRunner({ mission, session, goalMinutes }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Completion flow state
  const [difficulty, setDifficulty] = useState<TaskDifficulty | null>(null);
  const [taskNote, setTaskNote] = useState("");
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [showSkipForm, setShowSkipForm] = useState(false);
  const [skipReason, setSkipReason] = useState<SkipReason>("not_enough_time");
  const [skipText, setSkipText] = useState("");
  const [sessionNotes, setSessionNotes] = useState(session?.notes ?? "");

  const openSession = !!session && (session.status === "active" || session.status === "paused");
  const elapsed = useLiveElapsed(session);

  const tasks = mission.tasks;
  const settledCount = tasks.filter((t) => t.status === "completed" || t.status === "skipped").length;
  const doneCount = tasks.filter((t) => t.status === "completed").length;
  const skippedCount = tasks.filter((t) => t.status === "skipped").length;
  const focused = tasks.find((t) => t.status === "not_started" || t.status === "in_progress") ?? null;
  const focusedIndex = focused ? tasks.findIndex((t) => t.id === focused.id) : -1;
  const topicsTouched = [...new Set(tasks.filter((t) => t.status === "completed").map((t) => t.topic_slug))];

  // Auto-start the focused task while the session runs (honest per-task timing).
  useEffect(() => {
    if (!openSession || !focused || focused.status !== "not_started" || pending) return;
    let cancelled = false;
    startTransition(async () => {
      const res = await startTask(focused.id);
      if (!cancelled && !res.ok) setError(res.error);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSession, focused?.id, focused?.status]);

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    const res = await fn();
    if (!res.ok) setError(res.error);
    startTransition(() => router.refresh());
  }

  const handleStart = () => run(async () => startSession());
  const handlePause = () => session && run(() => pauseSession(session.id));
  const handleResume = () => session && run(() => resumeSession(session.id));

  const handleComplete = () => {
    if (!focused) return;
    return run(async () => {
      const res = await completeTask(focused.id, { difficulty, note: taskNote || null });
      if (!res.ok) return res;
      setDifficulty(null);
      setTaskNote("");
      setShowCompleteForm(false);
      return res;
    });
  };

  const handleSkip = () => {
    if (!focused) return;
    return run(async () => {
      const res = await skipTask(focused.id, skipReason, skipText || null);
      if (!res.ok) return res;
      setSkipText("");
      setShowSkipForm(false);
      return res;
    });
  };

  const handleEnd = (status: "completed" | "abandoned") => {
    if (!session) return;
    return run(async () => endSession({ sessionId: session.id, status, notes: sessionNotes || undefined }));
  };

  // ── Session summary view ────────────────────────────────────────────────
  if (session && (session.status === "completed" || session.status === "abandoned")) {
    const pct = tasks.length > 0 ? Math.round((settledCount / tasks.length) * 100) : 0;
    return (
      <Card glow>
        <CardHeader
          title="Session complete"
          subtitle={session.status === "completed" ? "Logged to your history" : "Ended early — time up to the pause moment was kept"}
        />
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="font-display text-3xl font-semibold text-gradient">{fmtMinutes(session.duration_seconds)}</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">studied</p>
          </div>
          <div>
            <p className="font-display text-3xl font-semibold">{doneCount}/{tasks.length}</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">tasks done</p>
          </div>
          <div>
            <p className="font-display text-3xl font-semibold">{pct}%</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">of mission</p>
          </div>
        </div>
        {topicsTouched.length > 0 ? (
          <p className="mt-4 border-t border-hairline pt-4 text-[13px] text-ink-medium">
            Topics: {topicsTouched.join(", ")}
          </p>
        ) : null}
        {session.notes ? (
          <p className="mt-2 text-[13px] text-ink-medium">
            <span className="font-semibold text-ink-high">Notes: </span>
            {session.notes}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {tasks.some((t) => t.status === "not_started" || t.status === "in_progress") ? (
            <Button onClick={handleStart} disabled={pending} variant="primary" size="sm">
              Start another session
            </Button>
          ) : null}
          <Link href="/" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Back to dashboard
          </Link>
          <Link href="/history" className={buttonClasses({ variant: "ghost", size: "sm" })}>
            View history
          </Link>
        </div>
      </Card>
    );
  }

  // ── Not started yet ─────────────────────────────────────────────────────
  if (!openSession) {
    const unfinished = tasks.some((t) => t.status === "not_started" || t.status === "in_progress");
    return (
      <Card>
        <CardHeader
          title={mission.settled && !unfinished ? "Mission settled" : "Ready when you are"}
          subtitle={`${doneCount} done · ${skippedCount} skipped · ${fmtMinutes(mission.remainingMinutes * 60)} remaining`}
        />
        {tasks.length === 0 ? (
          <p className="text-[13px] text-ink-medium">
            Nothing unlocked and unfinished right now — check the roadmap.
          </p>
        ) : mission.settled && !unfinished ? (
          <p className="text-[13px] text-ink-medium">
            Every task is settled. Starting another session logs honest time on an empty mission — come back tomorrow,
            or revisit topics from the roadmap.
          </p>
        ) : (
          <p className="text-[13px] text-ink-medium">
            {tasks.length} task{tasks.length === 1 ? "" : "s"} planned · {mission.remainingMinutes} min · one focused
            task at a time.
          </p>
        )}
        {unfinished ? (
          <div className="mt-4">
            <Button onClick={handleStart} disabled={pending} variant="primary">
              Start session
            </Button>
          </div>
        ) : null}
        {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
      </Card>
    );
  }

  // ── Running session: focused task mode ─────────────────────────────────
  const progressPct = tasks.length > 0 ? Math.round((settledCount / tasks.length) * 100) : 0;
  const paused = session.status === "paused";

  return (
    <div className="space-y-5">
      {/* Session bar */}
      <Card pad="sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">
              Session · task {focused ? focusedIndex + 1 : settledCount} of {tasks.length}
              {paused ? " · paused" : ""}
            </p>
            <p className="mt-1 font-display text-4xl font-semibold tabular-nums" aria-live={paused ? "polite" : "off"}>
              {fmtClock(elapsed)}
            </p>
            <p className="font-mono text-[11px] text-ink-low">
              goal {goalMinutes} min · {doneCount} done · {skippedCount} skipped
            </p>
          </div>
          <div className="flex items-center gap-2">
            {paused ? (
              <Button onClick={handleResume} disabled={pending} variant="secondary" size="sm">
                Resume
              </Button>
            ) : (
              <Button onClick={handlePause} disabled={pending} variant="secondary" size="sm">
                Pause
              </Button>
            )}
            <Button onClick={() => handleEnd("abandoned")} disabled={pending} variant="ghost" size="sm">
              End session
            </Button>
          </div>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Mission progress"
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </Card>

      {error ? (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {/* Focused task */}
      {focused ? (
        <Card glow>
          <CardHeader
            title={focused.title}
            subtitle={`${TASK_KIND_META[focused.kind].label} · ~${focused.planned_minutes} min planned`}
            action={<Badge tone={paused ? "warn" : "accent"}>{paused ? "paused" : "in progress"}</Badge>}
          />
          <p className="text-[13px] leading-relaxed text-ink-medium">{focused.why}</p>

          {focused.resource_url ? (
            <p className="mt-2 text-[13px]">
              <a
                href={focused.resource_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent hover:underline"
              >
                Open resource: {focused.resource_title ?? "linked material"} ↗
              </a>
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                setShowCompleteForm((v) => !v);
                setShowSkipForm(false);
              }}
              disabled={pending || paused}
              variant="primary"
              size="sm"
            >
              Complete task
            </Button>
            <Button
              onClick={() => {
                setShowSkipForm((v) => !v);
                setShowCompleteForm(false);
              }}
              disabled={pending || paused}
              variant="ghost"
              size="sm"
            >
              Skip
            </Button>
            {paused ? (
              <span className="text-[12px] text-warn">Paused — resume to keep working.</span>
            ) : null}
          </div>

          {/* Complete form: difficulty + optional note */}
          {showCompleteForm ? (
            <div className="mt-4 space-y-3 rounded-xl border border-hairline bg-surface-2/30 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">
                How difficult was this? (optional)
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Difficulty">
                {([1, 2, 3, 4, 5] as TaskDifficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(difficulty === d ? null : d)}
                    aria-pressed={difficulty === d}
                    className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors ${
                      difficulty === d
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-hairline text-ink-medium hover:border-accent/50"
                    }`}
                  >
                    {d} · {DIFFICULTY_LABELS[d]}
                  </button>
                ))}
              </div>
              <label htmlFor="task-note" className="block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">
                What did you learn? (optional)
              </label>
              <textarea
                id="task-note"
                value={taskNote}
                onChange={(e) => setTaskNote(e.target.value)}
                rows={2}
                maxLength={2000}
                className="w-full resize-y rounded-lg border border-hairline bg-surface-1 px-3 py-2 text-sm text-ink-high placeholder:text-ink-low focus:border-accent focus:outline-none"
                placeholder="One line is plenty."
              />
              <Button onClick={handleComplete} disabled={pending} variant="primary" size="sm">
                Save &amp; complete
              </Button>
            </div>
          ) : null}

          {/* Skip form: reason + optional text (stored for Phase 7) */}
          {showSkipForm ? (
            <div className="mt-4 space-y-3 rounded-xl border border-hairline bg-surface-2/30 p-4">
              <label htmlFor="skip-reason" className="block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">
                Why are you skipping this?
              </label>
              <select
                id="skip-reason"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value as SkipReason)}
                className="w-full rounded-lg border border-hairline bg-surface-1 px-3 py-2 text-sm text-ink-high focus:border-accent focus:outline-none"
              >
                {SKIP_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {SKIP_REASON_LABELS[r]}
                  </option>
                ))}
              </select>
              <label htmlFor="skip-text" className="block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">
                Anything more? (optional)
              </label>
              <input
                id="skip-text"
                type="text"
                value={skipText}
                onChange={(e) => setSkipText(e.target.value)}
                maxLength={500}
                className="w-full rounded-lg border border-hairline bg-surface-1 px-3 py-2 text-sm text-ink-high focus:border-accent focus:outline-none"
                placeholder="A sentence is plenty."
              />
              <Button onClick={handleSkip} disabled={pending} variant="secondary" size="sm">
                Skip task
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        /* All settled while session still open */
        <Card glow>
          <CardHeader title="All tasks settled" subtitle="End the session to log it" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => handleEnd("completed")} disabled={pending} variant="primary" size="sm">
              Finish session
            </Button>
          </div>
        </Card>
      )}

      {/* Session notes */}
      <Card pad="sm">
        <label htmlFor="session-notes" className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">
          Session notes (saved when the session ends)
        </label>
        <textarea
          id="session-notes"
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          rows={2}
          maxLength={2000}
          className="mt-2 w-full resize-y rounded-lg border border-hairline bg-surface-2/40 px-3 py-2 text-sm text-ink-high placeholder:text-ink-low focus:border-accent focus:outline-none"
          placeholder="What clicked? What didn't?"
        />
      </Card>

      {/* Remaining task list (compact) */}
      {tasks.length > 1 ? (
        <Card pad="sm">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">Mission overview</p>
          <ul className="mt-2 space-y-1.5">
            {tasks.map((t: DailyTask, i: number) => (
              <li key={t.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className={t.status === "completed" ? "text-ink-low line-through" : t.id === focused?.id ? "font-medium text-ink-high" : "text-ink-medium"}>
                  {String(i + 1).padStart(2, "0")} · {t.title}
                </span>
                <Badge tone={t.status === "completed" ? "ok" : t.status === "skipped" ? "neutral" : t.status === "in_progress" ? "accent" : "info"}>
                  {t.status === "completed" ? "done" : t.status === "skipped" ? "skipped" : t.status === "in_progress" ? "current" : "queued"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
