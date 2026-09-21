"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  canTransition,
  isValidProjectUrl,
  parseStatus,
  STATUS_RANK,
  validIndexes,
} from "./engine";

export type ProjectActionResult = { ok: true } | { ok: false; error: string };

const REVALIDATE = ["/", "/projects", "/skills", "/settings"];

function revalidateProjects() {
  for (const p of REVALIDATE) revalidatePath(p);
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Start a project from a catalog idea (milestones inherited) or a custom title. */
export async function startProject(input: { ideaSlug?: string; title?: string }): Promise<ProjectActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Your session expired - sign in again." };

  const supabase = await createClient();
  let ideaSlug: string | null = null;
  let title: string;

  if (input.ideaSlug) {
    if (typeof input.ideaSlug !== "string" || input.ideaSlug.length > 120) {
      return { ok: false, error: "Unknown project idea." };
    }
    const { data: idea } = await supabase
      .from("project_ideas")
      .select("slug, title")
      .eq("slug", input.ideaSlug)
      .maybeSingle();
    if (!idea) return { ok: false, error: "That project idea does not exist." };
    ideaSlug = idea.slug as string;
    title = idea.title as string;
  } else {
    title = (input.title ?? "").trim();
    if (title.length < 2 || title.length > 120) {
      return { ok: false, error: "Give the project a name (2-120 characters)." };
    }
  }

  const { error } = await supabase.from("user_projects").insert({
    user_id: user.id,
    idea_slug: ideaSlug,
    title,
    status: "idea",
    milestones_done: [],
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "This project is already in your tracker." };
    return { ok: false, error: "Could not start the project. Try again in a moment." };
  }

  revalidateProjects();
  return { ok: true };
}

/** Advance (or reopen) a project's status through the legal transitions. */
export async function setProjectStatus(projectId: string, status: string): Promise<ProjectActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Your session expired - sign in again." };
  const to = parseStatus(status);

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("user_projects")
    .select("status, started_at, completed_at, published_at")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Project not found." };

  const from = parseStatus(row.status);
  if (!canTransition(from, to)) return { ok: false, error: `Cannot move from ${from} to ${to}.` };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: to, updated_at: now };
  if (!row.started_at && STATUS_RANK[to] >= STATUS_RANK.planned) patch.started_at = row.started_at ?? now;
  if (to === "completed") patch.completed_at = now;
  if (to === "published") patch.published_at = now;
  // Reopening clears the timestamps of the stages left behind.
  if (STATUS_RANK[to] < STATUS_RANK.completed) patch.completed_at = null;
  if (STATUS_RANK[to] < STATUS_RANK.published) patch.published_at = null;

  const { error } = await supabase.from("user_projects").update(patch).eq("id", projectId).eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not update the project. Try again in a moment." };

  revalidateProjects();
  return { ok: true };
}

/** Toggle one milestone (0-based index) on a tracker row. */
export async function toggleMilestone(projectId: string, index: number, total: number): Promise<ProjectActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Your session expired - sign in again." };
  if (!Number.isInteger(index) || index < 0 || index >= total) {
    return { ok: false, error: "Unknown milestone." };
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("user_projects")
    .select("milestones_done")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Project not found." };

  const current = validIndexes(row.milestones_done, total);
  const next = current.includes(index) ? current.filter((i) => i !== index) : [...current, index];

  const { error } = await supabase
    .from("user_projects")
    .update({ milestones_done: next, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not update milestones. Try again in a moment." };

  revalidateProjects();
  return { ok: true };
}

/** Update github/demo URLs and notes. URLs must be https or empty. */
export async function updateProjectLinks(
  projectId: string,
  input: { github_url?: string; demo_url?: string; notes?: string },
): Promise<ProjectActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Your session expired - sign in again." };

  const github = (input.github_url ?? "").trim();
  const demo = (input.demo_url ?? "").trim();
  if (!isValidProjectUrl(github) || !isValidProjectUrl(demo)) {
    return { ok: false, error: "Links must be https:// URLs." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_projects")
    .update({
      github_url: github || null,
      demo_url: demo || null,
      notes: input.notes && input.notes.trim() ? input.notes.trim().slice(0, 5000) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not save. Try again in a moment." };

  revalidateProjects();
  return { ok: true };
}

/** Remove a project from the tracker entirely. */
export async function deleteProject(projectId: string): Promise<ProjectActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Your session expired - sign in again." };

  const supabase = await createClient();
  const { error } = await supabase.from("user_projects").delete().eq("id", projectId).eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not delete the project." };

  revalidateProjects();
  return { ok: true };
}
