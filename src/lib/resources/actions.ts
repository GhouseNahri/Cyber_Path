"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/roadmap/actions";
import type { ResourceStatus } from "./types";

const LIBRARY_PATHS = ["/library", "/roadmap", "/"];

function revalidateLibrary(topicSlug?: string | null) {
  for (const p of LIBRARY_PATHS) revalidatePath(p);
  if (topicSlug) revalidatePath(`/roadmap/${topicSlug}`);
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, userId: null as string | null };
  return { supabase, userId: user.id };
}

/** Resource's owning topic, so status changes revalidate its detail page. */
async function topicSlugFor(supabase: Awaited<ReturnType<typeof createClient>>, resourceId: string): Promise<string | null> {
  const { data } = await supabase.from("resources").select("topic_slug").eq("id", resourceId).maybeSingle();
  return (data as { topic_slug: string } | null)?.topic_slug ?? null;
}

/** Set this resource's status for the signed-in user (done / saved / skip). */
export async function setResourceStatus(resourceId: string, status: ResourceStatus): Promise<ActionResult> {
  if (!resourceId) return { ok: false, error: "Missing resource." };
  if (status !== "done" && status !== "saved" && status !== "skip") {
    return { ok: false, error: "Unknown status." };
  }

  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const { error } = await supabase.from("user_resource_status").upsert(
    { user_id: userId, resource_id: resourceId, status, updated_at: new Date().toISOString() },
    { onConflict: "user_id,resource_id" },
  );
  if (error) return { ok: false, error: "Could not save that. Try again in a moment." };

  revalidateLibrary(await topicSlugFor(supabase, resourceId));
  return { ok: true };
}

/** Remove the user's status entirely (the "clear" button). */
export async function clearResourceStatus(resourceId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const { error } = await supabase
    .from("user_resource_status")
    .delete()
    .eq("resource_id", resourceId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "Could not clear that. Try again in a moment." };

  revalidateLibrary(await topicSlugFor(supabase, resourceId));
  return { ok: true };
}
