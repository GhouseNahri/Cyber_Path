/** Domain types for the daily mission / study-session system.
 *  Keep in sync with supabase/migrations/0006_daily_sessions.sql. */

export type TaskKind = "learn" | "practice" | "test" | "build";

export const TASK_KIND_META: Record<TaskKind, { label: string }> = {
  learn: { label: "Learn" },
  "practice": { label: "Practice" },
  test: { label: "Test" },
  build: { label: "Build" },
};

export type DailyTask = {
  id: string;
  day_key: string;
  topic_slug: string;
  kind: TaskKind;
  title: string;
  why: string;
  planned_minutes: number;
  status: "pending" | "done" | "skipped";
  position: number;
};

export type Mission = {
  dayKey: string;
  tasks: DailyTask[];
  /** Task minutes remaining (pending only). */
  remainingMinutes: number;
  /** True when at least one task is done. */
  anyDone: boolean;
  /** True when every task is done or skipped. */
  settled: boolean;
};

export type StudySession = {
  id: string;
  day_key: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  tasks_done: number;
  tasks_skipped: number;
  notes: string | null;
};
