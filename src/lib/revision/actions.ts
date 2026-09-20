"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { dayKeyFor } from "@/lib/session/day";
import { firstReview, nextReviewAfter, validateIntervals } from "./engine";
import type { ActionResult } from "@/lib/roadmap/actions";

const REVALIDATE_PATHS = ["/", "/roadmap", "/session", "/history", "/settings", "/skills"];

function revalidateAll() {
  for (const p of REVALIDATE_PATHS) revalidatePath(p);
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

/**
 * Schedule review #1 for a topic the user just completed. Called from both
 * completion paths (topic-page stage toggle and daily-task completion) so
 * the queue grows no matter how the user finished the topic. Idempotent:
 * the PK (user, topic, review #1) makes a double insert a no-op.
 */
export async function scheduleFirstReview(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, topicSlug: string): Promise<void> {
  const profile = await getProfile();
  if (!profile) return;
  const todayKey = dayKeyFor(profile.timezone);
  const first = firstReview(intervalsFrom(profile.revision_intervals), todayKey);
  if (!first) return;
  await supabase.from("topic_reviews").upsert(
    {
      user_id: userId,
      topic_slug: topicSlug,
      review_number: first.review_number,
      interval_days: first.interval_days,
      due_day_key: first.due_day_key,
      status: "scheduled" as const,
      completed_at: null,
    },
    { onConflict: "user_id,topic_slug,review_number", ignoreDuplicates: true },
  );
}

/** Intervals from a profile row (or defaults). Kept local to avoid a client import cycle. */
function intervalsFrom(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [1, 3, 7, 14, 30];
  const cleaned = raw
    .map((x) => (typeof x === "number" ? Math.round(x) : Number.parseInt(String(x), 10)))
    .filter((x) => Number.isFinite(x) && x >= 1);
  return cleaned.length > 0 ? cleaned.sort((a, b) => a - b) : [1, 3, 7, 14, 30];
}

/**
 * Mark a scheduled review completed and schedule the next rung. Called from
 * the daily-task flow when a "review" task completes (its topic matches a
 * scheduled review). Returns the next due day so the caller can show it.
 */
export async function completeReview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  topicSlug: string,
): Promise<{ nextDue: string | null }> {
  const { data: scheduled } = await supabase
    .from("topic_reviews")
    .select("review_number, interval_days, due_day_key")
    .eq("user_id", userId)
    .eq("topic_slug", topicSlug)
    .eq("status", "scheduled")
    .order("review_number")
    .limit(1);

  const row = (scheduled ?? [])[0] as { review_number: number } | undefined;
  if (!row) return { nextDue: null };

  const profile = await getProfile();
  const todayKey = dayKeyFor(profile?.timezone);

  const { error } = await supabase
    .from("topic_reviews")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("topic_slug", topicSlug)
    .eq("review_number", row.review_number)
    .eq("status", "scheduled");
  if (error) return { nextDue: null };

  const next = nextReviewAfter(intervalsFrom(profile?.revision_intervals), row.review_number, todayKey);
  if (next) {
    await supabase.from("topic_reviews").upsert(
      {
        user_id: userId,
        topic_slug: topicSlug,
        review_number: next.review_number,
        interval_days: next.interval_days,
        due_day_key: next.due_day_key,
        status: "scheduled" as const,
        completed_at: null,
      },
      { onConflict: "user_id,topic_slug,review_number", ignoreDuplicates: true },
    );
  }
  return { nextDue: next?.due_day_key ?? null };
}

/** Topic reset (un-complete) → drop its pending reviews. Completed history stays. */
export async function cancelReviews(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, topicSlug: string): Promise<void> {
  await supabase
    .from("topic_reviews")
    .delete()
    .eq("user_id", userId)
    .eq("topic_slug", topicSlug)
    .eq("status", "scheduled");
}

/** Settings: replace the user's interval ladder (future scheduling only). */
export async function setRevisionIntervals(intervals: number[]): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const cleaned = validateIntervals(intervals);
  const { error } = await supabase
    .from("profiles")
    .update({ revision_intervals: cleaned })
    .eq("id", userId);
  if (error) return { ok: false, error: "Could not save the schedule. Try again in a moment." };

  revalidateAll();
  return { ok: true };
}

export type MarkReviewedResult = { ok: true; nextDue: string | null } | { ok: false; error: string };

/** Manual "mark reviewed" from the dashboard queue card (no daily task needed). */
export async function markReviewed(topicSlug: string): Promise<MarkReviewedResult> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { ok: false, error: "Your session expired — sign in again." };

  const { nextDue } = await completeReview(supabase, userId, topicSlug);

  // Keep last_practiced_at honest too.
  await supabase
    .from("user_topic_progress")
    .update({ last_practiced_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("topic_slug", topicSlug);

  revalidateAll();
  return { ok: true, nextDue };
}
