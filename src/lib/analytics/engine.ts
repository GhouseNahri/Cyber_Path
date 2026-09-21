/**
 * Pure analytics math — no database, no React. Every function takes plain
 * rows (already filtered to the user by RLS) and a today key in the user's
 * timezone, and returns aggregates. Only metrics that change what you do
 * next; no vanity counters.
 */

import { dayKeyRange, shiftDayKey } from "@/lib/session/day";

export type RawSession = {
  day_key: string;
  duration_seconds: number | null;
  tasks_done: number;
  tasks_skipped: number;
  status: string;
};

export type RawAttempt = {
  topic_slug: string;
  score_pct: number;
  passed: boolean;
  completed_at: string;
};

export type RawMissed = { day_key: string; reason_category: string };

export type RawReview = {
  topic_slug: string;
  status: string;
  due_day_key: string;
};

// ── Activity aggregation ─────────────────────────────────────────────────

/** Sum closed-session seconds per local day. Null/negative durations are
 *  ignored, not treated as zero-length lies. */
export function buildActivity(sessions: RawSession[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    if (s.status !== "completed") continue;
    const sec = s.duration_seconds;
    if (sec == null || !Number.isFinite(sec) || sec <= 0) continue;
    byDay.set(s.day_key, (byDay.get(s.day_key) ?? 0) + sec);
  }
  return byDay;
}

// ── Buckets ──────────────────────────────────────────────────────────────

export type DayBucket = { key: string; seconds: number };
export type WeekBucket = { startKey: string; seconds: number; days: number };

/** Last n days (oldest first), including zero days — honest gaps. */
export function dailyBuckets(
  byDay: Map<string, number>,
  endKey: string,
  n: number,
): DayBucket[] {
  return dayKeyRange(endKey, n).map((key) => ({ key, seconds: byDay.get(key) ?? 0 }));
}

/** Monday-based week start for a day key (UTC-noon math, DST-safe). */
export function weekStartOf(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map((x) => Number.parseInt(x, 10));
  if (!y || !m || !d) return dayKey;
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); // 0 = Sunday
  return shiftDayKey(dayKey, -((dow + 6) % 7));
}

/** Last n weeks (oldest first). Days counted per week so partial current
 *  weeks are visible rather than misleadingly low. */
export function weeklyBuckets(
  byDay: Map<string, number>,
  endKey: string,
  n: number,
): WeekBucket[] {
  const thisWeek = weekStartOf(endKey);
  const weeks: WeekBucket[] = Array.from({ length: n }, (_, i) => ({
    startKey: shiftDayKey(thisWeek, -7 * (n - 1 - i)),
    seconds: 0,
    days: 0,
  }));
  const index = new Map(weeks.map((w, i) => [w.startKey, i]));
  for (const [key, seconds] of byDay) {
    const i = index.get(weekStartOf(key));
    if (i == null) continue;
    const week = weeks[i];
    if (!week) continue;
    week.seconds += seconds;
    week.days += 1;
  }
  return weeks;
}

// ── Summary + velocity ───────────────────────────────────────────────────

export type Summary = {
  totalMinutes: number;
  activeDays: number;
  avgMinutesPerActiveDay: number;
  bestDay: { key: string; minutes: number } | null;
};

export function summarize(buckets: DayBucket[]): Summary {
  const total = buckets.reduce((acc, b) => acc + b.seconds, 0);
  const active = buckets.filter((b) => b.seconds > 0);
  const best = active.reduce<{ key: string; minutes: number } | null>((top, b) => {
    const minutes = Math.round(b.seconds / 60);
    return !top || minutes > top.minutes ? { key: b.key, minutes } : top;
  }, null);
  return {
    totalMinutes: Math.round(total / 60),
    activeDays: active.length,
    avgMinutesPerActiveDay: active.length ? Math.round(total / 60 / active.length) : 0,
    bestDay: best,
  };
}

export type Velocity = {
  /** Average study minutes per calendar day over the window. */
  avgMinutesPerDay: number;
  /** Daily target from the profile, for comparison. */
  goalMinutes: number;
  /** avgMinutesPerDay as a share of goal, 0-100+ (clamped display-side). */
  pctOfGoal: number;
  /** Qualified study days per week (1 decimal). */
  activeDaysPerWeek: number;
};

export function computeVelocity(
  buckets: DayBucket[],
  goalMinutes: number,
): Velocity {
  const days = buckets.length || 1;
  const total = buckets.reduce((acc, b) => acc + b.seconds, 0);
  const avgMinutes = total / 60 / days;
  const activeDays = buckets.filter((b) => b.seconds > 0).length;
  return {
    avgMinutesPerDay: Math.round(avgMinutes * 10) / 10,
    goalMinutes,
    pctOfGoal: goalMinutes > 0 ? Math.round((avgMinutes / goalMinutes) * 100) : 0,
    activeDaysPerWeek: Math.round((activeDays / days * 7) * 10) / 10,
  };
}

// ── Quiz performance ─────────────────────────────────────────────────────

export type QuizTopicStat = {
  topic_slug: string;
  attempts: number;
  best_pct: number;
  last_pct: number;
  passed: boolean;
  last_attempt_at: string;
};

export type QuizStats = {
  totalAttempts: number;
  passRate: number;
  avgBestScore: number;
  /** Weakest first: lowest best score, most attempts as tiebreak. */
  weakest: QuizTopicStat[];
};

export function quizStats(attempts: RawAttempt[]): QuizStats {
  const byTopic = new Map<string, QuizTopicStat>();
  for (const a of attempts) {
    const prev = byTopic.get(a.topic_slug);
    if (!prev) {
      byTopic.set(a.topic_slug, {
        topic_slug: a.topic_slug,
        attempts: 1,
        best_pct: a.score_pct,
        last_pct: a.score_pct,
        passed: a.passed,
        last_attempt_at: a.completed_at,
      });
      continue;
    }
    prev.attempts += 1;
    prev.best_pct = Math.max(prev.best_pct, a.score_pct);
    if (a.completed_at >= prev.last_attempt_at) {
      prev.last_pct = a.score_pct;
      prev.last_attempt_at = a.completed_at;
      prev.passed = a.passed;
    } else {
      prev.passed = prev.passed || a.passed;
    }
  }
  const stats = [...byTopic.values()];
  const passed = stats.filter((s) => s.passed).length;
  return {
    totalAttempts: attempts.length,
    passRate: stats.length ? Math.round((passed / stats.length) * 100) : 0,
    avgBestScore: stats.length
      ? Math.round(stats.reduce((acc, s) => acc + s.best_pct, 0) / stats.length)
      : 0,
    weakest: stats.sort((a, b) => a.best_pct - b.best_pct || b.attempts - a.attempts),
  };
}

// ── Missed-day patterns ──────────────────────────────────────────────────

export type MissedPatterns = {
  total: number;
  byCategory: { category: string; count: number }[];
  topReason: { category: string; count: number } | null;
  avgPlannedMinutes: number | null;
  avgActualMinutes: number | null;
  /** Honest recommendation when planned consistently exceeds actual. */
  suggestLowerTarget: boolean;
};

export function missedPatterns(
  missed: RawMissed[],
  tasks: { planned_minutes: number; actual_minutes: number | null; status: string }[],
): MissedPatterns {
  const counts = new Map<string, number>();
  for (const m of missed) counts.set(m.reason_category, (counts.get(m.reason_category) ?? 0) + 1);
  const byCategory = [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const planned = tasks.map((t) => t.planned_minutes);
  const actual = tasks
    .filter((t) => t.status === "completed" && t.actual_minutes != null && t.actual_minutes > 0)
    .map((t) => t.actual_minutes as number);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

  const avgPlanned = avg(planned);
  const avgActual = avg(actual);
  return {
    total: missed.length,
    byCategory,
    topReason: byCategory[0] ?? null,
    avgPlannedMinutes: avgPlanned,
    avgActualMinutes: avgActual,
    suggestLowerTarget:
      avgPlanned != null && avgActual != null && avgActual < avgPlanned * 0.6 && missed.length >= 3,
  };
}

// ── Revision stats ───────────────────────────────────────────────────────

export type RevisionStats = {
  due: number;
  completed: number;
  upcoming7: number;
};

export function revisionStats(reviews: RawReview[], todayKey: string): RevisionStats {
  const upcomingEnd = shiftDayKey(todayKey, 7);
  let due = 0;
  let completed = 0;
  let upcoming = 0;
  for (const r of reviews) {
    if (r.status === "completed") {
      completed += 1;
      continue;
    }
    if (r.due_day_key <= todayKey) due += 1;
    else if (r.due_day_key <= upcomingEnd) upcoming += 1;
  }
  return { due, completed, upcoming7: upcoming };
}

// ── Weak topics by self-reported confidence ─────────────────────────────

export type WeakConfidence = { topic_slug: string; confidence: number; completed_at: string | null };

/** Completed topics the user still rates low (1–2). Sorted weakest first. */
export function weakByConfidence(
  progress: { topic_slug: string; confidence: number | null; status: string; completed_at: string | null }[],
): WeakConfidence[] {
  return progress
    .filter((p) => p.status === "completed" && p.confidence != null && p.confidence <= 2)
    .map((p) => ({ topic_slug: p.topic_slug, confidence: p.confidence as number, completed_at: p.completed_at }))
    .sort((a, b) => a.confidence - b.confidence);
}
