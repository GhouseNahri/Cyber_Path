import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";

/** The current user's note for one topic (or null). */
export const getTopicNote = cache(async (topicSlug: string): Promise<string | null> => {
  const profile = await getProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("topic_notes")
    .select("body")
    .eq("topic_slug", topicSlug)
    .eq("user_id", profile.id)
    .maybeSingle();
  const row = data as { body: string } | null;
  return row?.body ?? null;
});

/** The current user's bookmarked topic slugs. */
export const getBookmarkedSlugs = cache(async (): Promise<Set<string>> => {
  const profile = await getProfile();
  if (!profile) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_topic_bookmarks")
    .select("topic_slug")
    .eq("user_id", profile.id);
  return new Set(((data ?? []) as { topic_slug: string }[]).map((r) => r.topic_slug));
});
