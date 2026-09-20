import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { dayKeyFor, dayKeyRange } from "@/lib/session/day";
import { computeStreak, STREAK_MILESTONES, DEFAULT_STREAK_CONFIG } from "./engine";
import type { DayActivity } from "./engine";

/** Per-day activity across the look-back window: seconds from closed
 *  sessions + completed-task counts from daily tasks. */
export type StreakData = {
  ok: boolean;
  missingSchema: boolean;
  streak: {
    current: number;
    longest: number;
    totalActiveDays: number;
    lastActiveDayKey: string | null;
    todayQualified: boolean;
    atRiskToday: boolean;
  };
  todayKey: string;
  activity: DayActivity[];
  /** Days the user marked missed, mapped by day_key. */
  missedByDay: Map<string, { reason_category: string; reason_text: string | null }>;
  /** Recent missed days, newest first, for the pattern card. */
  recentMissed: { day_key: string; reason_category: string; reason_text: string | null }[];
};

export const getStreakData = cache(async (lookbackDays = 120): Promise<StreakData> => {
  const empty = (missingSchema: boolean): StreakData => ({
    ok: false,
    missingSchema,
    streak: {
      current: 0,
      longest: 0,
      totalActiveDays: 0,
      lastActiveDayKey: null,
      todayQualified: false,
      atRiskToday: false,
    },
    todayKey: "",
    activity: [],
    missedByDay: new Map(),
    recentMissed: [],
  });

  const profile = await getProfile();
  if (!profile) return empty(true);

  const supabase = await createClient();
  const todayKey = dayKeyFor(profile.timezone);
  const fromKey = dayKeyRange(todayKey, lookbackDays)[0];

  const [sessionsRes, tasksRes, missedRes] = await Promise.all([
    supabase
      .from("study_sessions")
      .select("day_key, duration_seconds, tasks_done")
      .in("status", ["completed", "abandoned"])
      .gte("day_key", fromKey),
    supabase
      .from("daily_tasks")
      .select("day_key, status")
      .eq("status", "completed")
      .gte("day_key", fromKey),
    supabase
      .from("missed_days")
      .select("day_key, reason_category, reason_text")
      .gte("day_key", fromKey)
      .order("day_key", { ascending: false }),
  ]);

  if (sessionsRes.error || tasksRes.error || missedRes.error) return empty(true);

  // Aggregate per day.
  const byDay = new Map<string, DayActivity>();
  for (const key of dayKeyRange(todayKey, lookbackDays)) {
    byDay.set(key, { day_key: key, seconds: 0, tasks_done: 0 });
  }
  for (const s of (sessionsRes.data ?? []) as { day_key: string; duration_seconds: number | null; tasks_done: number | null }[]) {
    const day = byDay.get(s.day_key);
    if (!day) continue;
    day.seconds += typeof s.duration_seconds === "number" ? s.duration_seconds : 0;
  }
  for (const t of (tasksRes.data ?? []) as { day_key: string }[]) {
    const day = byDay.get(t.day_key);
    if (day) day.tasks_done += 1;
  }

  const activity = [...byDay.values()];
  const streak = computeStreak(activity, todayKey, DEFAULT_STREAK_CONFIG);

  const missedRows = (missedRes.data ?? []) as { day_key: string; reason_category: string; reason_text: string | null }[];
  const missedByDay = new Map(missedRows.map((r) => [r.day_key, { reason_category: r.reason_category, reason_text: r.reason_text }]));

  return {
    ok: true,
    missingSchema: false,
    streak,
    todayKey,
    activity,
    missedByDay,
    recentMissed: missedRows,
  };
});

export { STREAK_MILESTONES };
