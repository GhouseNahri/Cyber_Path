import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getRoadmapOverview } from "@/lib/roadmap/queries";
import { dayKeyFor } from "@/lib/session/day";
import {
  DEFAULT_INTERVALS,
  bucketReviews,
  firstReview,
  type ReviewRow,
} from "./engine";

/** Bucketed view of one topic's revision state for the dashboard card. */
export type RevisionItem = {
  topic_slug: string;
  topic_title: string;
  review_number: number;
  interval_days: number;
  due_day_key: string;
  overdue_days: number;
};

export type RevisionQueueData =
  | {
      ok: true;
      todayKey: string;
      intervals: number[];
      due: RevisionItem[];
      upcoming: RevisionItem[];
      graduatedCount: number;
      /** Slugs with a scheduled/completed review — for the generator filter. */
      tracked: Set<string>;
      /** Slugs with a review due today — the generator's top-priority candidates. */
      dueSlugs: Set<string>;
    }
  | { ok: false; missingSchema: true };

function item(row: ReviewRow, title: string, todayKey: string): RevisionItem {
  // Positive days late; 0 when due today or in the future.
  const overdueDays = row.due_day_key < todayKey
    ? Math.round(
        (Date.UTC(...(todayKey.split("-").map(Number) as [number, number, number])) -
          Date.UTC(...(row.due_day_key.split("-").map(Number) as [number, number, number]))) / 86_400_000,
      )
    : 0;
  return {
    topic_slug: row.topic_slug,
    topic_title: title,
    review_number: row.review_number,
    interval_days: row.interval_days,
    due_day_key: row.due_day_key,
    overdue_days: overdueDays,
  };
}

/** The user's configured ladder (defaults when unset). */
export function intervalsOf(profile: { revision_intervals?: unknown } | null): number[] {
  const raw = (profile?.revision_intervals ?? null) as unknown;
  if (!Array.isArray(raw)) return [...DEFAULT_INTERVALS];
  const cleaned = raw
    .map((x) => (typeof x === "number" ? Math.round(x) : Number.parseInt(String(x), 10)))
    .filter((x) => Number.isFinite(x) && x >= 1);
  return cleaned.length > 0 ? cleaned.sort((a, b) => a - b) : [...DEFAULT_INTERVALS];
}

/**
 * The user's revision queue. On first access after this migration, completed
 * topics with no review history are backfilled honestly: review #1 is
 * scheduled from their real completed_at date (so long-finished topics show
 * up due/overdue — nothing fabricated). Idempotent.
 */
export const getRevisionQueue = cache(async (): Promise<RevisionQueueData> => {
  const profile = await getProfile();
  if (!profile) return { ok: false, missingSchema: true };

  const supabase = await createClient();
  const todayKey = dayKeyFor(profile.timezone);

  // 1) Existing review rows.
  const reviewsRes = await supabase
    .from("topic_reviews")
    .select("topic_slug, review_number, interval_days, due_day_key, status, completed_at")
    .order("topic_slug")
    .order("review_number");

  if (reviewsRes.error) {
    // Missing table ⇒ migration 0011 not applied.
    if (reviewsRes.error.code === "42P01") return { ok: false, missingSchema: true };
    return { ok: false, missingSchema: true };
  }

  // 2) Completed topics for the honest backfill.
  const overview = await getRoadmapOverview();
  if (!overview.ok) return { ok: false, missingSchema: true };
  const allTopics = overview.phases.flatMap((p) => p.topics);
  const completed = allTopics.filter((t) => t.progress.status === "completed");

  const rows = (reviewsRes.data ?? []) as unknown as ReviewRow[];
  const tracked = new Set(rows.map((r) => r.topic_slug));

  const backfill: { user_id: string; topic_slug: string; review_number: number; interval_days: number; due_day_key: string }[] = [];
  const intervals = intervalsOf(profile);
  for (const t of completed) {
    if (tracked.has(t.slug)) continue;
    const first = firstReview(intervals, t.progress.completed_at?.slice(0, 10) ?? todayKey);
    if (first) {
      backfill.push({
        user_id: profile.id,
        topic_slug: t.slug,
        review_number: first.review_number,
        interval_days: first.interval_days,
        due_day_key: first.due_day_key,
      });
      tracked.add(t.slug);
    }
  }
  if (backfill.length > 0) {
    const { error: insErr } = await supabase.from("topic_reviews").insert(backfill);
    if (!insErr) {
      rows.push(
        ...backfill.map((b) => ({
          topic_slug: b.topic_slug,
          review_number: b.review_number,
          interval_days: b.interval_days,
          due_day_key: b.due_day_key,
          status: "scheduled" as const,
          completed_at: null,
        })),
      );
    }
  }

  // 3) Bucket.
  const titleBySlug = new Map(allTopics.map((t) => [t.slug, t.title] as const));
  const completedSlugs = new Set(completed.map((t) => t.slug));
  const buckets = bucketReviews(rows, todayKey, completedSlugs);

  return {
    ok: true,
    todayKey,
    intervals,
    due: buckets.due.map((r) => item(r, titleBySlug.get(r.topic_slug) ?? r.topic_slug, todayKey)),
    upcoming: buckets.upcoming
      .slice(0, 7)
      .map((r) => item(r, titleBySlug.get(r.topic_slug) ?? r.topic_slug, todayKey)),
    graduatedCount: buckets.graduatedSlugs.length,
    tracked,
    dueSlugs: new Set(buckets.due.map((r) => r.topic_slug)),
  };
});
