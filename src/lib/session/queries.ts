import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getRoadmapOverview } from "@/lib/roadmap/queries";
import { dayKeyFor, dayKeyRange } from "./day";
import { generateMission } from "./generator";
import { getRevisionQueue } from "@/lib/revision/queries";
import type {
  ActivityDay,
  DailyTask,
  Mission,
  SessionHistoryRow,
  SessionStatus,
  StudySession,
  TaskDifficulty,
  TaskKind,
  TaskStatus,
} from "./types";

const KINDS: TaskKind[] = ["learn", "practice", "test", "build", "review"];
const STATUSES: TaskStatus[] = ["not_started", "in_progress", "completed", "skipped", "cancelled"];
const SESSION_STATUSES: SessionStatus[] = ["active", "paused", "completed", "abandoned"];

function pick<T extends string>(raw: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

function normalizeTask(raw: Record<string, unknown>): DailyTask {
  return {
    id: String(raw.id ?? ""),
    day_key: String(raw.day_key ?? ""),
    topic_slug: String(raw.topic_slug ?? ""),
    kind: pick(raw.kind, KINDS, "learn"),
    title: String(raw.title ?? ""),
    why: String(raw.why ?? ""),
    planned_minutes: typeof raw.planned_minutes === "number" ? raw.planned_minutes : 15,
    status: pick(raw.status, STATUSES, "not_started"),
    position: typeof raw.position === "number" ? raw.position : 0,
    actual_minutes: typeof raw.actual_minutes === "number" ? raw.actual_minutes : null,
    difficulty:
      typeof raw.difficulty === "number" && raw.difficulty >= 1 && raw.difficulty <= 5
        ? (raw.difficulty as TaskDifficulty)
        : null,
    task_notes: typeof raw.task_notes === "string" ? raw.task_notes : null,
    skip_reason_category: pick(
      raw.skip_reason_category,
      ["too_difficult", "prerequisite_gap", "not_enough_time", "not_relevant_today", "technical_problem", "already_know", "other"] as const,
      "other",
    ),
    skip_reason_text: typeof raw.skip_reason_text === "string" ? raw.skip_reason_text : null,
    started_at: typeof raw.started_at === "string" ? raw.started_at : null,
    completed_at: typeof raw.completed_at === "string" ? raw.completed_at : null,
    skipped_at: typeof raw.skipped_at === "string" ? raw.skipped_at : null,
    resource_id: typeof raw.resource_id === "string" ? raw.resource_id : null,
    resource_url: typeof raw.resource_url === "string" ? raw.resource_url : null,
    resource_title: typeof raw.resource_title === "string" ? raw.resource_title : null,
  };
}

function normalizeSession(raw: Record<string, unknown>): StudySession {
  return {
    id: String(raw.id ?? ""),
    day_key: String(raw.day_key ?? ""),
    status: pick(raw.status, SESSION_STATUSES, "active"),
    started_at: String(raw.started_at ?? ""),
    ended_at: typeof raw.ended_at === "string" ? raw.ended_at : null,
    duration_seconds: typeof raw.duration_seconds === "number" ? raw.duration_seconds : null,
    paused_seconds: typeof raw.paused_seconds === "number" ? raw.paused_seconds : 0,
    last_resumed_at: typeof raw.last_resumed_at === "string" ? raw.last_resumed_at : null,
    tasks_done: typeof raw.tasks_done === "number" ? raw.tasks_done : 0,
    tasks_skipped: typeof raw.tasks_skipped === "number" ? raw.tasks_skipped : 0,
    notes: typeof raw.notes === "string" ? raw.notes : null,
  };
}

function toMission(dayKey: string, tasks: DailyTask[]): Mission {
  const unfinished = tasks.filter((t) => t.status === "not_started" || t.status === "in_progress");
  return {
    dayKey,
    tasks,
    remainingMinutes: unfinished.reduce((n, t) => n + t.planned_minutes, 0),
    anyCompleted: tasks.some((t) => t.status === "completed"),
    settled: tasks.length > 0 && unfinished.length === 0,
    current: tasks.find((t) => t.status === "in_progress") ?? null,
  };
}

export type MissionState =
  | { ok: true; mission: Mission; session: StudySession | null }
  | { ok: false; missingSchema: true };

/** Fetch tasks joined with their linked resource (title + URL). */
async function fetchTasks(supabase: Awaited<ReturnType<typeof createClient>>, dayKey: string) {
  return supabase
    .from("daily_tasks")
    .select("*, resources ( id, title, url )")
    .eq("day_key", dayKey)
    .order("position");
}

function tasksWithResources(
  rows: (Record<string, unknown> & { resources: { id: string; title: string; url: string } | { id: string; title: string; url: string }[] | null })[],
): DailyTask[] {
  return rows.map((r) => {
    const res = Array.isArray(r.resources) ? r.resources[0] : r.resources;
    return normalizeTask({ ...r, resource_id: res?.id ?? r.resource_id, resource_title: res?.title ?? null, resource_url: res?.url ?? null });
  });
}

/**
 * Today's mission, generated on first access from the real roadmap state
 * and persisted. `missingSchema` means migrations 0003/0006 aren't applied.
 */
export const getMissionState = cache(async (): Promise<MissionState> => {
  const profile = await getProfile();
  if (!profile) return { ok: false, missingSchema: true };

  const supabase = await createClient();
  const dayKey = dayKeyFor(profile.timezone);

  const [tasksRes, sessionRes] = await Promise.all([
    fetchTasks(supabase, dayKey),
    supabase
      .from("study_sessions")
      .select("*")
      .eq("day_key", dayKey)
      .order("started_at", { ascending: false })
      .limit(1),
  ]);

  if (tasksRes.error || sessionRes.error) return { ok: false, missingSchema: true };

  const tasks = tasksWithResources((tasksRes.data ?? []) as never);
  const session = (sessionRes.data ?? [])[0]
    ? normalizeSession((sessionRes.data ?? [])[0] as Record<string, unknown>)
    : null;

  if (tasks.length > 0) {
    return { ok: true, mission: toMission(dayKey, tasks), session };
  }

  // First access today → generate the mission from the live roadmap.
  const overview = await getRoadmapOverview();
  if (!overview.ok) return { ok: false, missingSchema: true };

  const allTopics = overview.phases.flatMap((p) => p.topics);

  // Yesterday's signatures, for no-repeat variety.
  const yesterdayKey = dayKeyRange(dayKey, 2)[0];
  const { data: yRows } = await supabase
    .from("daily_tasks")
    .select("topic_slug, kind")
    .eq("day_key", yesterdayKey);

  // Top-priority resource per topic for learn-task links.
  const { data: resRows } = await supabase
    .from("resources")
    .select("topic_slug, id, type, priority")
    .order("priority");

  // Due spaced revisions (Phase 9) — the generator's top-priority candidates.
  const queue = await getRevisionQueue();

  const generated = generateMission({
    goalMinutes: profile.daily_goal_minutes ?? 45,
    timezone: profile.timezone,
    topics: allTopics,
    resources: ((resRows ?? []) as { topic_slug: string; id: string; type: string; priority: number }[]).map((r) => ({
      topic_slug: r.topic_slug,
      id: r.id,
      type: r.type,
      priority: r.priority,
    })),
    yesterdayTaskSignatures: ((yRows ?? []) as { topic_slug: string; kind: string }[]).map((r) => `${r.topic_slug}:${r.kind}`),
    dueRevisionSlugs: queue.ok ? queue.dueSlugs : undefined,
  });

  if (generated.length === 0) {
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
        resource_id: g.resource_id,
        status: "not_started" as const,
      })),
    )
    .select("*, resources ( id, title, url )");

  if (error) {
    // Unique (user_id, day_key, position) guard: a parallel request won the
    // race. Re-read whatever was persisted instead of duplicating tasks.
    const retry = await fetchTasks(supabase, dayKey);
    if (retry.error || (retry.data ?? []).length === 0) return { ok: false, missingSchema: true };
    return { ok: true, mission: toMission(dayKey, tasksWithResources((retry.data ?? []) as never)), session };
  }

  return { ok: true, mission: toMission(dayKey, tasksWithResources((data ?? []) as never)), session };
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

export type SessionHistory =
  | { ok: true; sessions: SessionHistoryRow[]; calendar: ActivityDay[] }
  | { ok: false; missingSchema: true };

/** Past sessions + per-day aggregates for the history page. */
export const getHistory = cache(async (weeks = 8): Promise<SessionHistory> => {
  const profile = await getProfile();
  if (!profile) return { ok: false, missingSchema: true };

  const supabase = await createClient();
  const today = dayKeyFor(profile.timezone);
  const fromKey = dayKeyRange(today, weeks * 7)[0];

  const [sessionsRes, tasksRes] = await Promise.all([
    supabase
      .from("study_sessions")
      .select("id, day_key, status, started_at, ended_at, duration_seconds, tasks_done, tasks_skipped, notes")
      .gte("day_key", fromKey)
      .order("started_at", { ascending: false }),
    supabase
      .from("daily_tasks")
      .select("day_key, status, topic_slug")
      .gte("day_key", fromKey),
  ]);

  if (sessionsRes.error || tasksRes.error) return { ok: false, missingSchema: true };

  // Topics per day (for the history rows) from daily tasks.
  const topicsByDay = new Map<string, string[]>();
  for (const t of (tasksRes.data ?? []) as { day_key: string; topic_slug: string; status: string }[]) {
    const list = topicsByDay.get(t.day_key) ?? [];
    if (!list.includes(t.topic_slug)) list.push(t.topic_slug);
    topicsByDay.set(t.day_key, list);
  }

  const sessions: SessionHistoryRow[] = ((sessionsRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id ?? ""),
    day_key: String(r.day_key ?? ""),
    status: pick(r.status, SESSION_STATUSES, "completed"),
    started_at: String(r.started_at ?? ""),
    ended_at: typeof r.ended_at === "string" ? r.ended_at : null,
    duration_seconds: typeof r.duration_seconds === "number" ? r.duration_seconds : null,
    tasks_done: typeof r.tasks_done === "number" ? r.tasks_done : 0,
    tasks_skipped: typeof r.tasks_skipped === "number" ? r.tasks_skipped : 0,
    notes: typeof r.notes === "string" ? r.notes : null,
    topics: topicsByDay.get(String(r.day_key ?? "")) ?? [],
  }));

  // Calendar: seconds + completed tasks per day.
  const byDay = new Map<string, ActivityDay>();
  for (const key of dayKeyRange(today, weeks * 7)) {
    byDay.set(key, { day_key: key, seconds: 0, tasks_done: 0, sessions: 0 });
  }
  for (const s of sessions) {
    const day = byDay.get(s.day_key);
    if (!day) continue;
    day.seconds += s.duration_seconds ?? 0;
    day.tasks_done += s.tasks_done;
    day.sessions += 1;
  }
  for (const t of (tasksRes.data ?? []) as { day_key: string; status: string }[]) {
    if (t.status !== "completed") continue;
    const day = byDay.get(t.day_key);
    if (day) day.tasks_done += 0; // session tallies already counted; keep per-task source for Phase 7
  }

  return { ok: true, sessions, calendar: [...byDay.values()] };
});
