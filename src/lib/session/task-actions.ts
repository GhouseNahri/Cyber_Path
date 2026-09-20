"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TASK_KIND_META } from "./types";
import type { ActionResult } from "@/lib/roadmap/actions";
import type { SkipReason } from "./types";

const TASK_PATHS = ["/", "/session", "/history", "/roadmap", "/skills", "/library"];

type Db = Awaited<ReturnType<typeof createClient>>;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, userId: null as string | null };
  return { supabase, userId: user.id };
}

async function loadTask(db: Db, userId: string, taskId: string) {
  const { data } = await db
    .from("daily_tasks")
    .select("id, status, kind, topic_slug, planned_minutes, started_at")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data ?? null) as
    | { id: string; status: string; kind: string; topic_slug: string; planned_minutes: number; started_at: string | null }
    | null;
}

/** Mark the matching roadmap stage done for this topic's progress row. */
async function syncStage(db: Db, userId: string, topicSlug: string, stage: string) {
  const { data: existing } = await db
    .from("user_topic_progress")
    .select("status, stages")
    .eq("user_id", userId)
    .eq("topic_slug", topicSlug)
    .maybeSingle();

  const prev = (existing?.stages ?? {}) as Record<string, unknown>;
  const stages = {
    read: stage === "read" ? true : prev.read === true,
    practice: stage === "practice" ? true : prev.practice === true,
    test: stage === "test" ? true : prev.test === true,
    build: stage === "build" ? true : prev.build === true,
  };
  const allDone = Object.values(stages).every(Boolean);
  const status = allDone ? "completed" : "in_progress";

  return db.from("user_topic_progress").upsert(
    {
      user_id: userId,
      topic_slug: topicSlug,
      status,
      stages,
      last_practiced_at: stage === "practice" || stage === "build" ? new Date().toISOString() : undefined,
      completed_at: allDone ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,topic_slug" },
  );
}

function revalidateTasks() {
  for (const p of TASK_PATHS) revalidatePath(p);
}

/** not_started → in_progress (idempotent; settled tasks are a no-op). */
export async function startTask(taskId: string): Promise<ActionResult> {
  if (!taskId) return { ok: false, error: "Missing task." };

  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const task = await loadTask(supabase, userId, taskId);
  if (!task) return { ok: false, error: "Task not found." };
  if (task.status !== "not_started" && task.status !== "in_progress") return { ok: true };

  const { error } = await supabase
    .from("daily_tasks")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "Could not start the task." };

  revalidateTasks();
  return { ok: true };
}

/** in_progress → completed, with difficulty (1–5), optional note, and
 *  roadmap stage sync. Idempotent on double-complete. */
export async function completeTask(
  taskId: string,
  input: { difficulty?: number | null; note?: string | null } = {},
): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const task = await loadTask(supabase, userId, taskId);
  if (!task) return { ok: false, error: "Task not found." };
  if (task.status === "completed") return { ok: true };
  if (task.status === "skipped" || task.status === "cancelled") {
    return { ok: false, error: "Task was already settled." };
  }

  const difficulty = input.difficulty == null ? null : Math.round(input.difficulty);
  if (difficulty !== null && (difficulty < 1 || difficulty > 5)) {
    return { ok: false, error: "Difficulty must be 1–5." };
  }

  const planned = typeof task.planned_minutes === "number" ? task.planned_minutes : 15;
  const startedMs = task.started_at ? new Date(task.started_at).getTime() : null;
  const actualMinutes = startedMs ? Math.max(1, Math.round((Date.now() - startedMs) / 60000)) : planned;

  const { error } = await supabase
    .from("daily_tasks")
    .update({
      status: "completed",
      difficulty: difficulty ?? null,
      task_notes: input.note?.trim() ? input.note.trim().slice(0, 2000) : null,
      actual_minutes: Math.min(actualMinutes, 240),
      completed_at: new Date().toISOString(),
      skip_reason_category: null,
      skip_reason_text: null,
      skipped_at: null,
    })
    .eq("id", taskId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "Could not complete the task." };

  // Roadmap integration: a completed task marks its stage on the topic.
  const stage = TASK_KIND_META[task.kind as keyof typeof TASK_KIND_META]?.stage ?? null;
  if (stage) {
    const { error: syncErr } = await syncStage(supabase, userId, task.topic_slug, stage);
    if (syncErr) {
      return { ok: false, error: "Task saved but roadmap sync failed — toggle the stage from the topic page." };
    }
  }

  revalidateTasks();
  return { ok: true };
}

const SKIP_CATEGORIES: SkipReason[] = [
  "too_difficult",
  "prerequisite_gap",
  "not_enough_time",
  "not_relevant_today",
  "technical_problem",
  "already_know",
  "other",
];

/** → skipped, with a reason category (+ optional free text) for Phase 7. */
export async function skipTask(
  taskId: string,
  reason: SkipReason,
  reasonText?: string | null,
): Promise<ActionResult> {
  if (!SKIP_CATEGORIES.includes(reason)) return { ok: false, error: "Pick a reason." };

  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const task = await loadTask(supabase, userId, taskId);
  if (!task) return { ok: false, error: "Task not found." };
  if (task.status === "skipped") return { ok: true };
  if (task.status === "completed") return { ok: false, error: "Task is already completed." };

  const { error } = await supabase
    .from("daily_tasks")
    .update({
      status: "skipped",
      skip_reason_category: reason,
      skip_reason_text: reasonText?.trim() ? reasonText.trim().slice(0, 500) : null,
      skipped_at: new Date().toISOString(),
      difficulty: null,
      task_notes: null,
      completed_at: null,
    })
    .eq("id", taskId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "Could not skip the task." };

  revalidateTasks();
  return { ok: true };
}
