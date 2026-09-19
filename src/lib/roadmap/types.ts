/** Shared roadmap domain types. Keep field names in sync with the
 *  supabase/migrations schema (0003). */

export type StageKey = "read" | "practice" | "test" | "build";

export const STAGE_ORDER: StageKey[] = ["read", "practice", "test", "build"];

export const STAGE_META: Record<StageKey, { label: string; blurb: string }> = {
  read: { label: "Learn", blurb: "Study the concepts from the resources below." },
  practice: { label: "Practice", blurb: "Get hands-on — exercises, labs, commands." },
  test: { label: "Test", blurb: "Prove understanding: explain, predict, answer." },
  build: { label: "Build", blurb: "Produce an artifact that shows the skill." },
};

export type Stages = Record<StageKey, boolean>;

export const EMPTY_STAGES: Stages = { read: false, practice: false, test: false, build: false };

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type RoadmapPhase = {
  slug: string;
  order_index: number;
  title: string;
  tagline: string | null;
  description: string;
  estimated_hours: number | null;
};

export type TopicRow = {
  slug: string;
  phase_slug: string;
  order_index: number;
  title: string;
  summary: string;
  why_it_matters: string;
  difficulty: Difficulty;
  estimated_minutes: number;
  stage_hints: Record<StageKey, string> | Record<string, never>;
  is_optional: boolean;
};

export type UserTopicProgress = {
  status: "not_started" | "in_progress" | "completed";
  stages: Stages;
  confidence: number | null;
  last_practiced_at: string | null;
  completed_at: string | null;
};

export type ResourceRow = {
  id: string;
  topic_slug: string;
  title: string;
  provider: string;
  url: string;
  type:
    | "documentation"
    | "article"
    | "video"
    | "course"
    | "interactive_lab"
    | "ctf"
    | "book"
    | "cheat_sheet"
    | "exercise";
  difficulty: Difficulty | null;
  estimated_minutes: number | null;
  is_free: boolean;
  is_official: boolean;
  priority: number;
  last_verified: string | null;
  notes: string | null;
};

export type SkillRow = { slug: string; name: string; category: string };

/** A topic enriched with computed roadmap state. */
export type TopicView = TopicRow & {
  progress: UserTopicProgress;
  /** All prerequisites are completed → you can work on this now. */
  locked: boolean;
  /** Prerequisite topics not yet completed (direct edges only). */
  unmet: { slug: string; title: string; phase_title: string }[];
  prereq_total: number;
  prereq_done: number;
};

export type PhaseView = RoadmapPhase & { topics: TopicView[] };

export type RoadmapOverview =
  | { ok: true; phases: PhaseView[]; totals: Totals }
  | { ok: false; missingSchema: true };

export type Totals = {
  topics: number;
  completed: number;
  in_progress: number;
  unlocked_pending: number;
  locked: number;
};

export type TopicDetail = {
  topic: TopicView;
  phase: RoadmapPhase;
  resources: ResourceRow[];
  skills: SkillRow[];
};
