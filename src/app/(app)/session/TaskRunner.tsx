"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardHeader, EmptyState, buttonClasses } from "@/components/ui";
import { endSession, setTaskStatus, startSession } from "@/lib/session/actions";
import { TASK_KIND_META, type DailyTask, type Mission, type StudySession } from "@/lib/session/types";

type Props = {
  mission: Mission;
  session: StudySession | null;
  goalMinutes: number;
};

/** Session timer: a 500ms interval recomputing elapsed wall-clock time from
 *  the session's real started_at — stays honest even in background tabs. */
function useElapsed(running: boolean, startedAtMs: number | null) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running || startedAtMs === null) return;
    const id = window.setInterval(() => {
      setElapsed(Math.max(0, Math.round((Date.now() - startedAtMs) / 1000)));
    }, 500);
    return () => window.clearInterval(id);
  }, [running, startedAtMs]);

  return elapsed;
}

export function TaskRunner({ mission, session, goalMinutes }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(session && !session.ended_at ? session.id : null);
  const [notes, setNotes] = useState("");
  const [showSummary, setShowSummary] = useState(mission.settled && !!session?.ended_at);
  const [summary, setSummary] = useState<{
    seconds: number;
    done: number;
    skipped: number;
    total: number;
    remaining: { slug: string; title: string }[];
  } | null>(null);

  const openSession = !!sessionId && !!session && !session.ended_at;
  const elapsed = useElapsed(openSession, openSession && session ? new Date(session.started_at).getTime() : null);

  const tasks = mission.tasks;
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const skippedCount = tasks.filter((t) => t.status === "skipped").length;

  async function handleStart() {
    setError(null);
    const res = await startSession();
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSessionId(res.sessionId ?? null);
    router.refresh();
  }

  async function handleTask(taskId: string, status: "done" | "skipped") {
    setError(null);
    const res = await setTaskStatus(taskId, status);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Recompute locally so the UI updates instantly; server data refreshes too.
    const remaining = pendingTasks.filter((t) => t.id !== taskId).map((t) => ({
      slug: t.topic_slug,
      title: t.title,
    }));
    if (remaining.length === 0) {
      const secs = elapsed;
      if (sessionId) {
        const endRes = await endSession({ sessionId, elapsedSeconds: secs });
        if (!endRes.ok) setError(endRes.error);
      }
      setSummary({ seconds: secs, done: doneCount + (status === "done" ? 1 : 0), skipped: skippedCount + (status === "skipped" ? 1 : 0), total: tasks.length, remaining: [] });
      setShowSummary(true);
    }
    startTransition(() => router.refresh());
  }

  async function handleEnd() {
    setError(null);
    if (!sessionId) return;
    const res = await endSession({ sessionId, elapsedSeconds: elapsed, notes });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSummary({
      seconds: elapsed,
      done: doneCount,
      skipped: skippedCount,
      total: tasks.length,
      remaining: pendingTasks.map((t) => ({ slug: t.topic_slug, title: t.title })),
    });
    setShowSummary(true);
    startTransition(() => router.refresh());
  }

  function fmt(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const plannedTotal = tasks.reduce((n, t) => n + t.planned_minutes, 0);

  // ── Summary view ──────────────────────────────────────────────────────
  if (showSummary && summary) {
    return (
      <Card glow>
        <CardHeader title="Session complete" subtitle="Logged to your history — this is real study time" />
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="font-display text-3xl font-semibold text-gradient">{fmt(summary.seconds)}</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">time</p>
          </div>
          <div>
            <p className="font-display text-3xl font-semibold">{summary.done}/{summary.total}</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">tasks done</p>
          </div>
          <div>
            <p className="font-display text-3xl font-semibold">{summary.skipped}</p>
            <p className="font-mono mt-1 text-[11px] uppercase tracking-[0.16em] text-ink-low">skipped</p>
          </div>
          <div className="col-span-3 mt-2 border-t border-hairline pt-4 text-left">
            <p className="text-[13px] text-ink-medium">
              {summary.remaining.length === 0
                ? "Every task settled. That's a full mission — see you tomorrow."
                : `${summary.remaining.length} task${summary.remaining.length === 1 ? "" : "s"} still open — they stay on today's mission.`}
            </p>
            <Link href="/" className={`${buttonClasses({ variant: "secondary", size: "sm" })} mt-3`}>
              Back to dashboard
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  // ── Runner view ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Timer bar */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">Session time</p>
            <p className="mt-1 font-display text-4xl font-semibold tabular-nums" aria-live="off">
              {fmt(elapsed)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {openSession ? (
              <Button onClick={handleEnd} disabled={pending} variant="primary" size="sm">
                End session
              </Button>
            ) : (
              <Button onClick={handleStart} disabled={pending} variant="primary" size="sm">
                {session && session.ended_at ? "Start another" : "Start session"}
              </Button>
            )}
          </div>
        </div>
        {!openSession && mission.settled && !session ? (
          <p className="mt-3 text-[13px] text-ink-medium">
            All tasks settled — starting logs an empty session. Complete a task first for honest time.
          </p>
        ) : null}
      </Card>

      {error ? (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {/* Tasks */}
      <ol className="space-y-3">
        {tasks.map((t: DailyTask, i: number) => (
          <li
            key={t.id}
            className={`rounded-xl border p-4 transition-colors ${
              t.status === "done"
                ? "border-ok/40 bg-ok/[0.06]"
                : t.status === "skipped"
                  ? "border-hairline bg-surface-2/30 opacity-70"
                  : "border-hairline bg-surface-2/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 font-mono text-[11px] text-ink-low">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${t.status === "done" ? "text-ok line-through decoration-ok/50" : "text-ink-high"}`}>
                  {t.title}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-medium">{t.why}</p>
                <p className="mt-1 font-mono text-[11px] text-ink-low">
                  {TASK_KIND_META[t.kind].label} · ~{t.planned_minutes} min
                  {t.status === "done" ? " · done" : t.status === "skipped" ? " · skipped" : ""}
                </p>
              </div>
              {t.status === "pending" ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    onClick={() => handleTask(t.id, "done")}
                    disabled={pending}
                    variant="secondary"
                    size="sm"
                  >
                    Done
                  </Button>
                  <Button
                    onClick={() => handleTask(t.id, "skipped")}
                    disabled={pending}
                    variant="ghost"
                    size="sm"
                  >
                    Skip
                  </Button>
                </div>
              ) : (
                <Badge tone={t.status === "done" ? "ok" : "neutral"}>
                  {t.status === "done" ? "Done" : "Skipped"}
                </Badge>
              )}
            </div>
          </li>
        ))}
      </ol>

      {tasks.length === 0 ? (
        <EmptyState
          title="No mission today"
          body="Nothing is unlocked and unfinished right now. Seed more roadmap content or check back after your next topic."
          action={
            <Link href="/roadmap" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Open roadmap
            </Link>
          }
        />
      ) : null}

      {/* Optional notes before ending */}
      {openSession ? (
        <Card>
          <label htmlFor="session-notes" className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">
            Session notes (optional)
          </label>
          <textarea
            id="session-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What clicked? What didn't? Worth revisiting?"
            className="mt-2 w-full resize-y rounded-xl border border-hairline bg-surface-2/40 px-3 py-2 text-sm text-ink-high placeholder:text-ink-low focus:border-accent focus:outline-none"
          />
        </Card>
      ) : null}

      <p className="font-mono text-[11px] text-ink-low">
        Mission planned at {plannedTotal} min · daily goal {goalMinutes} min
        {doneCount > 0 ? ` · ${doneCount} done` : ""}
        {skippedCount > 0 ? ` · ${skippedCount} skipped` : ""}
      </p>
    </div>
  );
}
