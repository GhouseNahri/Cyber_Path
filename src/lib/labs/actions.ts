"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  canTransitionLab,
  parseLabStatus,
  parseLabType,
  statusTimestampPatch,
} from "./engine";

export type LabActionResult = { ok: true } | { ok: false; error: string };

const REVALIDATE = ["/", "/labs", "/skills"];

function revalidateLabs() {
  for (const p of REVALIDATE) revalidatePath(p);
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Start a catalog lab: creates the tracker row and moves it to in_progress
 * in one action. Idempotent-ish: starting an already-tracked lab just moves
 * status forward legally (revisit → in_progress counts as a revisit).
 */
export async function startLab(slug: string): Promise<LabActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Your session expired - sign in again." };
  if (typeof slug !== "string" || slug.length === 0 || slug.length > 160) {
    return { ok: false, error: "Unknown lab." };
  }

  const supabase = await createClient();
  const { data: lab } = await supabase.from("labs").select("slug").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (!lab) return { ok: false, error: "That lab does not exist." };

  const { data: existing } = await supabase
    .from("user_labs")
    .select("id, status, times_revisited")
    .eq("user_id", user.id)
    .eq("lab_slug", slug)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    const from = parseLabStatus(existing.status);
    const to = from === "revisit" ? "in_progress" : from === "not_started" ? "in_progress" : from === "abandoned" ? "in_progress" : from;
    if (to === from && from !== "in_progress") return { ok: false, error: "This lab is already in your tracker." };

    const patch: Record<string, unknown> = {
      status: to,
      updated_at: now,
      ...statusTimestampPatch(to, now),
    };
    if (from === "revisit") patch.times_revisited = (existing.times_revisited ?? 0) + 1;

    const { error } = await supabase.from("user_labs").update(patch).eq("id", existing.id).eq("user_id", user.id);
    if (error) return { ok: false, error: "Could not start the lab. Try again in a moment." };
  } else {
    const { error } = await supabase.from("user_labs").insert({
      user_id: user.id,
      lab_slug: slug,
      status: "in_progress",
      attempts_count: 1,
      started_at: now,
      updated_at: now,
    });
    if (error) {
      if (error.code === "23505") return { ok: false, error: "This lab is already in your tracker." };
      return { ok: false, error: "Could not start the lab. Try again in a moment." };
    }
  }

  revalidateLabs();
  return { ok: true };
}

/** Move a lab through its legal status transitions. */
export async function setLabStatus(userLabId: string, status: string): Promise<LabActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Your session expired - sign in again." };
  const to = parseLabStatus(status);

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("user_labs")
    .select("id, status, times_revisited")
    .eq("id", userLabId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Lab not found." };

  const from = parseLabStatus(row.status);
  if (!canTransitionLab(from, to)) return { ok: false, error: `Cannot move a ${from.replace("_", " ")} lab to ${to.replace("_", " ")}.` };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: to,
    updated_at: now,
    ...statusTimestampPatch(to, now),
  };
  if (from === "completed" && to === "in_progress") patch.times_revisited = (row.times_revisited ?? 0) + 1;

  const { error } = await supabase.from("user_labs").update(patch).eq("id", userLabId).eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not update the lab. Try again in a moment." };

  revalidateLabs();
  return { ok: true };
}

/** Toggle one catalog-lab task checkbox (index-validated against lab_tasks). */
export async function toggleLabTask(userLabId: string, index: number, total: number): Promise<LabActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Your session expired - sign in again." };
  if (!Number.isInteger(index) || index < 0 || index >= total || total > 20) {
    return { ok: false, error: "Unknown task." };
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("user_labs")
    .select("tasks_done")
    .eq("id", userLabId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Lab not found." };

  const current = Array.isArray(row.tasks_done) ? row.tasks_done.filter((n): n is number => typeof n === "number") : [];
  const next = current.includes(index) ? current.filter((i) => i !== index) : [...current, index];

  const { error } = await supabase
    .from("user_labs")
    .update({ tasks_done: next, updated_at: new Date().toISOString() })
    .eq("id", userLabId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not update tasks. Try again in a moment." };

  revalidateLabs();
  return { ok: true };
}

/** Reveal a hint tier (bounded by the lab's actual hint count). */
export async function revealHint(userLabId: string, nextCount: number): Promise<LabActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Your session expired - sign in again." };
  if (!Number.isInteger(nextCount) || nextCount < 1 || nextCount > 10) {
    return { ok: false, error: "Unknown hint." };
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("user_labs")
    .select("hints_revealed")
    .eq("id", userLabId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Lab not found." };
  if (nextCount <= row.hints_revealed) return { ok: true };

  const { error } = await supabase
    .from("user_labs")
    .update({ hints_revealed: nextCount, updated_at: new Date().toISOString() })
    .eq("id", userLabId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not reveal the hint. Try again in a moment." };

  revalidateLabs();
  return { ok: true };
}

/** Save private working notes (never leaves the owner's rows). */
export async function saveLabNotes(userLabId: string, notes: string): Promise<LabActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Your session expired - sign in again." };
  if (typeof notes !== "string" || notes.length > 20000) {
    return { ok: false, error: "Notes are too long (20,000 characters max)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_labs")
    .update({ notes: notes.trim(), updated_at: new Date().toISOString() })
    .eq("id", userLabId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not save notes. Try again in a moment." };

  revalidateLabs();
  return { ok: true };
}

/** Add minutes of practical work to a lab row. */
export async function logLabTime(userLabId: string, minutes: number): Promise<LabActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Your session expired - sign in again." };
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
    return { ok: false, error: "Log between 1 and 600 minutes." };
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("user_labs")
    .select("minutes_spent")
    .eq("id", userLabId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Lab not found." };

  const { error } = await supabase
    .from("user_labs")
    .update({ minutes_spent: row.minutes_spent + minutes, updated_at: new Date().toISOString() })
    .eq("id", userLabId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not log time. Try again in a moment." };

  revalidateLabs();
  return { ok: true };
}

/** Add a user-defined lab (external provider, CTF or home lab) to the tracker. */
export async function addCustomLab(input: {
  title: string;
  labType: string;
  provider?: string;
  externalUrl?: string;
  categorySlug?: string;
}): Promise<LabActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Your session expired - sign in again." };

  const title = (input.title ?? "").trim();
  if (title.length < 2 || title.length > 160) {
    return { ok: false, error: "Give the lab a name (2-160 characters)." };
  }
  const type = parseLabType(input.labType);
  if (type === "simulation" || type === "sandbox") {
    return { ok: false, error: "Built-in and sandboxed labs cannot be added manually." };
  }
  const url = (input.externalUrl ?? "").trim();
  if (url && !url.startsWith("https://")) {
    return { ok: false, error: "Links must be https:// URLs." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("user_labs").insert({
    user_id: user.id,
    title,
    lab_type: type,
    provider: (input.provider ?? "").trim().slice(0, 120),
    external_url: url || null,
    category_slug: input.categorySlug || null,
    status: "not_started",
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "You already track a custom lab with this name." };
    return { ok: false, error: "Could not add the lab. Try again in a moment." };
  }

  revalidateLabs();
  return { ok: true };
}

/** Remove a custom lab from the tracker entirely. */
export async function deleteCustomLab(userLabId: string): Promise<LabActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Your session expired - sign in again." };

  const supabase = await createClient();
  // RLS + explicit owner scoping: only the owner's custom rows can match.
  const { error } = await supabase.from("user_labs").delete().eq("id", userLabId).eq("user_id", user.id).eq("lab_slug", null);
  if (error) return { ok: false, error: "Could not remove the lab." };

  revalidateLabs();
  return { ok: true };
}
