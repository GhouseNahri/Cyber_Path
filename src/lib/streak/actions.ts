"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { dayKeyFor, dayKeyRange } from "@/lib/session/day";
import { computeStreak } from "./engine";
import { missedDayMessage, type MissedReasonCategory } from "./messages";
import type { ActionResult } from "@/lib/roadmap/actions";

const REASONS: ReadonlySet<string> = new Set([
  "no_time", "too_tired", "college_work", "didnt_understand", "task_too_difficult",
  "lost_motivation", "forgot", "technical_problem", "personal", "other",
]);

/** Record (or update) a missed-day self-report. Upsert keyed (user_id, day_key).
 *  Returns the accountability message so the UI can respond immediately —
 *  playful for light reasons, empathetic for serious ones. */
export async function recordMissedDay(input: {
  dayKey: string;
  reason: string;
  text?: string;
}): Promise<ActionResult & { message?: string }> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  if (!REASONS.has(input.reason)) {
    return { ok: false, error: "Pick a reason from the list." };
  }

  const supabase = await createClient();
  const todayKey = dayKeyFor(profile.timezone);
  // Accept yesterday or today only — the prompt never asks about older days.
  const allowed = new Set(dayKeyRange(todayKey, 2));
  if (!allowed.has(input.dayKey)) {
    return { ok: false, error: "That day can't be reported." };
  }

  const { error } = await supabase.from("missed_days").upsert({
    user_id: profile.id,
    day_key: input.dayKey,
    reason_category: input.reason,
    reason_text: input.text?.trim() ? input.text.trim().slice(0, 500) : null,
  });

  if (error) return { ok: false, error: "Could not save your note. Try again." };

  // Streak as it stood entering that day (the missed day itself is, by
  // definition, unqualified — at-risk anchor semantics give the prior run).
  const fromKey = dayKeyRange(input.dayKey, 60)[0];
  const [sessionsRes, tasksRes] = await Promise.all([
    supabase
      .from("study_sessions")
      .select("day_key, duration_seconds")
      .in("status", ["completed", "abandoned"])
      .gte("day_key", fromKey)
      .lte("day_key", input.dayKey),
    supabase
      .from("daily_tasks")
      .select("day_key")
      .eq("status", "completed")
      .gte("day_key", fromKey)
      .lte("day_key", input.dayKey),
  ]);

  const byDay = new Map<string, { day_key: string; seconds: number; tasks_done: number }>();
  for (const key of dayKeyRange(input.dayKey, 60)) {
    byDay.set(key, { day_key: key, seconds: 0, tasks_done: 0 });
  }
  for (const s of (sessionsRes.data ?? []) as { day_key: string; duration_seconds: number | null }[]) {
    const day = byDay.get(s.day_key);
    if (day) day.seconds += typeof s.duration_seconds === "number" ? s.duration_seconds : 0;
  }
  for (const t of (tasksRes.data ?? []) as { day_key: string }[]) {
    const day = byDay.get(t.day_key);
    if (day) day.tasks_done += 1;
  }

  const streakBefore = computeStreak([...byDay.values()], input.dayKey).current;
  const message = missedDayMessage(
    input.reason as MissedReasonCategory,
    input.dayKey,
    streakBefore,
  );

  revalidatePath("/", "layout");
  return { ok: true, message };
}
