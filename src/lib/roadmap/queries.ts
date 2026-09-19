import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  EMPTY_STAGES,
  type Difficulty,
  type PhaseView,
  type ResourceRow,
  type RoadmapOverview,
  type RoadmapPhase,
  type SkillRow,
  type StageKey,
  type Stages,
  type TopicDetail,
  type TopicRow,
  type TopicView,
  type UserTopicProgress,
} from "./types";

/** Normalize whatever stages jsonb the DB gives us into the canonical shape. */
export function normalizeStages(raw: unknown): Stages {
  if (!raw || typeof raw !== "object") return { ...EMPTY_STAGES };
  const obj = raw as Record<string, unknown>;
  return {
    read: obj.read === true,
    practice: obj.practice === true,
    test: obj.test === true,
    build: obj.build === true,
  };
}

function normalizeProgress(raw: Record<string, unknown> | null): UserTopicProgress {
  if (!raw) {
    return {
      status: "not_started",
      stages: { ...EMPTY_STAGES },
      confidence: null,
      last_practiced_at: null,
      completed_at: null,
    };
  }
  const status = raw.status === "in_progress" || raw.status === "completed" ? raw.status : "not_started";
  const confidence =
    typeof raw.confidence === "number" && raw.confidence >= 1 && raw.confidence <= 5
      ? raw.confidence
      : null;
  return {
    status,
    stages: normalizeStages(raw.stages),
    confidence,
    last_practiced_at: typeof raw.last_practiced_at === "string" ? raw.last_practiced_at : null,
    completed_at: typeof raw.completed_at === "string" ? raw.completed_at : null,
  };
}

export const getRoadmapOverview = cache(async (): Promise<RoadmapOverview> => {
  const supabase = await createClient();

  const [phasesRes, topicsRes, prereqsRes, progressRes] = await Promise.all([
    supabase.from("roadmap_phases").select("*").order("order_index"),
    supabase.from("topics").select("*").order("phase_slug").order("order_index"),
    supabase.from("topic_prerequisites").select("topic_slug, requires_topic_slug"),
    supabase.from("user_topic_progress").select("topic_slug, status, stages, confidence, last_practiced_at, completed_at"),
  ]);

  // Missing schema → the 0003–0005 migrations haven't been applied yet.
  if (phasesRes.error || topicsRes.error) {
    return { ok: false, missingSchema: true };
  }

  const phases = (phasesRes.data ?? []) as unknown as RoadmapPhase[];
  const topics = (topicsRes.data ?? []) as unknown as TopicRow[];

  if (phases.length === 0) return { ok: false, missingSchema: true };

  const unmetErrors = [prereqsRes.error, progressRes.error].filter(Boolean);
  if (unmetErrors.length > 0) return { ok: false, missingSchema: true };

  type PrereqEdge = { topic_slug: string; requires_topic_slug: string };
  const prereqs = (prereqsRes.data ?? []) as unknown as PrereqEdge[];
  const progressRows = (progressRes.data ?? []) as unknown as (Record<string, unknown> & {
    topic_slug: string;
  })[];

  const titleBySlug = new Map(topics.map((t) => [t.slug, t.title] as const));
  const phaseTitleBySlug = new Map(phases.map((p) => [p.slug, p.title] as const));
  const progressByTopic = new Map(progressRows.map((r) => [r.topic_slug, normalizeProgress(r)]));

  const prereqsByTopic = new Map<string, string[]>();
  for (const edge of prereqs) {
    const list = prereqsByTopic.get(edge.topic_slug) ?? [];
    list.push(edge.requires_topic_slug);
    prereqsByTopic.set(edge.topic_slug, list);
  }

  function buildTopic(t: TopicRow): TopicView {
    const progress = progressByTopic.get(t.slug) ?? normalizeProgress(null);
    const requires = prereqsByTopic.get(t.slug) ?? [];
    const unmet = requires
      .filter((slug) => progressByTopic.get(slug)?.status !== "completed")
      .map((slug) => ({
        slug,
        title: titleBySlug.get(slug) ?? slug,
        phase_title: phaseTitleBySlug.get(
          topics.find((x) => x.slug === slug)?.phase_slug ?? ""
        ) ?? "Roadmap",
      }));
    return {
      ...t,
      difficulty: t.difficulty as Difficulty,
      stage_hints: (t.stage_hints ?? {}) as TopicRow["stage_hints"],
      progress,
      prereq_total: requires.length,
      prereq_done: requires.length - unmet.length,
      unmet,
      locked: unmet.length > 0,
    };
  }

  const topicViewsByPhase = new Map<string, TopicView[]>();
  for (const t of topics) {
    const list = topicViewsByPhase.get(t.phase_slug) ?? [];
    list.push(buildTopic(t));
    topicViewsByPhase.set(t.phase_slug, list);
  }

  const phaseViews: PhaseView[] = phases.map((p) => ({
    ...p,
    topics: (topicViewsByPhase.get(p.slug) ?? []).sort((a, b) => a.order_index - b.order_index),
  }));

  const all = phaseViews.flatMap((p) => p.topics);
  const totals = {
    topics: all.length,
    completed: all.filter((t) => t.progress.status === "completed").length,
    in_progress: all.filter((t) => t.progress.status === "in_progress").length,
    unlocked_pending: all.filter((t) => !t.locked && t.progress.status !== "completed").length,
    locked: all.filter((t) => t.locked && t.progress.status !== "completed").length,
  };

  return { ok: true, phases: phaseViews, totals };
});

export const getTopicDetail = cache(async (slug: string): Promise<TopicDetail | null> => {
  const supabase = await createClient();

  const topicRes = await supabase.from("topics").select("*").eq("slug", slug).maybeSingle();
  if (topicRes.error || !topicRes.data) return null;
  const topic = topicRes.data as unknown as TopicRow;

  const [phaseRes, resourcesRes, skillsRes, progressRes] = await Promise.all([
    supabase.from("roadmap_phases").select("*").eq("slug", topic.phase_slug).maybeSingle(),
    supabase
      .from("resources")
      .select("*")
      .eq("topic_slug", slug)
      .order("priority")
      .order("title"),
    supabase
      .from("topic_skills")
      .select("weight, skills (slug, name, category)")
      .eq("topic_slug", slug),
    supabase
      .from("user_topic_progress")
      .select("status, stages, confidence, last_practiced_at, completed_at")
      .eq("topic_slug", slug)
      .maybeSingle(),
  ]);

  if (phaseRes.error || !phaseRes.data) return null;

  const progress = normalizeProgress(
    (progressRes.data ?? null) as Record<string, unknown> | null
  );

  // Lock state needs every prerequisite's completion status.
  const prereqRes = await supabase
    .from("topic_prerequisites")
    .select("requires_topic_slug, topics!topic_prerequisites_requires_topic_slug_fkey ( slug, title, phase_slug )")
    .eq("topic_slug", slug);
  const prereqEdges = (prereqRes.data ?? []) as unknown as {
    requires_topic_slug: string;
    topics: { slug: string; title: string; phase_slug: string } | null;
  }[];

  const prereqSlugs = prereqEdges.map((e) => e.requires_topic_slug);
  const prereqProgress = new Map<string, string>();
  const { data: { user } } = await supabase.auth.getUser();
  if (user && prereqSlugs.length > 0) {
    const statusRes = await supabase
      .from("user_topic_progress")
      .select("topic_slug, status")
      .in("topic_slug", prereqSlugs)
      .eq("user_id", user.id);
    for (const row of (statusRes.data ?? []) as unknown as { topic_slug: string; status: string }[]) {
      prereqProgress.set(row.topic_slug, row.status);
    }
  }

  const phase = phaseRes.data as unknown as RoadmapPhase;

  // Phase titles for prerequisite labels (cheap, cached content table).
  const allPhasesRes = await supabase.from("roadmap_phases").select("slug, title");
  const phaseTitle = new Map(
    ((allPhasesRes.data ?? []) as unknown as { slug: string; title: string }[]).map((p) => [p.slug, p.title] as const)
  );

  const unmet = prereqEdges
    .filter((e) => prereqProgress.get(e.requires_topic_slug) !== "completed")
    .map((e) => ({
      slug: e.requires_topic_slug,
      title: e.topics?.title ?? e.requires_topic_slug,
      phase_title: phaseTitle.get(e.topics?.phase_slug ?? "") ?? "Roadmap",
    }));

  const skills = (skillsRes.data ?? []).map((row) => {
    const r = row as unknown as { weight: number; skills: SkillRow | SkillRow[] | null };
    const s = Array.isArray(r.skills) ? r.skills[0] : r.skills;
    return s ?? { slug: "", name: "Unknown", category: "" };
  });

  return {
    topic: {
      ...topic,
      difficulty: topic.difficulty as Difficulty,
      stage_hints: (topic.stage_hints ?? {}) as TopicRow["stage_hints"],
      progress,
      prereq_total: prereqEdges.length,
      prereq_done: prereqEdges.length - unmet.length,
      unmet,
      locked: unmet.length > 0,
    },
    phase,
    resources: (resourcesRes.data ?? []) as unknown as ResourceRow[],
    skills,
  };
});
