"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/roadmap/actions";

/** Every route that renders user progress — revalidated after a reset so no
 *  server-rendered cache can show pre-reset state. */
const RESET_PATHS = [
  "/",
  "/roadmap",
  "/roadmap/[slug]",
  "/session",
  "/history",
  "/skills",
  "/library",
  "/analytics",
  "/quiz",
  "/projects",
  "/career",
  "/career/[slug]",
  "/settings",
];

export type ResetScope = {
  resetProjects: boolean;
  resetNotes: boolean;
  resetBookmarks: boolean;
  resetResources: boolean;
};

/** Result payload of a successful reset (per-table deleted counts, from the
 *  atomic SQL function). */
export type ResetSummary = {
  topic_progress: number;
  daily_tasks: number;
  study_sessions: number;
  missed_days: number;
  quiz_attempts: number;
  topic_reviews: number;
  projects: number;
  notes: number;
  bookmarks: number;
  resource_status: number;
};

/**
 * Reset the signed-in user's learning progress.
 *
 * Security: the user id comes ONLY from the server-side session — there is no
 * client-supplied identifier anywhere in this path, so one account can never
 * reset another's data. The deletion itself is one atomic SQL statement
 * (migration 0019), which either fully succeeds or fully rolls back.
 */
export async function resetProgress(scope: ResetScope): Promise<ActionResult & { summary?: ResetSummary }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Your session expired. Sign in again and retry." };

  const { data, error } = await supabase.rpc("reset_progress", {
    p_reset_projects: scope.resetProjects,
    p_reset_notes: scope.resetNotes,
    p_reset_bookmarks: scope.resetBookmarks,
    p_reset_resources: scope.resetResources,
  });

  if (error) {
    // Map known SQL error codes to safe, non-leaking messages.
    if (error.code === "42501") {
      return { ok: false, error: "You are not signed in, so nothing was reset." };
    }
    return { ok: false, error: "The reset could not be completed. Nothing was changed — try again." };
  }

  for (const p of RESET_PATHS) revalidatePath(p);

  return { ok: true, summary: data as ResetSummary };
}
