/** Pure streak math — no database, no React, fully unit-tested.
 *
 *  Qualification is honest: a day counts when the user completed at least
 *  one real task OR studied at least the minimum meaningful session.
 *  Opening the app, starting a timer for 5 seconds, or skipping tasks
 *  never qualifies.
 */

export type DayActivity = { day_key: string; seconds: number; tasks_done: number };

export type StreakConfig = {
  /** Minimum closed-session study time (seconds) for a day to qualify without a completed task. */
  minSessionSeconds: number;
};

/** 15 minutes of real study = meaningful activity. Configurable, single source. */
export const DEFAULT_STREAK_CONFIG: StreakConfig = { minSessionSeconds: 15 * 60 };

export const STREAK_MILESTONES = [1, 3, 7, 14, 30, 50, 100] as const;

export function isQualifiedDay(a: DayActivity, cfg: StreakConfig = DEFAULT_STREAK_CONFIG): boolean {
  return a.tasks_done >= 1 || a.seconds >= cfg.minSessionSeconds;
}

/** Smallest milestone strictly greater than `current` (null when beyond the last). */
export function nextMilestone(current: number): number | null {
  for (const m of STREAK_MILESTONES) {
    if (m > current) return m;
  }
  return null;
}

/** The milestone `current` lands exactly on (null otherwise). */
export function reachedMilestone(current: number): number | null {
  for (const m of STREAK_MILESTONES) {
    if (m === current) return m;
  }
  return null;
}

export type StreakResult = {
  /** Consecutive qualified days ending today (or yesterday, if today isn't done yet). */
  current: number;
  longest: number;
  totalActiveDays: number;
  lastActiveDayKey: string | null;
  todayQualified: boolean;
  /** True when a live run exists but today isn't qualified yet. */
  atRiskToday: boolean;
};

function isNextDay(prevKey: string, key: string): boolean {
  const [y, m, d] = prevKey.split("-").map((x) => Number.parseInt(x, 10));
  if (!y || !m || !d) return false;
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10) === key;
}

/**
 * Compute streak stats from per-day activity.
 * `activity` may contain duplicates/gaps/unordered rows — the engine normalizes.
 * Days not present in the data are simply unqualified days.
 */
export function computeStreak(
  activity: DayActivity[],
  todayKey: string,
  cfg: StreakConfig = DEFAULT_STREAK_CONFIG,
): StreakResult {
  const byDay = new Map<string, DayActivity>();
  for (const a of activity) {
    const existing = byDay.get(a.day_key);
    if (existing) {
      existing.seconds += a.seconds;
      existing.tasks_done += a.tasks_done;
    } else {
      byDay.set(a.day_key, { day_key: a.day_key, seconds: a.seconds, tasks_done: a.tasks_done });
    }
  }

  const qualified = new Set<string>();
  for (const a of byDay.values()) {
    if (isQualifiedDay(a, cfg)) qualified.add(a.day_key);
  }

  const sorted = [...byDay.keys()].sort();

  // Current run: walk backward from today; if today isn't qualified yet,
  // the run can still be alive from yesterday (at-risk).
  const todayQualified = qualified.has(todayKey);
  const anchor = todayQualified ? todayKey : shiftMinusOne(todayKey);
  let current = 0;
  if (anchor && qualified.has(anchor)) {
    current = 1;
    let cursor = anchor;
    for (;;) {
      const prev = shiftMinusOne(cursor);
      if (!prev || !qualified.has(prev)) break;
      current += 1;
      cursor = prev;
    }
  }

  // Longest run across all known days.
  let longest = 0;
  let run = 0;
  let prevKey: string | null = null;
  for (const key of sorted) {
    if (!qualified.has(key)) {
      run = 0;
      prevKey = key;
      continue;
    }
    run = prevKey && qualified.has(prevKey) && isNextDay(prevKey, key) ? run + 1 : 1;
    longest = Math.max(longest, run);
    prevKey = key;
  }

  const lastActiveDayKey = sorted.filter((k) => qualified.has(k)).at(-1) ?? null;

  return {
    current,
    longest: Math.max(longest, current),
    totalActiveDays: qualified.size,
    lastActiveDayKey,
    todayQualified,
    atRiskToday: !todayQualified && current > 0,
  };
}

function shiftMinusOne(dayKey: string): string | null {
  const [y, m, d] = dayKey.split("-").map((x) => Number.parseInt(x, 10));
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}
