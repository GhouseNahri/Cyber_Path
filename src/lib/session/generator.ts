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

/**
 * Build today's mission from real roadmap state.
 *
 * Priority: in-progress topics first (finish what you started), then next
 * unlocked topics in phase order. Each mission has at most 3 tasks and at
 * most one task per topic so the day touches 2–3 skills, not one grind.
 */
export function generateMission(input: {
  goalMinutes: number;
  timezone: string | null | undefined;
  topics: TopicView[];
  now?: Date;
}): GeneratedTask[] {
  const { goalMinutes, timezone, topics } = input;
  const now = input.now ?? new Date();

  const candidates = topics.filter((t) => !t.locked && t.progress.status !== "completed");
  const inProgress = candidates.filter((t) => t.progress.status === "in_progress");
  const fresh = candidates.filter((t) => t.progress.status === "not_started");

  // Interleave: in-progress first, then fresh, one task each per pass.
  const ordered: TopicView[] = [...inProgress, ...fresh];

  const drafts: { topic: TopicView; stage: StageKey }[] = [];

  // Pass 1: one task per candidate topic (max 3).
  for (const topic of ordered) {
    if (drafts.length >= 3) break;
    const stage = remainingStages(topic)[0];
    if (!stage) continue;
    drafts.push({ topic, stage });
  }

  // Pass 2: if fewer than 2 tasks, a second (deeper) task on the first topic.
  const first = drafts[0];
  if (first && drafts.length < 2) {
    const second = remainingStages(first.topic)[1];
    if (second) drafts.push({ topic: first.topic, stage: second });
  }

  if (drafts.length === 0) return [];

  const minutes = planMinutes(goalMinutes, drafts.length);

  return drafts.map((d, i) => {
    const kind = KIND_BY_STAGE[d.stage];
    const hint = hintFor(d.topic, d.stage);
    const stageList = remainingStages(d.topic);
    const why =
      hint ??
      (d.topic.progress.status === "in_progress"
        ? `You're ${4 - stageList.length}/4 stages into “${d.topic.title}” — ${d.stage} is next.`
        : `Next unlocked topic on your path; finishing it opens what follows.`);

    const title = hint
      ? `${KIND_VERB[kind]}: ${truncate(hint, 70)}`
      : `${KIND_VERB[kind]} ${d.topic.title}`;

    // Evening nudge: trim scope so "today" stays achievable.
    const cap = isEveningLocal(timezone, now) ? Math.max(10, Math.floor(minutes[i] ?? 15)) : (minutes[i] ?? 15);

    return {
      topic_slug: d.topic.slug,
      kind,
      title: truncate(title, 90),
      why: truncate(why, 160),
      planned_minutes: cap,
      position: i,
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
  const parts: string[] = [];
  if (topics > 1) parts.push(`${topics} topics on deck`);
  else parts.push("one focus topic");
  parts.push("in-progress work first, then fresh unlocked topics");
  parts.push("sized to your daily goal");
  return parts.join(" · ");
}
