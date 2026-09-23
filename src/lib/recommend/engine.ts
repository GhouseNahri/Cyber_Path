/**
 * Phase 15 — pure recommendation engine. No network, no DB, no React.
 *
 * Deterministic scoring: every candidate carries the evidence that produced
 * it. Weights are transparent and documented here, not "AI". Tie-break order:
 * priority desc → score desc → stable insertion order (Array.sort is stable).
 *
 *   due-revision     120  (+4 per day overdue, capped +20)
 *   career-next      100  unlocked, not-completed topic in a selected path
 *   in-progress       90  +2 per completed stage
 *   next-unlocked     70  roadmap order
 *   low-confidence    85  completed topic still rated 1–2 (60 + (3 − confidence)×5)
 *   weak-quiz         75  best score < 70 (95 − best_score)
 *   smaller-target     0  fires once when missed-day pattern says planned ≫ actual
 */

export type RecKind =
  | "due_revision"
  | "continue_topic"
  | "start_topic"
  | "low_confidence_review"
  | "weak_quiz_retest"
  | "career_next"
  | "smaller_target";

export type Recommendation = {
  kind: RecKind;
  title: string;
  why: string;
  href: string;
  estimated_minutes: number;
  score: number;
};

export type TopicState = {
  slug: string;
  title: string;
  summary: string;
  estimated_minutes: number;
  status: "not_started" | "in_progress" | "completed";
  locked: boolean;
  /** Completed stage count 0–4. */
  stages_done: number;
  phase_title: string;
  confidence: number | null;
};

/** Next not-completed topic in the same phase after `slug`, if any. */
function nextTopicInPhase(topics: TopicState[], slug: string): TopicState | null {
  const idx = topics.findIndex((t) => t.slug === slug);
  if (idx === -1) return null;
  for (let i = idx + 1; i < topics.length; i++) {
    const t = topics[i];
    if (t && t.status !== "completed") return t;
  }
  return null;
}

/** 1:1 phase prerequisites ("A required for B") among not-completed topics. */
function phaseNextMap(topics: TopicState[]): Map<string, TopicState> {
  const map = new Map<string, TopicState>();
  for (const t of topics) {
    if (t.status === "completed") continue;
    const next = nextTopicInPhase(topics, t.slug);
    if (next) map.set(t.slug, next);
  }
  return map;
}

export type RecommendInput = {
  topics: TopicState[];
  /** Topic title + days overdue for reviews due today. */
  dueRevisions: { topic_slug: string; title: string; overdue_days: number }[];
  /** Unfinished project slugs, for career-evidence context (reserved). */
  weakQuizTopics: { topic_slug: string; best_pct: number; attempts: number }[];
  lowConfidenceTopics: { topic_slug: string; confidence: number }[];
  selectedCareerTopics: string[];
  missed: { total: number; suggestLowerTarget: boolean; topReasonLabel: string | null };
  goalMinutes: number;
  avgActualMinutes: number | null;
};

const CAREER_BONUS = 100;
const IN_PROGRESS_BASE = 90;
const LOW_CONF_BASE = 60;
const WEAK_QUIZ_BASE = 95;

export function recommend(input: RecommendInput): Recommendation[] {
  const out: Recommendation[] = [];
  const phaseNext = phaseNextMap(input.topics);
  const careerSet = new Set(input.selectedCareerTopics);

  // 1) Due spaced revisions — top of the pile, urgency-scaled.
  for (const r of input.dueRevisions) {
    const overdue = Math.max(0, r.overdue_days);
    out.push({
      kind: "due_revision",
      title: `Review: ${r.title}`,
      why:
        overdue > 0
          ? `Spaced revision ${overdue} day${overdue === 1 ? "" : "s"} overdue — a short pass now keeps it from fading.`
          : "Spaced revision due today — a short pass now keeps it from fading.",
      href: `/roadmap/${r.topic_slug}`,
      estimated_minutes: 15,
      score: 120 + Math.min(20, overdue * 4),
    });
  }

  // 2) Career-aligned next steps: unlocked, not-completed topics in selected paths.
  const careerTopicSet = new Set<string>();
  for (const t of input.topics) {
    if (t.locked || t.status === "completed") continue;
    if (!careerSet.has(t.slug)) continue;
    careerTopicSet.add(t.slug);
    const next = phaseNext.get(t.slug);
    const why = next
      ? `On your selected career path, and ${next.title} depends on it.`
      : "On your selected career path — this is the next gap in that track.";
    out.push({
      kind: "career_next",
      title: t.title,
      why,
      href: `/roadmap/${t.slug}`,
      estimated_minutes: t.estimated_minutes,
      score: CAREER_BONUS + (t.status === "in_progress" ? 10 : 0),
    });
  }

  // 3) Continue in-progress topics.
  for (const t of input.topics) {
    if (t.locked || t.status !== "in_progress") continue;
    if (careerTopicSet.has(t.slug)) continue; // already emitted at higher score
    const next = phaseNext.get(t.slug);
    out.push({
      kind: "continue_topic",
      title: `Continue: ${t.title}`,
      why: next
        ? `${t.stages_done}/4 stages done — ${next.title} is waiting on it.`
        : `${t.stages_done}/4 stages done — finish the remaining stages to close it out.`,
      href: `/roadmap/${t.slug}`,
      estimated_minutes: t.estimated_minutes,
      score: IN_PROGRESS_BASE + t.stages_done * 2,
    });
  }

  // 4) Next unlocked fresh topics (roadmap order — input is phase-ordered).
  for (const t of input.topics) {
    if (t.locked || t.status !== "not_started") continue;
    if (careerTopicSet.has(t.slug)) continue;
    const next = phaseNext.get(t.slug);
    out.push({
      kind: "start_topic",
      title: `Start: ${t.title}`,
      why: next
        ? `Next unlocked on your path — ${next.title} depends on it.`
        : "Next unlocked topic on your path.",
      href: `/roadmap/${t.slug}`,
      estimated_minutes: t.estimated_minutes,
      score: 70,
    });
  }

  // 5) Completed topics still rated low-confidence — review, don't re-learn.
  for (const w of input.lowConfidenceTopics) {
    const t = input.topics.find((x) => x.slug === w.topic_slug);
    if (!t || t.status !== "completed") continue;
    out.push({
      kind: "low_confidence_review",
      title: `Review: ${t.title}`,
      why: `You finished it but rated your confidence ${w.confidence}/5 — one pass before moving deeper.`,
      href: `/roadmap/${t.slug}`,
      estimated_minutes: 15,
      score: LOW_CONF_BASE + (3 - w.confidence) * 5,
    });
  }

  // 6) Weak quiz performances — retest where the evidence says so.
  for (const q of input.weakQuizTopics) {
    const t = input.topics.find((x) => x.slug === q.topic_slug);
    if (!t) continue;
    out.push({
      kind: "weak_quiz_retest",
      title: `Retest: ${t.title} knowledge check`,
      why: `Best quiz score is ${q.best_pct}% over ${q.attempts} attempt${q.attempts === 1 ? "" : "s"} — below the 70% pass line.`,
      href: `/roadmap/${t.slug}#test`,
      estimated_minutes: 10,
      score: WEAK_QUIZ_BASE - q.best_pct,
    });
  }

  // 7) Smaller target — at most one, honest sizing advice from real misses.
  if (input.missed.suggestLowerTarget && input.missed.total >= 3 && input.goalMinutes > 20) {
    const suggested = Math.max(20, Math.round((input.goalMinutes * 2) / 3 / 5) * 5);
    const reasonBit = input.missed.topReasonLabel ? ` Your most common reason: ${input.missed.topReasonLabel}.` : "";
    out.push({
      kind: "smaller_target",
      title: `Try a ${suggested}-minute daily target`,
      why: `You missed ${input.missed.total} sessions and your average session runs shorter than planned.${reasonBit} A smaller target you actually hit beats a big one you ghost.`,
      href: "/settings",
      estimated_minutes: 0,
      score: 0,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

/** Title-case an enum-ish string for display ("no_time" → "No time"). */
export function humanizeReason(category: string | null): string | null {
  if (!category) return null;
  return category
    .split("_")
    .map((w) => (w.length > 0 ? w[0]?.toUpperCase() + w.slice(1) : w))
    .join(" ");
}
