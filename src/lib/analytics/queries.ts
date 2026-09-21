import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { dayKeyFor, dayKeyRange } from "@/lib/session/day";
import {
  buildActivity,
  computeVelocity,
  dailyBuckets,
  missedPatterns,
  quizStats,
  revisionStats,
  summarize,
  weakByConfidence,
  weeklyBuckets,
  type DayBucket,
  type MissedPatterns,
  type QuizStats,
  type RevisionStats,
  type Summary,
  type Velocity,
  type WeakConfidence,
  type WeekBucket,
} from "./engine";

export type AnalyticsData =
  | {
      ok: true;
      todayKey: string;
      goalMinutes: number;
      daily30: DayBucket[];
      weekly8: WeekBucket[];
      summary30: Summary;
      velocity: Velocity;
      quiz: QuizStats;
      weakestTopics: { slug: string; title: string; best_pct: number; attempts: number; passed: boolean }[];
      missed: MissedPatterns;
      recentMissed: { day_key: string; reason_category: string }[];
      revision: RevisionStats;
      weakConfidence: (WeakConfidence & { title: string })[];
      tasksCompleted30: number;
      projectsCompleted: number;
    }
  | { ok: false; missingSchema: true };

const WINDOW_DAYS = 30;

export const getAnalyticsData = cache(async (): Promise<AnalyticsData> => {
  const profile = await getProfile();
  if (!profile) return { ok: false, missingSchema: true };

  const supabase = await createClient();
  const todayKey = dayKeyFor(profile.timezone);
  const fromKey = dayKeyRange(todayKey, 90)[0] ?? todayKey;

  const [sessionsRes, attemptsRes, missedRes, reviewsRes, progressRes, tasksRes, projectsRes] =
    await Promise.all([
      supabase
        .from("study_sessions")
        .select("day_key, duration_seconds, tasks_done, tasks_skipped, status")
        .gte("day_key", fromKey),
      supabase
        .from("quiz_attempts")
        .select("topic_slug, score_pct, passed, completed_at")
        .gte("completed_at", `${fromKey}T00:00:00Z`),
      supabase.from("missed_days").select("day_key, reason_category").gte("day_key", fromKey),
      supabase.from("topic_reviews").select("topic_slug, status, due_day_key"),
      supabase
        .from("user_topic_progress")
        .select("topic_slug, confidence, status, completed_at")
        .eq("status", "completed"),
      supabase
        .from("daily_tasks")
        .select("planned_minutes, actual_minutes, status")
        .gte("day_key", fromKey),
      supabase.from("user_projects").select("status"),
    ]);

  // Any hard error means schema trouble; render the setup state honestly.
  if (
    sessionsRes.error ||
    attemptsRes.error ||
    missedRes.error ||
    reviewsRes.error ||
    progressRes.error ||
    tasksRes.error ||
    projectsRes.error
  ) {
    return { ok: false, missingSchema: true };
  }

  const sessions = (sessionsRes.data ?? []) as {
    day_key: string;
    duration_seconds: number | null;
    tasks_done: number;
    tasks_skipped: number;
    status: string;
  }[];

  const byDay = buildActivity(sessions);
  const daily30 = dailyBuckets(byDay, todayKey, WINDOW_DAYS);
  const weekly8 = weeklyBuckets(byDay, todayKey, 8);
  const summary30 = summarize(daily30);
  const goalMinutes = profile.daily_goal_minutes ?? 45;
  const velocity = computeVelocity(daily30, goalMinutes);

  const quiz = quizStats(
    (attemptsRes.data ?? []) as { topic_slug: string; score_pct: number; passed: boolean; completed_at: string }[],
  );

  // Resolve topic titles for the weak-topic lists (topics are public content).
  const slugs = [...new Set([...quiz.weakest.slice(0, 5).map((w) => w.topic_slug)])];
  const progressRows = (progressRes.data ?? []) as {
    topic_slug: string;
    confidence: number | null;
    status: string;
    completed_at: string | null;
  }[];
  for (const p of weakByConfidence(progressRows).slice(0, 5)) slugs.push(p.topic_slug);
  const titleMap = new Map<string, string>();
  if (slugs.length > 0) {
    const { data: topics } = await supabase.from("topics").select("slug, title").in("slug", slugs);
    for (const t of (topics ?? []) as { slug: string; title: string }[]) titleMap.set(t.slug, t.title);
  }

  const missed = missedPatterns(
    (missedRes.data ?? []) as { day_key: string; reason_category: string }[],
    (tasksRes.data ?? []) as { planned_minutes: number; actual_minutes: number | null; status: string }[],
  );

  const weakConfidence = weakByConfidence(progressRows)
    .slice(0, 5)
    .map((w) => ({ ...w, title: titleMap.get(w.topic_slug) ?? w.topic_slug }));

  const projectsCompleted = ((projectsRes.data ?? []) as { status: string }[]).filter(
    (p) => p.status === "completed" || p.status === "published",
  ).length;

  return {
    ok: true,
    todayKey,
    goalMinutes,
    daily30,
    weekly8,
    summary30,
    velocity,
    quiz,
    weakestTopics: quiz.weakest.slice(0, 5).map((w) => ({
      slug: w.topic_slug,
      title: titleMap.get(w.topic_slug) ?? w.topic_slug,
      best_pct: w.best_pct,
      attempts: w.attempts,
      passed: w.passed,
    })),
    missed,
    recentMissed: ((missedRes.data ?? []) as { day_key: string; reason_category: string }[])
      .sort((a, b) => (a.day_key < b.day_key ? 1 : -1))
      .slice(0, 6),
    revision: revisionStats(
      (reviewsRes.data ?? []) as { topic_slug: string; status: string; due_day_key: string }[],
      todayKey,
    ),
    weakConfidence,
    tasksCompleted30: ((tasksRes.data ?? []) as { status: string }[]).filter((t) => t.status === "completed")
      .length,
    projectsCompleted,
  };
});
