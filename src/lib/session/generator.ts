import { STAGE_ORDER, type StageKey, type TopicView } from "@/lib/roadmap/types";
import { isEveningLocal } from "./day";
import type { TaskKind } from "./types";

/** Mission shape before it hits the DB. */
export type GeneratedTask = {
  topic_slug: string;
  kind: TaskKind;
  title: string;
  why: string;
  planned_minutes: number;
  position: number;
  resource_id: string | null;
};

const KIND_BY_STAGE: Record<StageKey, TaskKind> = {
  read: "learn",
  practice: "practice",
  test: "test",
  build: "build",
};

const KIND_VERB: Record<TaskKind, string> = {
  learn: "Study",
  practice: "Practice",
  test: "Test yourself on",
  build: "Build something with",
  review: "Review",
};

/** Unfinished stages for a topic, roadmap order first. */
function remainingStages(topic: TopicView): StageKey[] {
  return STAGE_ORDER.filter((s) => !topic.progress.stages[s]);
}

/** The topic's own stage hint text, when seeded. */
function hintFor(topic: TopicView, stage: StageKey): string | null {
  const hints = topic.stage_hints as Record<string, string> | Record<string, never> | null;
  if (!hints || typeof hints !== "object") return null;
  const raw = (hints as Record<string, unknown>)[stage];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

/** Split a task's minutes across the mission so tasks fit the daily goal. */
function planMinutes(goalMinutes: number, taskCount: number): number[] {
  if (taskCount <= 0) return [];
  const base = Math.max(5, Math.floor(goalMinutes / taskCount / 5) * 5);
  const out: number[] = [];
  let left = goalMinutes;
  for (let i = 0; i < taskCount; i++) {
    const isLast = i === taskCount - 1;
    const minutes = isLast ? Math.max(5, left) : Math.min(base, Math.max(5, left - 5 * (taskCount - 1 - i)));
    out.push(Math.min(minutes, 120));
    left -= minutes;
  }
  return out;
}

/** Resource input for linking learn/practice tasks to real seeded resources. */
export type ResourceLinkInput = { topic_slug: string; id: string; type: string; priority: number }[];

/** Cap on revision tasks per mission — the day must still move forward. */
const MAX_REVISION_TASKS = 2;

/**
 * Build today's mission from real roadmap state.
 *
 * Priority: due spaced revisions first (from the Phase 9 revision queue),
 * then in-progress topics (finish what you started), then next unlocked
 * topics. Max 3 tasks, max one task per topic, revisions capped at 2 so the
 * mission always advances the roadmap too. When yesterday generated the
 * exact same task set, the first in-progress/fresh candidate is skipped to
 * force variety.
 */
export function generateMission(input: {
  goalMinutes: number;
  timezone: string | null | undefined;
  topics: TopicView[];
  resources?: ResourceLinkInput;
  yesterdayTaskSignatures?: string[];
  /** Topic slugs with a scheduled revision due today (or overdue). */
  dueRevisionSlugs?: ReadonlySet<string>;
  now?: Date;
}): GeneratedTask[] {
  const { goalMinutes, timezone, topics, resources, yesterdayTaskSignatures, dueRevisionSlugs } = input;
  const now = input.now ?? new Date();

  const candidates = topics.filter((t) => !t.locked && t.progress.status !== "completed");
  const revisionDue = topics.filter((t) => dueRevisionSlugs?.has(t.slug) ?? false).slice(0, MAX_REVISION_TASKS);
  const inProgress = candidates.filter((t) => t.progress.status === "in_progress");
  const fresh = candidates.filter((t) => t.progress.status === "not_started");

  // Signature of a candidate in KIND-space (what daily_tasks stores), so
  // yesterday's rows are directly comparable: topic + its next task kind.
  const sig = (t: TopicView) => {
    const stage = remainingStages(t)[0];
    return `${t.slug}:${stage ? KIND_BY_STAGE[stage] : "review"}`;
  };
  const yesterdaySet = new Set(yesterdayTaskSignatures ?? []);
  const todaySet = new Set([...revisionDue, ...inProgress, ...fresh].slice(0, 3).map(sig));
  const sameAsYesterday =
    yesterdaySet.size > 0 && todaySet.size > 0 && [...todaySet].every((s) => yesterdaySet.has(s));

  const allOrdered = [...revisionDue, ...inProgress, ...fresh];
  const ordered: TopicView[] = sameAsYesterday && allOrdered.length > 1 ? allOrdered.slice(1) : allOrdered;

  const drafts: { topic: TopicView; stage: StageKey | null }[] = [];

  for (const topic of ordered) {
    if (drafts.length >= 3) break;
    const stage = remainingStages(topic)[0] ?? null;
    if (stage) {
      drafts.push({ topic, stage });
    } else if (topic.progress.status === "completed") {
      // Review-due topic: all stages done, but knowledge needs reinforcement.
      drafts.push({ topic, stage: null });
    }
  }

  // Review-only mission: add the next real topic so the day still advances.
  const first = drafts[0];
  if (first && drafts.length < 2 && first.topic.progress.status === "completed") {
    const next = inProgress[0] ?? fresh[0];
    const nextStage = next ? remainingStages(next)[0] : null;
    if (next && nextStage) drafts.push({ topic: next, stage: nextStage });
  } else if (first && drafts.length < 2) {
    const second = remainingStages(first.topic)[1];
    if (second) drafts.push({ topic: first.topic, stage: second });
  }

  if (drafts.length === 0) return [];

  const minutes = planMinutes(goalMinutes, drafts.length);
  const resourceByTopic = new Map((resources ?? []).map((r) => [r.topic_slug, r.id] as const));

  return drafts.map((d, i) => {
    const isReview = d.topic.progress.status === "completed";
    const kind: TaskKind = isReview ? "review" : KIND_BY_STAGE[d.stage as StageKey];
    const hint = d.stage ? hintFor(d.topic, d.stage) : null;
    const stageList = remainingStages(d.topic);
    const why = isReview
      ? `Spaced revision from your queue — a short pass now keeps it from fading.`
      : hint ??
        (d.topic.progress.status === "in_progress"
          ? `You're ${4 - stageList.length}/4 stages into “${d.topic.title}” — ${d.stage} is next.`
          : `Next unlocked topic on your path; finishing it opens what follows.`);

    const title = isReview
      ? `Review ${d.topic.title}`
      : hint
        ? `${KIND_VERB[kind]}: ${truncate(hint, 70)}`
        : `${KIND_VERB[kind]} ${d.topic.title}`;

    const cap = isEveningLocal(timezone, now) ? Math.max(10, Math.floor(minutes[i] ?? 15)) : (minutes[i] ?? 15);

    return {
      topic_slug: d.topic.slug,
      kind,
      title: truncate(title, 90),
      why: truncate(why, 160),
      planned_minutes: cap,
      position: i,
      // Link a resource to learn tasks (the "study" action needs somewhere to go).
      resource_id: kind === "learn" ? (resourceByTopic.get(d.topic.slug) ?? null) : null,
    };
  });
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Explainable summary of why these tasks were chosen (for the UI). */
export function missionRationale(tasks: GeneratedTask[]): string {
  if (tasks.length === 0) {
    return "No unlocked work right now — complete or seed more roadmap content.";
  }
  const topics = [...new Set(tasks.map((t) => t.topic_slug))].length;
  const reviews = tasks.filter((t) => t.kind === "review").length;
  const parts: string[] = [];
  if (reviews > 0) parts.push(`${reviews} review${reviews === 1 ? "" : "s"} due`);
  if (topics > 1) parts.push(`${topics} topics on deck`);
  else parts.push("one focus topic");
  parts.push("review → in-progress → fresh, sized to your goal");
  return parts.join(" · ");
}
