/**
 * Shared stage-application logic. Lives outside the "use server" actions so
 * that lab completion (L4) can tick a topic's Practice stage through exactly
 * the same code path as the roadmap UI — no bypass, no duplicated semantics.
 */
import type { createClient } from "@/lib/supabase/server";
import { scheduleFirstReview } from "@/lib/revision/actions";
import { STAGE_ORDER, type StageKey } from "./types";

/** Same client type every other server module passes around. */
type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type ApplyStageResult = { ok: true; allDone: boolean } | { ok: false; error: string };

/** Tick (or untick) one stage on a topic, preserving the other stages. */
export async function applyStageToTopic(
  supabase: ServerClient,
  userId: string,
  topicSlug: string,
  stage: StageKey,
  done: boolean,
): Promise<ApplyStageResult> {
  if (!STAGE_ORDER.includes(stage)) return { ok: false, error: "Unknown stage." };

  const { data: existing } = (await supabase
    .from("user_topic_progress")
    .select("status, stages")
    .eq("user_id", userId)
    .eq("topic_slug", topicSlug)
    .maybeSingle()) as { data: { status: string; stages: unknown } | null; error: unknown };

  const prev = (existing?.stages ?? {}) as Record<string, unknown>;
  const stages = {
    read: stage === "read" ? done : prev.read === true,
    practice: stage === "practice" ? done : prev.practice === true,
    test: stage === "test" ? done : prev.test === true,
    build: stage === "build" ? done : prev.build === true,
  };

  const allDone = STAGE_ORDER.every((s) => stages[s]);
  const status = allDone ? "completed" : "in_progress";

  const { error } = await supabase.from("user_topic_progress").upsert(
    {
      user_id: userId,
      topic_slug: topicSlug,
      status,
      stages,
      completed_at: allDone ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,topic_slug" },
  );
  if (error) return { ok: false, error: "Could not save that. Try again in a moment." };

  // Topic fully completed → schedule its first spaced review (Phase 9).
  if (allDone) await scheduleFirstReview(supabase, userId, topicSlug);

  return { ok: true, allDone };
}
