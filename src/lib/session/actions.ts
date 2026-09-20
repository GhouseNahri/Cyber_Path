"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { dayKeyFor } from "./day";
import { elapsedSeconds } from "./elapsed";
import type { ActionResult } from "@/lib/roadmap/actions";

const SESSION_PATHS = ["/", "/session", "/history", "/roadmap", "/skills", "/library"];

const MAX_SESSION_SECONDS = 12 * 3600;

type Db = Awaited<ReturnType<typeof createClient>>;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, userId: null as string | null };
  return { supabase, userId: user.id };
}

function revalidateAll() {
  for (const p of SESSION_PATHS) revalidatePath(p);
}

/** Force-close an open (active/paused) session with honest active time.
 *  When paused, last_resumed_at holds the pause moment — use it as the
 *  time anchor instead of now. */
async function forceClose(
  db: Db,
  userId: string,
  row: { id: string; status: string; started_at: string; paused_seconds: number; last_resumed_at: string | null },
  status: "completed" | "abandoned",
  notes?: string | null,
) {
  const duration = elapsedSeconds(
    { status: row.status, started_at: row.started_at, paused_seconds: row.paused_seconds, last_resumed_at: row.last_resumed_at, duration_seconds: null },
    Date.now(),
  );
  await db
    .from("study_sessions")
    .update({
      status,
      ended_at: new Date().toISOString(),
      duration_seconds: duration,
      notes: notes?.trim() ? notes.trim().slice(0, 2000) : null,
    })
    .eq("id", row.id)
    .eq("user_id", userId);
}

/** Start a study session for the user's current local day. Any open session
 *  (active/paused) is first force-closed as abandoned — one live session
 *  per user, enforced. */
export async function startSession(): Promise<ActionResult & { sessionId?: string }> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Profile missing — complete onboarding first." };

  const { data: open } = await supabase
    .from("study_sessions")
    .select("id, status, started_at, paused_seconds, last_resumed_at")
    .eq("user_id", userId)
    .in("status", ["active", "paused"]);

  for (const row of (open ?? []) as { id: string; status: string; started_at: string; paused_seconds: number; last_resumed_at: string | null }[]) {
    await forceClose(supabase, userId, row, "abandoned");
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("study_sessions")
    .insert({
      user_id: userId,
      day_key: dayKeyFor(profile.timezone),
      status: "active",
      last_resumed_at: nowIso,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "Could not start the session. Try again in a moment." };

  revalidateAll();
  return { ok: true, sessionId: String((data as { id: string }).id) };
}

/** ACTIVE → PAUSED: bank the active stretch into paused_seconds. */
export async function pauseSession(sessionId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const { data: row } = await supabase
    .from("study_sessions")
    .select("id, status, started_at, paused_seconds, last_resumed_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  const session = row as { id: string; status: string; started_at: string; paused_seconds: number; last_resumed_at: string | null } | null;

  if (!session) return { ok: false, error: "Session not found." };
  if (session.status === "paused") return { ok: true }; // idempotent
  if (session.status !== "active") return { ok: false, error: "Session is not running." };

  // Park the pause MOMENT only — the paused stretch gets banked at resume.
  // (Banking here would double-subtract and freeze the timer at 00:00.)
  const { error } = await supabase
    .from("study_sessions")
    .update({
      status: "paused",
      last_resumed_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "Could not pause the session." };

  revalidateAll();
  return { ok: true };
}

/** PAUSED → ACTIVE: set the resume marker. */
export async function resumeSession(sessionId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const { data: row } = await supabase
    .from("study_sessions")
    .select("id, status, last_resumed_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  const session = row as { id: string; status: string; last_resumed_at: string | null } | null;

  if (!session) return { ok: false, error: "Session not found." };
  if (session.status === "active") return { ok: true }; // idempotent
  if (session.status !== "paused") return { ok: false, error: "Only a paused session can resume." };

  // Bank the paused stretch: now − pause moment (last_resumed_at), clamped.
  const pausedFor = session.last_resumed_at
    ? Math.max(0, Math.min(Math.round((Date.now() - new Date(session.last_resumed_at).getTime()) / 1000), MAX_SESSION_SECONDS))
    : 0;
  const { data: cur } = await supabase
    .from("study_sessions")
    .select("paused_seconds")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  const banked = (cur as { paused_seconds: number } | null)?.paused_seconds ?? 0;

  const { error } = await supabase
    .from("study_sessions")
    .update({
      status: "active",
      paused_seconds: banked + pausedFor,
      last_resumed_at: null,
    })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "Could not resume the session." };

  revalidateAll();
  return { ok: true };
}

/**
 * End the session (completed or abandoned). Duration = wall clock since
 * start, minus banked pause time — all from DB timestamps, so a client
 * can't inflate it. Task tallies come from the day's task rows.
 */
export async function endSession(input: {
  sessionId: string;
  status?: "completed" | "abandoned";
  notes?: string;
}): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const { data: row } = await supabase
    .from("study_sessions")
    .select("id, status, started_at, paused_seconds, last_resumed_at, duration_seconds, day_key, notes")
    .eq("id", input.sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  const session = row as
    | { id: string; status: string; started_at: string; paused_seconds: number; last_resumed_at: string | null; duration_seconds: number | null; day_key: string; notes: string | null }
    | null;

  if (!session) return { ok: false, error: "Session not found." };
  if (session.status === "completed" || session.status === "abandoned") return { ok: true }; // idempotent

  // Shared math with the client timer — display and persisted time agree.
  const duration = elapsedSeconds(session, Date.now());

  // Task tallies for the session's day, computed server-side.
  let tasksDone = 0;
  let tasksSkipped = 0;
  if (session.day_key) {
    const { data: tasks } = await supabase
      .from("daily_tasks")
      .select("status")
      .eq("user_id", userId)
      .eq("day_key", session.day_key);
    for (const t of (tasks ?? []) as { status: string }[]) {
      if (t.status === "completed") tasksDone += 1;
      else if (t.status === "skipped") tasksSkipped += 1;
    }
  }

  const { error } = await supabase
    .from("study_sessions")
    .update({
      status: input.status ?? "completed",
      ended_at: new Date().toISOString(),
      duration_seconds: duration,
      tasks_done: tasksDone,
      tasks_skipped: tasksSkipped,
      notes: input.notes?.trim()
        ? input.notes.trim().slice(0, 2000)
        : session.notes,
    })
    .eq("id", input.sessionId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: "Could not save the session." };

  revalidateAll();
  return { ok: true };
}
