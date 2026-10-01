"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cancelReviews, scheduleFirstReview } from "@/lib/revision/actions";
import { applyStageToTopic } from "./stage";
import { STAGE_ORDER, type StageKey } from "./types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const STAGE_PATHS = ["/", "/roadmap", "/skills"];

function revalidateRoadmap(topicSlug?: string) {
  for (const p of STAGE_PATHS) revalidatePath(p);
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

/** Toggle one stage checkbox (learn/practice/test/build) on a topic. */
export async function setStage(topicSlug: string, stage: StageKey, done: boolean): Promise<ActionResult> {
  if (!STAGE_ORDER.includes(stage)) return { ok: false, error: "Unknown stage." };

  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const result = await applyStageToTopic(supabase, userId, topicSlug, stage, done);
  if (!result.ok) return { ok: false, error: result.error };

  revalidateRoadmap(topicSlug);
  return { ok: true };
}

/** Start a topic (marks in_progress) or reset it to not_started. */
export async function setTopicStatus(topicSlug: string, status: "in_progress" | "not_started"): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  if (status === "not_started") {
    const { error } = await supabase
      .from("user_topic_progress")
      .delete()
      .eq("user_id", userId)
      .eq("topic_slug", topicSlug);
    if (error) return { ok: false, error: "Could not reset that topic." };
    // A reset topic has no pending reviews (completed history is kept).
    await cancelReviews(supabase, userId, topicSlug);
  } else {
    const { data: existing } = await supabase
      .from("user_topic_progress")
      .select("stages")
      .eq("user_id", userId)
      .eq("topic_slug", topicSlug)
      .maybeSingle();
    const { error } = await supabase.from("user_topic_progress").upsert(
      {
        user_id: userId,
        topic_slug: topicSlug,
        status: "in_progress",
        stages: existing?.stages ?? { read: false, practice: false, test: false, build: false },
      },
      { onConflict: "user_id,topic_slug" },
    );
    if (error) return { ok: false, error: "Could not save that. Try again in a moment." };
  }

  revalidateRoadmap(topicSlug);
  return { ok: true };
}

/** Confidence 1–5 after working through a topic. */
export async function setConfidence(topicSlug: string, confidence: number): Promise<ActionResult> {
  if (!Number.isInteger(confidence) || confidence < 1 || confidence > 5)
    return { ok: false, error: "Confidence must be 1–5." };

  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  // Upsert requires the full row shape; fetch or synthesize defaults first.
  const { data: existing } = await supabase
    .from("user_topic_progress")
    .select("status, stages")
    .eq("user_id", userId)
    .eq("topic_slug", topicSlug)
    .maybeSingle();

  const { error } = await supabase.from("user_topic_progress").upsert(
    {
      user_id: userId,
      topic_slug: topicSlug,
      status: existing?.status ?? "in_progress",
      stages: existing?.stages ?? { read: false, practice: false, test: false, build: false },
      confidence,
    },
    { onConflict: "user_id,topic_slug" },
  );
  if (error) return { ok: false, error: "Could not save that. Try again in a moment." };

  revalidateRoadmap(topicSlug);
  return { ok: true };
}
