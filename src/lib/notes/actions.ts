"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import type { ActionResult } from "@/lib/roadmap/actions";

const MAX_BODY = 5000;

/** Save (upsert) the current user's note for a topic. Empty body deletes. */
export async function saveTopicNote(topicSlug: string, body: string): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  if (typeof topicSlug !== "string" || topicSlug.length === 0 || topicSlug.length > 120) {
    return { ok: false, error: "Invalid topic." };
  }

  const trimmed = typeof body === "string" ? body.trim().slice(0, MAX_BODY) : "";
  const supabase = await createClient();

  if (trimmed.length === 0) {
    const { error } = await supabase
      .from("topic_notes")
      .delete()
      .eq("topic_slug", topicSlug)
      .eq("user_id", profile.id);
    if (error) return { ok: false, error: "Could not clear the note. Try again." };
  } else {
    const { error } = await supabase.from("topic_notes").upsert({
      user_id: profile.id,
      topic_slug: topicSlug,
      body: trimmed,
    });
    if (error) return { ok: false, error: "Could not save the note. Try again." };
  }

  revalidatePath(`/roadmap/${topicSlug}`);
  return { ok: true };
}

/** Toggle the current user's bookmark for a topic. */
export async function toggleTopicBookmark(
  topicSlug: string,
  bookmarked: boolean,
): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  if (typeof topicSlug !== "string" || topicSlug.length === 0 || topicSlug.length > 120) {
    return { ok: false, error: "Invalid topic." };
  }

  const supabase = await createClient();

  if (bookmarked) {
    const { error } = await supabase.from("user_topic_bookmarks").upsert({
      user_id: profile.id,
      topic_slug: topicSlug,
    });
    if (error) return { ok: false, error: "Could not save the bookmark. Try again." };
  } else {
    const { error } = await supabase
      .from("user_topic_bookmarks")
      .delete()
      .eq("topic_slug", topicSlug)
      .eq("user_id", profile.id);
    if (error) return { ok: false, error: "Could not remove the bookmark. Try again." };
  }

  revalidatePath("/roadmap");
  revalidatePath(`/roadmap/${topicSlug}`);
  return { ok: true };
}
