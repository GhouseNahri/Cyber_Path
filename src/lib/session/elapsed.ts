/** Pure session-time math — the single source of truth used by BOTH the
 *  client timer and the server actions, so displayed and logged time can
 *  never disagree.
 *
 *  Model (corrected after live testing):
 *  - closed sessions (completed/abandoned) return the stored duration
 *  - active: wall clock since started_at, minus banked paused_seconds
 *  - paused: frozen at last_resumed_at (the pause moment) minus banked
 *    pause; the paused stretch itself is banked at resume, avoiding the
 *    double-subtraction that froze the timer at 00:00.
 */

export type ElapsedSessionInput = {
  status: string;
  started_at: string;
  paused_seconds: number;
  last_resumed_at: string | null;
  duration_seconds: number | null;
};

const MAX_SECONDS = 12 * 3600;

export function elapsedSeconds(session: ElapsedSessionInput, nowMs: number): number {
  if (session.status === "completed" || session.status === "abandoned") {
    return Math.max(0, session.duration_seconds ?? 0);
  }
  const anchorMs =
    session.status === "paused" && session.last_resumed_at
      ? new Date(session.last_resumed_at).getTime()
      : nowMs;
  const windowSec = Math.max(0, Math.round((anchorMs - new Date(session.started_at).getTime()) / 1000));
  return Math.max(0, Math.min(windowSec - session.paused_seconds, MAX_SECONDS));
}
