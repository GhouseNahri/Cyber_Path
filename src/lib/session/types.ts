/** Domain types for the daily learning system.
 *  Keep in sync with supabase/migrations/0006 + 0008. */

export type TaskKind = "learn" | "practice" | "test" | "build" | "review";

export const TASK_KIND_META: Record<TaskKind, { label: string; stage: "read" | "practice" | "test" | "build" | null }> = {
  learn: { label: "Learn", stage: "read" },
  practice: { label: "Practice", stage: "practice" },
  test: { label: "Test", stage: "test" },
  build: { label: "Build", stage: "build" },
  review: { label: "Review", stage: null },
};

export type TaskStatus = "not_started" | "in_progress" | "completed" | "skipped" | "cancelled";

export type TaskDifficulty = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTY_LABELS: Record<TaskDifficulty, string> = {
  1: "Very easy",
  2: "Easy",
  3: "Moderate",
  4: "Difficult",
  5: "Very difficult",
};

/** Deterministic skip-reason categories (Phase 7 consumes these). */
export const SKIP_REASONS = [
  "too_difficult",
  "prerequisite_gap",
  "not_enough_time",
  "not_relevant_today",
  "technical_problem",
  "already_know",
  "other",
] as const;

export type SkipReason = (typeof SKIP_REASONS)[number];

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  too_difficult: "Too difficult",
  prerequisite_gap: "Don't understand the prerequisite",
  not_enough_time: "Not enough time",
  not_relevant_today: "Not relevant today",
  technical_problem: "Technical problem",
  already_know: "Already know this",
  other: "Other",
};

export type DailyTask = {
  id: string;
  day_key: string;
  topic_slug: string;
  kind: TaskKind;
  title: string;
  why: string;
  planned_minutes: number;
  status: TaskStatus;
  position: number;
  actual_minutes: number | null;
  difficulty: TaskDifficulty | null;
  task_notes: string | null;
  skip_reason_category: SkipReason | null;
  skip_reason_text: string | null;
  started_at: string | null;
  completed_at: string | null;
  skipped_at: string | null;
  resource_id: string | null;
  resource_url: string | null;
  resource_title: string | null;
};

export type SessionStatus = "active" | "paused" | "completed" | "abandoned";

export type StudySession = {
  id: string;
  day_key: string;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  paused_seconds: number;
  last_resumed_at: string | null;
  tasks_done: number;
  tasks_skipped: number;
  notes: string | null;
};

export type Mission = {
  dayKey: string;
  tasks: DailyTask[];
  /** Planned minutes of unfinished (not completed/skipped) tasks. */
  remainingMinutes: number;
  anyCompleted: boolean;
  /** True when every task is completed or skipped. */
  settled: boolean;
  /** The task currently in progress, if any. */
  current: DailyTask | null;
};

/** A past session row for the history page. */
export type SessionHistoryRow = {
  id: string;
  day_key: string;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  tasks_done: number;
  tasks_skipped: number;
  notes: string | null;
  topics: string[];
};

/** One day's aggregate for the calendar heatmap. */
export type ActivityDay = {
  day_key: string;
  seconds: number;
  tasks_done: number;
  sessions: number;
};
