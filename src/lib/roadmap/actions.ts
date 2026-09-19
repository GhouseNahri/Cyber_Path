"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

  // Current row (or canonical empty default).
  const { data: existing } = await supabase
    .from("user_topic_progress")
    .select("status, stages")
    .eq("user_id", userId)
    .eq("topic_slug", topicSlug)
    .maybeSingle();

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
