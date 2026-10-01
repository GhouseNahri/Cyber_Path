import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/profile";
import {
  filterLabs,
  labStats,
  parseCriteria,
  parseHints,
  parseLabDifficulty,
  parseLabStatus,
  parseLabType,
  type CompletionCriteria,
  type LabDifficulty,
  type LabFilters,
  type LabHint,
  type LabStats,
  type LabStatus,
  type LabType,
} from "./engine";

export type CatalogLab = {
  slug: string;
  title: string;
  summary: string;
  objective: string;
  category_slug: string;
  lab_type: LabType;
  difficulty: LabDifficulty;
  estimated_minutes: number;
  provider: string;
  external_url: string | null;
  instructions: string;
  learning_objectives: string[];
  completion: CompletionCriteria;
  hints: LabHint[];
  ticks_practice_stage: boolean;
  topics: string[];
  skills: { slug: string; weight: number }[];
  /** The viewer's tracker row for this lab, if any. */
  mine: {
    id: string;
    status: LabStatus;
    tasks_done: number[];
    notes: string;
    minutes_spent: number;
    attempts_count: number;
    times_revisited: number;
    hints_revealed: number;
    started_at: string | null;
    completed_at: string | null;
  } | null;
};

export type CustomLab = {
  id: string;
  title: string;
  lab_type: LabType;
  provider: string;
  external_url: string | null;
  category_slug: string | null;
  status: LabStatus;
  notes: string;
  minutes_spent: number;
  attempts_count: number;
  started_at: string | null;
  completed_at: string | null;
};

export type LabCategory = { slug: string; name: string; description: string };

export type LabsData =
  | {
      ok: true;
      categories: LabCategory[];
      catalog: CatalogLab[];
      custom: CustomLab[];
      stats: LabStats;
    }
  | { ok: false; missingSchema: true };

/** Defensive row → number[] for jsonb task-index arrays. */
function parseTaskIndexes(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0);
}

export const getLabsData = cache(async (): Promise<LabsData> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, missingSchema: true };

  const [labsRes, catsRes, topicsRes, skillsRes, mineRes] = await Promise.all([
    supabase.from("labs").select("*").eq("is_published", true).order("title"),
    supabase.from("lab_categories").select("slug, name, description").order("order_index"),
    supabase.from("lab_topics").select("lab_slug, topic_slug"),
    supabase.from("lab_skills").select("lab_slug, skill_slug, weight"),
    supabase.from("user_labs").select("*").eq("user_id", user.id),
  ]);

  if (labsRes.error || catsRes.error) return { ok: false, missingSchema: true };
  // User tables missing (migration not applied) degrades to catalog-only.
  const mineRows = mineRes.error ? [] : ((mineRes.data ?? []) as Record<string, unknown>[]);

  const topicsByLab = new Map<string, string[]>();
  for (const r of (topicsRes.data ?? []) as unknown as { lab_slug: string; topic_slug: string }[]) {
    const list = topicsByLab.get(r.lab_slug) ?? [];
    list.push(r.topic_slug);
    topicsByLab.set(r.lab_slug, list);
  }

  const skillsByLab = new Map<string, { slug: string; weight: number }[]>();
  for (const r of (skillsRes.data ?? []) as unknown as { lab_slug: string; skill_slug: string; weight: number }[]) {
    const list = skillsByLab.get(r.lab_slug) ?? [];
    list.push({ slug: r.skill_slug, weight: Number(r.weight) });
    skillsByLab.set(r.lab_slug, list);
  }

  const mineBySlug = new Map<string, Record<string, unknown>>();
  for (const row of mineRows) {
    if (typeof row.lab_slug === "string") mineBySlug.set(row.lab_slug, row);
  }

  const catalog: CatalogLab[] = ((labsRes.data ?? []) as Record<string, unknown>[]).flatMap((raw) => {
    const slug = raw.slug;
    if (typeof slug !== "string") return [];
    const m = mineBySlug.get(slug);
    return [{
      slug,
      title: String(raw.title ?? slug),
      summary: String(raw.summary ?? ""),
      objective: String(raw.objective ?? ""),
      category_slug: String(raw.category_slug ?? ""),
      lab_type: parseLabType(raw.lab_type),
      difficulty: parseLabDifficulty(raw.difficulty),
      estimated_minutes: typeof raw.estimated_minutes === "number" ? raw.estimated_minutes : 60,
      provider: String(raw.provider ?? ""),
      external_url: typeof raw.external_url === "string" ? raw.external_url : null,
      instructions: String(raw.instructions ?? ""),
      learning_objectives: Array.isArray(raw.learning_objectives)
        ? raw.learning_objectives.filter((s): s is string => typeof s === "string")
        : [],
      completion: parseCriteria(raw.completion_criteria),
      hints: parseHints(raw.hints),
      ticks_practice_stage: raw.ticks_practice_stage === true,
      topics: topicsByLab.get(slug) ?? [],
      skills: skillsByLab.get(slug) ?? [],
      mine: m
        ? {
            id: String(m.id),
            status: parseLabStatus(m.status),
            tasks_done: parseTaskIndexes(m.tasks_done),
            notes: String(m.notes ?? ""),
            minutes_spent: typeof m.minutes_spent === "number" ? m.minutes_spent : 0,
            attempts_count: typeof m.attempts_count === "number" ? m.attempts_count : 0,
            times_revisited: typeof m.times_revisited === "number" ? m.times_revisited : 0,
            hints_revealed: typeof m.hints_revealed === "number" ? m.hints_revealed : 0,
            started_at: typeof m.started_at === "string" ? m.started_at : null,
            completed_at: typeof m.completed_at === "string" ? m.completed_at : null,
          }
        : null,
    }];
  });

  const custom: CustomLab[] = mineRows
    .filter((r) => r.lab_slug === null && typeof r.title === "string")
    .map((r) => ({
      id: String(r.id),
      title: String(r.title),
      lab_type: parseLabType(r.lab_type),
      provider: String(r.provider ?? ""),
      external_url: typeof r.external_url === "string" ? r.external_url : null,
      category_slug: typeof r.category_slug === "string" ? r.category_slug : null,
      status: parseLabStatus(r.status),
      notes: String(r.notes ?? ""),
      minutes_spent: typeof r.minutes_spent === "number" ? r.minutes_spent : 0,
      attempts_count: typeof r.attempts_count === "number" ? r.attempts_count : 0,
      started_at: typeof r.started_at === "string" ? r.started_at : null,
      completed_at: typeof r.completed_at === "string" ? r.completed_at : null,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const stats = labStats([
    ...catalog.filter((l) => l.mine).map((l) => ({
      status: l.mine!.status,
      minutes_spent: l.mine!.minutes_spent,
      lab_type: l.lab_type,
    })),
    ...custom.map((c) => ({ status: c.status, minutes_spent: c.minutes_spent, lab_type: c.lab_type })),
  ]);

  const categories = ((catsRes.data ?? []) as Record<string, unknown>[]).map((c) => ({
    slug: String(c.slug ?? ""),
    name: String(c.name ?? c.slug ?? ""),
    description: String(c.description ?? ""),
  }));

  return { ok: true, categories, catalog, custom, stats };
});

/** Server-side pre-filtered view for the dashboard (status/type/category/difficulty). */
export function applyFilters(catalog: CatalogLab[], f: LabFilters): CatalogLab[] {
  return filterLabs(
    catalog.map((l) => ({
      slug: l.slug,
      lab_type: l.lab_type,
      category_slug: l.category_slug,
      difficulty: l.difficulty,
      status: l.mine?.status ?? null,
    })),
    f,
  )
    .map((f2) => catalog.find((l) => l.slug === f2.slug))
    .filter((l): l is CatalogLab => l !== undefined);
}

export type LabDetail = {
  lab: CatalogLab;
  tasks: { id: string; position: number; title: string; detail: string | null }[];
  /** Names for the lab's mapped skills (evidence UI). */
  skillOptions: { slug: string; name: string }[];
  /** The user's saved evidence row for this lab, if any (L4/L5). */
  evidence: { accepted_skills: string[]; body: string; visibility: string } | null;
  /** The user's saved reflection, if any (L4). */
  reflection: { did: string; learned: string; confused: string; differently: string } | null;
};

export type LabDetailData =
  | { ok: true; detail: LabDetail }
  | { ok: false; missingSchema: true }
  | { ok: false; notFound: true };

export const getLabDetail = cache(async (slug: string): Promise<LabDetailData> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, missingSchema: true };

  const [labRes, tasksRes, topicsRes, skillsRes, namesRes] = await Promise.all([
    supabase.from("labs").select("*").eq("slug", slug).eq("is_published", true).maybeSingle(),
    supabase.from("lab_tasks").select("id, position, title, detail").eq("lab_slug", slug).order("position"),
    supabase.from("lab_topics").select("topic_slug").eq("lab_slug", slug),
    supabase.from("lab_skills").select("skill_slug, weight").eq("lab_slug", slug),
    supabase.from("skills").select("slug, name"),
  ]);

  if (labRes.error) return { ok: false, missingSchema: true };
  const raw = labRes.data as unknown as Record<string, unknown> | null;
  if (!raw) return { ok: false, notFound: true };

  const { data: mineData } = await supabase
    .from("user_labs")
    .select("*")
    .eq("user_id", user.id)
    .eq("lab_slug", slug)
    .maybeSingle();
  const m = (mineData ?? null) as Record<string, unknown> | null;

  // Evidence row (only exists after completion + save).
  let ev: { accepted_skills: unknown; body: string; visibility: string } | null = null;
  if (m && typeof m.id === "string") {
    const { data } = await supabase
      .from("lab_evidence")
      .select("accepted_skills, body, visibility")
      .eq("user_id", user.id)
      .eq("user_lab_id", m.id)
      .maybeSingle();
    ev = (data ?? null) as { accepted_skills: unknown; body: string; visibility: string } | null;
  }

  const lab: CatalogLab = {
    slug: String(raw.slug),
    title: String(raw.title ?? slug),
    summary: String(raw.summary ?? ""),
    objective: String(raw.objective ?? ""),
    category_slug: String(raw.category_slug ?? ""),
    lab_type: parseLabType(raw.lab_type),
    difficulty: parseLabDifficulty(raw.difficulty),
    estimated_minutes: typeof raw.estimated_minutes === "number" ? raw.estimated_minutes : 60,
    provider: String(raw.provider ?? ""),
    external_url: typeof raw.external_url === "string" ? raw.external_url : null,
    instructions: String(raw.instructions ?? ""),
    learning_objectives: Array.isArray(raw.learning_objectives)
      ? raw.learning_objectives.filter((s): s is string => typeof s === "string")
      : [],
    completion: parseCriteria(raw.completion_criteria),
    hints: parseHints(raw.hints),
    ticks_practice_stage: raw.ticks_practice_stage === true,
    topics: ((topicsRes.data ?? []) as unknown as { topic_slug: string }[]).map((t) => t.topic_slug),
    skills: ((skillsRes.data ?? []) as unknown as { skill_slug: string; weight: number }[]).map((s) => ({
      slug: s.skill_slug,
      weight: Number(s.weight),
    })),
    mine: m
      ? {
          id: String(m.id),
          status: parseLabStatus(m.status),
          tasks_done: parseTaskIndexes(m.tasks_done),
          notes: String(m.notes ?? ""),
          minutes_spent: typeof m.minutes_spent === "number" ? m.minutes_spent : 0,
          attempts_count: typeof m.attempts_count === "number" ? m.attempts_count : 0,
          times_revisited: typeof m.times_revisited === "number" ? m.times_revisited : 0,
          hints_revealed: typeof m.hints_revealed === "number" ? m.hints_revealed : 0,
          started_at: typeof m.started_at === "string" ? m.started_at : null,
          completed_at: typeof m.completed_at === "string" ? m.completed_at : null,
        }
      : null,
  };

  const skillNames = new Map(
    ((namesRes.data ?? []) as { slug: string; name: string }[]).map((s) => [s.slug, s.name]),
  );

  return {
    ok: true,
    detail: {
      lab,
      tasks: ((tasksRes.data ?? []) as unknown as Record<string, unknown>[]).map((t) => ({
        id: String(t.id),
        position: typeof t.position === "number" ? t.position : 0,
        title: String(t.title ?? ""),
        detail: typeof t.detail === "string" ? t.detail : null,
      })),
      skillOptions: lab.skills.map((s) => ({ slug: s.slug, name: skillNames.get(s.slug) ?? s.slug })),
      evidence: ev
        ? {
            accepted_skills: Array.isArray(ev.accepted_skills)
              ? ev.accepted_skills.filter((s): s is string => typeof s === "string")
              : [],
            body: typeof ev.body === "string" ? ev.body : "",
            visibility: ev.visibility === "portfolio" ? "portfolio" : "private",
          }
        : null,
      reflection:
        m && typeof m.reflection === "object" && m.reflection !== null
          ? (m.reflection as { did: string; learned: string; confused: string; differently: string })
          : null,
    },
  };
});
