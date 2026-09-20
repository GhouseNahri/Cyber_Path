"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { dayKeyFor } from "./day";
import type { ActionResult } from "@/lib/roadmap/actions";

const SESSION_PATHS = ["/", "/session", "/roadmap", "/skills"];

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, userId: null as string | null };
  return { supabase, userId: user.id };
}

/** Mark a daily task done or skipped (owner-only; RLS enforces too). */
export async function setTaskStatus(
  taskId: string,
  status: "done" | "skipped" | "pending",
): Promise<ActionResult> {
  if (!taskId) return { ok: false, error: "Missing task." };

  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const { error } = await supabase
    .from("daily_tasks")
    .update({ status })
    .eq("id", taskId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "Could not update the task. Try again in a moment." };

  for (const p of SESSION_PATHS) revalidatePath(p);
  return { ok: true };
}

/** Start a study session for the user's current local day. */
export async function startSession(): Promise<ActionResult & { sessionId?: string }> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Profile missing — complete onboarding first." };

  // If an earlier session today is still open, end it first (client crash,
  // closed tab). Honest closure: duration = wall clock since it started.
  const { data: open } = await supabase
    .from("study_sessions")
    .select("id, started_at")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false });

  for (const row of (open ?? []) as { id: string; started_at: string }[]) {
    const started = new Date(row.started_at).getTime();
    const clamped = Math.max(0, Math.min(Math.round((Date.now() - started) / 1000), 12 * 3600));
    await supabase
      .from("study_sessions")
      .update({ ended_at: new Date().toISOString(), duration_seconds: clamped })
      .eq("id", row.id)
      .eq("user_id", userId);
  }

  const { data, error } = await supabase
    .from("study_sessions")
    .insert({ user_id: userId, day_key: dayKeyFor(profile.timezone) })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "Could not start the session. Try again in a moment." };

  for (const p of SESSION_PATHS) revalidatePath(p);
  return { ok: true, sessionId: String((data as { id: string }).id) };
}

/**
 * End the running session: persist duration, tallies and optional notes.
 * The client's elapsed seconds are clamped to the real wall-clock window
 * between started_at and now, so the logged time can never exceed reality.
 */
export async function endSession(input: {
  sessionId: string;
  elapsedSeconds: number;
  notes?: string;
}): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const { data: existing } = await supabase
    .from("study_sessions")
    .select("started_at, ended_at")
    .eq("id", input.sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Session not found." };
  if (existing.ended_at) return { ok: true }; // already closed — idempotent

  const startedMs = new Date(existing.started_at).getTime();
  const windowSeconds = Math.max(0, Math.round((Date.now() - startedMs) / 1000));
  const requested = Number.isFinite(input.elapsedSeconds) ? Math.max(0, Math.round(input.elapsedSeconds)) : 0;
  const duration = Math.min(requested, windowSeconds, 12 * 3600);

  // Task tallies for this day (done/skipped), computed server-side.
  const profile = await getProfile();
  const dayKey = profile ? dayKeyFor(profile.timezone) : null;
  let tasksDone = 0;
  let tasksSkipped = 0;
  if (dayKey) {
    const { data: tasks } = await supabase
      .from("daily_tasks")
      .select("status")
      .eq("user_id", userId)
      .eq("day_key", dayKey);
    for (const t of (tasks ?? []) as { status: string }[]) {
      if (t.status === "done") tasksDone += 1;
      else if (t.status === "skipped") tasksSkipped += 1;
    }
  }

  const { error } = await supabase
    .from("study_sessions")
    .update({
      ended_at: new Date().toISOString(),
      duration_seconds: duration,
      tasks_done: tasksDone,
      tasks_skipped: tasksSkipped,
      notes: input.notes?.trim() ? input.notes.trim().slice(0, 2000) : null,
    })
    .eq("id", input.sessionId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: "Could not save the session. Try again in a moment." };

  for (const p of SESSION_PATHS) revalidatePath(p);
  return { ok: true };
}
