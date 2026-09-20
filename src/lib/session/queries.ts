import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getRoadmapOverview } from "@/lib/roadmap/queries";
import { dayKeyFor } from "./day";
import { generateMission } from "./generator";
import type { DailyTask, Mission, StudySession } from "./types";

function normalizeTask(raw: Record<string, unknown>): DailyTask {
  const kind = raw.kind === "practice" || raw.kind === "test" || raw.kind === "build" ? raw.kind : "learn";
  const status = raw.status === "done" || raw.status === "skipped" ? raw.status : "pending";
  return {
    id: String(raw.id ?? ""),
    day_key: String(raw.day_key ?? ""),
    topic_slug: String(raw.topic_slug ?? ""),
    kind,
    title: String(raw.title ?? ""),
    why: String(raw.why ?? ""),
    planned_minutes: typeof raw.planned_minutes === "number" ? raw.planned_minutes : 15,
    status,
    position: typeof raw.position === "number" ? raw.position : 0,
  };
}

function normalizeSession(raw: Record<string, unknown>): StudySession {
  return {
    id: String(raw.id ?? ""),
    day_key: String(raw.day_key ?? ""),
    started_at: String(raw.started_at ?? ""),
    ended_at: typeof raw.ended_at === "string" ? raw.ended_at : null,
    duration_seconds: typeof raw.duration_seconds === "number" ? raw.duration_seconds : null,
    tasks_done: typeof raw.tasks_done === "number" ? raw.tasks_done : 0,
    tasks_skipped: typeof raw.tasks_skipped === "number" ? raw.tasks_skipped : 0,
    notes: typeof raw.notes === "string" ? raw.notes : null,
  };
}

function toMission(dayKey: string, tasks: DailyTask[]): Mission {
  const pending = tasks.filter((t) => t.status === "pending");
  return {
    dayKey,
    tasks,
    remainingMinutes: pending.reduce((n, t) => n + t.planned_minutes, 0),
    anyDone: tasks.some((t) => t.status === "done"),
    settled: tasks.length > 0 && pending.length === 0,
  };
}

export type MissionState =
  | { ok: true; mission: Mission; session: StudySession | null }
  | { ok: false; missingSchema: true };

/**
 * Today's mission, generated on first access from the real roadmap state
 * and persisted (so refreshing, or a second device, sees the same tasks).
 * `missingSchema` means migrations 0003/0006 aren't applied yet.
 */
export const getMissionState = cache(async (): Promise<MissionState> => {
  const profile = await getProfile();
  if (!profile) return { ok: false, missingSchema: true };

  const supabase = await createClient();
  const dayKey = dayKeyFor(profile.timezone);

  const [tasksRes, sessionRes] = await Promise.all([
    supabase.from("daily_tasks").select("*").eq("day_key", dayKey).order("position"),
    supabase
      .from("study_sessions")
      .select("*")
      .eq("day_key", dayKey)
      .order("started_at", { ascending: false })
      .limit(1),
  ]);

  if (tasksRes.error || sessionRes.error) return { ok: false, missingSchema: true };

  const tasks = ((tasksRes.data ?? []) as Record<string, unknown>[]).map(normalizeTask);
  const session = (sessionRes.data ?? [])[0]
    ? normalizeSession((sessionRes.data ?? [])[0] as Record<string, unknown>)
    : null;

  if (tasks.length > 0) {
    return { ok: true, mission: toMission(dayKey, tasks), session };
  }

  // First access today → generate the mission from the live roadmap.
  const overview = await getRoadmapOverview();
  if (!overview.ok) return { ok: false, missingSchema: true };

  const generated = generateMission({
    goalMinutes: profile.daily_goal_minutes ?? 45,
    timezone: profile.timezone,
    topics: overview.phases.flatMap((p) => p.topics),
  });

  if (generated.length === 0) {
    // Nothing unlocked/unfinished — an honest "all clear" day.
    return { ok: true, mission: toMission(dayKey, []), session };
  }

  const { data, error } = await supabase
    .from("daily_tasks")
    .insert(
      generated.map((g) => ({
        user_id: profile.id,
        day_key: dayKey,
        topic_slug: g.topic_slug,
        kind: g.kind,
        title: g.title,
        why: g.why,
        planned_minutes: g.planned_minutes,
        position: g.position,
        status: "pending" as const,
      })),
    )
    .select("*");

  if (error) {
    // Unique (user_id, day_key, position) guard: a parallel request won the
    // race. Re-read whatever was persisted instead of duplicating tasks.
    const retry = await supabase.from("daily_tasks").select("*").eq("day_key", dayKey).order("position");
    if (retry.error || (retry.data ?? []).length === 0) return { ok: false, missingSchema: true };
    const rows = ((retry.data ?? []) as Record<string, unknown>[]).map(normalizeTask);
    return { ok: true, mission: toMission(dayKey, rows), session };
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).map(normalizeTask);
  return { ok: true, mission: toMission(dayKey, rows), session };
});

/** Lifetime study totals for the dashboard stat strip. */
export const getStudyTotals = cache(async (): Promise<{ seconds: number; sessions: number } | null> => {
  const profile = await getProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("study_sessions")
    .select("duration_seconds")
    .eq("user_id", profile.id);
  if (error) return null;
  const rows = (data ?? []) as { duration_seconds: number | null }[];
  return {
    seconds: rows.reduce((n, r) => n + (typeof r.duration_seconds === "number" ? r.duration_seconds : 0), 0),
    sessions: rows.length,
  };
});
