import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getRoadmapOverview } from "@/lib/roadmap/queries";
import { getRevisionQueue } from "@/lib/revision/queries";
import { getCareerData } from "@/lib/career/queries";
import { missedPatterns, quizStats, weakByConfidence, type QuizTopicStat } from "@/lib/analytics/engine";
import { MISSED_REASON_LABELS } from "@/lib/streak/messages";
import { dayKeyFor, dayKeyRange } from "@/lib/session/day";
import { recommend, humanizeReason, type LabCandidate, type RecommendInput, type Recommendation, type TopicState } from "./engine";

export type RecommendData =
  | { ok: true; todayKey: string; recs: Recommendation[] }
  | { ok: false; missingSchema: true };

/** Days overdue between two day keys (positive when due < today). */
function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = toKey.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/**
 * The Phase 15 recommendation feed. Composes existing RLS-scoped queries —
 * no new tables. Optional inputs (quizzes, career paths, misses) degrade
 * gracefully: empty arrays simply produce fewer candidate kinds.
 */
export const getRecommendations = cache(async (): Promise<RecommendData> => {
  const profile = await getProfile();
  if (!profile) return { ok: false, missingSchema: true };

  const overview = await getRoadmapOverview();
  if (!overview.ok) return { ok: false, missingSchema: true };

  const supabase = await createClient();
  const todayKey = dayKeyFor(profile.timezone);
  const fromKey = dayKeyRange(todayKey, 30)[0] ?? todayKey;

  const [queue, career, attemptsRes, missedRes, tasksRes, progressRes] = await Promise.all([
    getRevisionQueue(),
    getCareerData(),
    supabase.from("quiz_attempts").select("topic_slug, score_pct, passed, completed_at").gte("completed_at", `${fromKey}T00:00:00Z`),
    supabase.from("missed_days").select("day_key, reason_category").gte("day_key", fromKey),
    supabase.from("daily_tasks").select("planned_minutes, actual_minutes, status").gte("day_key", fromKey),
    supabase.from("user_topic_progress").select("topic_slug, confidence, status, completed_at").eq("status", "completed"),
  ]);

  const topics: TopicState[] = overview.phases.flatMap((p) =>
    p.topics.map((t) => ({
      slug: t.slug,
      title: t.title,
      summary: t.summary,
      estimated_minutes: t.estimated_minutes,
      status: t.progress.status,
      locked: t.locked,
      stages_done: Object.values(t.progress.stages).filter(Boolean).length,
      phase_title: p.title,
      confidence: t.progress.confidence,
    })),
  );

  // Due revisions with real overdue day counts.
  const dueRevisions = (queue.ok ? queue.due : []).map((r) => ({
    topic_slug: r.topic_slug,
    title: r.topic_title,
    overdue_days: Math.max(0, daysBetween(r.due_day_key, todayKey)),
  }));

  // Weak quiz topics (best score < 70) over the window.
  let weakQuizTopics: { topic_slug: string; best_pct: number; attempts: number }[] = [];
  if (!attemptsRes.error) {
    const stats: QuizTopicStat[] = quizStats((attemptsRes.data ?? []) as never).weakest;
    weakQuizTopics = stats
      .filter((s) => s.best_pct < 70)
      .slice(0, 3)
      .map((s) => ({ topic_slug: s.topic_slug, best_pct: s.best_pct, attempts: s.attempts }));
  }

  // Low-confidence completed topics (rated 1–2).
  const lowConfidenceTopics = progressRes.error
    ? []
    : weakByConfidence((progressRes.data ?? []) as never)
        .slice(0, 3)
        .map((w) => ({ topic_slug: w.topic_slug, confidence: w.confidence }));

  // Selected career paths → their recommended topic slugs.
  const selectedCareerTopics =
    career.ok
      ? [
          ...new Set(
            career.paths
              .filter((p) => p.selected)
              .flatMap((p) => p.recommended_topics),
          ),
        ]
      : [];

  // Missed-day pattern over the window (30 days, matching the analytics window).
  const missedRows = (missedRes.error ? [] : (missedRes.data ?? [])) as { day_key: string; reason_category: string }[];
  const taskRows = (tasksRes.error ? [] : (tasksRes.data ?? [])) as {
    planned_minutes: number;
    actual_minutes: number | null;
    status: string;
  }[];
  const missed = missedPatterns(missedRows, taskRows);
  const topReasonLabel = missed.topReason
    ? MISSED_REASON_LABELS[missed.topReason.category as keyof typeof MISSED_REASON_LABELS] ??
      humanizeReason(missed.topReason.category)
    : null;

  // Lab candidates (L4): published labs + the user's tracker rows + mappings.
  // Degrades to no lab recommendations when the labs tables are missing.
  const [labsRes, labTopicsRes, mineLabsRes] = await Promise.all([
    supabase.from("labs").select("slug, title, estimated_minutes, difficulty").eq("is_published", true),
    supabase.from("lab_topics").select("lab_slug, topic_slug"),
    supabase.from("user_labs").select("lab_slug, status").eq("user_id", profile.id),
  ]);

  const topicsByLab = new Map<string, string[]>();
  if (!labTopicsRes.error) {
    for (const r of labTopicsRes.data ?? []) {
      const list = topicsByLab.get(r.lab_slug) ?? [];
      list.push(r.topic_slug);
      topicsByLab.set(r.lab_slug, list);
    }
  }
  const statusByLab = new Map<string, string>();
  if (!mineLabsRes.error) {
    for (const r of mineLabsRes.data ?? []) {
      if (typeof r.lab_slug === "string") statusByLab.set(r.lab_slug, r.status);
    }
  }

  const labs: LabCandidate[] = ((labsRes.data ?? []) as { slug: string; title: string; estimated_minutes: number }[]).map(
    (l) => ({
      slug: l.slug,
      title: l.title,
      status: (statusByLab.get(l.slug) ?? "not_started") as LabCandidate["status"],
      estimated_minutes: l.estimated_minutes ?? 60,
      topics: topicsByLab.get(l.slug) ?? [],
      skills: [],
    }),
  );

  const input: RecommendInput = {
    topics,
    labs,
    dueRevisions,
    weakQuizTopics,
    lowConfidenceTopics,
    selectedCareerTopics,
    missed: { total: missed.total, suggestLowerTarget: missed.suggestLowerTarget, topReasonLabel },
    goalMinutes: profile.daily_goal_minutes ?? 45,
    avgActualMinutes: null,
  };

  return { ok: true, todayKey, recs: recommend(input) };
});
