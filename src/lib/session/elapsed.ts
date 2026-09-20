/** Pure session-time math — the single source of truth used by BOTH the
 *  client timer (rendering) and the server actions (persisting), so the
 *  displayed time and the logged time can never disagree.
 *
 *  Rules:
 *  - closed sessions (completed/abandoned) return the stored duration
 *  - active sessions: wall clock since start, minus banked pause
 *  - paused sessions: frozen at last_resumed_at (the pause moment)
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
