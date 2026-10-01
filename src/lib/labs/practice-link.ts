/**
 * Roadmap ⇄ labs link (L4): when a lab with ticks_practice_stage completes,
 * its mapped topics' Practice stage ticks through the same shared helper the
 * roadmap UI uses (applyStageToTopic) — never a direct bypass write.
 */
import type { createClient } from "@/lib/supabase/server";
import { applyStageToTopic } from "@/lib/roadmap/stage";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Best-effort: a failed tick never fails the lab completion itself. */
export async function tickPracticeForLab(
  supabase: ServerClient,
  userId: string,
  labSlug: string,
): Promise<boolean> {
  try {
    const { data: lab } = await supabase.from("labs").select("ticks_practice_stage").eq("slug", labSlug).maybeSingle();
    if ((lab as { ticks_practice_stage?: boolean } | null)?.ticks_practice_stage !== true) return false;

    const { data: links } = await supabase.from("lab_topics").select("topic_slug").eq("lab_slug", labSlug);
    const topicSlugs = ((links ?? []) as { topic_slug: string }[]).map((r) => r.topic_slug);
    for (const topicSlug of topicSlugs) {
      await applyStageToTopic(supabase, userId, topicSlug, "practice", true);
    }
    return topicSlugs.length > 0;
  } catch {
    return false;
  }
}
