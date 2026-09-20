/** Pure spaced-repetition engine — no DB, no clock. Everything takes plain
 *  day keys ("YYYY-MM-DD", the user's timezone) so it is fully testable.
 *
 *  The ladder: completing a topic schedules review #1 at +intervals[0] days.
 *  Completing review n schedules review n+1 at +intervals[n] days. After the
 *  last interval the topic has graduated — no further reviews are created.
 *  Default ladder: 1, 3, 7, 14, 30 days (per-user configurable).
 */

import { shiftDayKey } from "@/lib/session/day";

export const DEFAULT_INTERVALS: readonly number[] = [1, 3, 7, 14, 30];

export type ReviewStatus = "scheduled" | "completed";

/** Shape of a public.topic_reviews row the engine reasons about. */
export type ReviewRow = {
  topic_slug: string;
  review_number: number;
  interval_days: number;
  due_day_key: string;
  status: ReviewStatus;
  completed_at: string | null;
};

/** Interval (days) used for review #n (1-based), or null when n is past the ladder. */
export function intervalForReview(intervals: readonly number[], reviewNumber: number): number | null {
  const idx = reviewNumber - 1;
  if (idx < 0 || idx >= intervals.length) return null;
  const v = intervals[idx];
  return typeof v === "number" && v >= 1 ? v : null;
}

export type NextReview = { review_number: number; interval_days: number; due_day_key: string };

/** The review that follows completing review `completedNumber` on `completedOnDayKey`.
 *  Null ⇒ the topic has graduated. */
export function nextReviewAfter(
  intervals: readonly number[],
  completedNumber: number,
  completedOnDayKey: string,
): NextReview | null {
  const nextNumber = completedNumber + 1;
  const interval = intervalForReview(intervals, nextNumber);
  if (interval === null) return null;
  return { review_number: nextNumber, interval_days: interval, due_day_key: shiftDayKey(completedOnDayKey, interval) };
}

/** The first review for a topic completed on `completedOnDayKey`. Null ⇒ no intervals configured. */
export function firstReview(intervals: readonly number[], completedOnDayKey: string): NextReview | null {
  const interval = intervalForReview(intervals, 1);
  if (interval === null) return null;
  return { review_number: 1, interval_days: interval, due_day_key: shiftDayKey(completedOnDayKey, interval) };
}

/** A scheduled review is due when its due day is today or earlier. */
export function isDue(row: Pick<ReviewRow, "status" | "due_day_key">, todayKey: string): boolean {
  return row.status === "scheduled" && row.due_day_key <= todayKey;
}

/** Whole days overdue (0 = due today). Only meaningful for scheduled rows. */
export function overdueDays(dueDayKey: string, todayKey: string): number {
  if (dueDayKey >= todayKey) return 0;
  // Both keys are ISO dates → lexicographic diff via UTC-noon arithmetic.
  const toUTC = (k: string) => {
    const [y, m, d] = k.split("-").map((x) => Number.parseInt(x, 10));
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12);
  };
  return Math.round((toUTC(todayKey) - toUTC(dueDayKey)) / 86_400_000);
}

export type ReviewBuckets = {
  /** Scheduled and due today or overdue — sorted oldest-due first. */
  due: ReviewRow[];
  /** Scheduled for the future — sorted soonest first. */
  upcoming: ReviewRow[];
  /** Topics fully through the ladder (all reviews completed, nothing scheduled). */
  graduatedSlugs: string[];
};

/** Split review rows into the buckets the UI needs.
 *  `completedTopicSlugs` filters graduation to topics still marked completed
 *  (a reset topic's leftover history must not count as graduated). */
export function bucketReviews(
  rows: ReviewRow[],
  todayKey: string,
  completedTopicSlugs?: ReadonlySet<string>,
): ReviewBuckets {
  const scheduled: ReviewRow[] = [];
  const completedByTopic = new Map<string, number>();
  for (const r of rows) {
    if (r.status === "scheduled") scheduled.push(r);
    else completedByTopic.set(r.topic_slug, Math.max(completedByTopic.get(r.topic_slug) ?? 0, r.review_number));
  }

  const due = scheduled.filter((r) => r.due_day_key <= todayKey).sort(byDueThenNumber);
  const upcoming = scheduled.filter((r) => r.due_day_key > todayKey).sort(byDueThenNumber);

  const scheduledSlugs = new Set(scheduled.map((r) => r.topic_slug));
  const graduatedSlugs = [...completedByTopic.keys()].filter((slug) => {
    if (scheduledSlugs.has(slug)) return false;
    return completedTopicSlugs ? completedTopicSlugs.has(slug) : true;
  });

  return { due, upcoming, graduatedSlugs };
}

function byDueThenNumber(a: ReviewRow, b: ReviewRow): number {
  return a.due_day_key !== b.due_day_key
    ? a.due_day_key.localeCompare(b.due_day_key)
    : a.review_number - b.review_number;
}

/** Sanitize user-supplied intervals: positive ints, 1–365, sorted ascending,
 *  deduplicated, max 6 entries. Falls back to the default when nothing
 *  usable remains. Changing intervals affects future scheduling only. */
export function validateIntervals(raw: unknown): number[] {
  const arr = Array.isArray(raw) ? raw : [];
  const cleaned = [
    ...new Set(
      arr
        .map((x) => (typeof x === "number" ? Math.round(x) : Number.parseInt(String(x), 10)))
        .filter((x) => Number.isFinite(x) && x >= 1 && x <= 365),
    ),
  ].sort((a, b) => a - b);

  const out = cleaned.slice(0, 6);
  return out.length > 0 ? out : [...DEFAULT_INTERVALS];
}
