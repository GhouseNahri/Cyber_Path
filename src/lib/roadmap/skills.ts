import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SkillLevel = "not_started" | "learning" | "practicing" | "competent" | "demonstrated";

export type SkillView = {
  slug: string;
  name: string;
  category: string;
  level: SkillLevel;
  /** Weighted share of mapped topics completed (0–100). */
  theoryPct: number;
  /** Weighted share of mapped topics with practice/build stages done (0–100). */
  practicalPct: number;
  topics_mapped: number;
  topics_completed: number;
};

const LEVEL_ORDER: SkillLevel[] = ["not_started", "learning", "practicing", "competent", "demonstrated"];

export const LEVEL_LABEL: Record<SkillLevel, string> = {
  not_started: "Not started",
  learning: "Learning",
  practicing: "Practicing",
  competent: "Competent",
  demonstrated: "Demonstrated",
};

export type SkillsOverview =
  | { ok: true; skills: SkillView[] }
  | { ok: false; missingSchema: true };

export const getSkillsOverview = cache(async (): Promise<SkillsOverview> => {
  const supabase = await createClient();

  const [linksRes, skillsRes, progressRes] = await Promise.all([
    supabase.from("topic_skills").select("topic_slug, skill_slug, weight"),
    supabase.from("skills").select("slug, name, category").order("category").order("name"),
    supabase.from("user_topic_progress").select("topic_slug, status, stages, confidence"),
  ]);

  if (skillsRes.error) return { ok: false, missingSchema: true };
  if (linksRes.error || progressRes.error) return { ok: false, missingSchema: true };

  type Link = { topic_slug: string; skill_slug: string; weight: number };
  type Prog = { topic_slug: string; status: string; stages: Record<string, unknown>; confidence: number | null };

  const links = (linksRes.data ?? []) as unknown as Link[];
  const skills = (skillsRes.data ?? []) as unknown as { slug: string; name: string; category: string }[];
  const progressRows = (progressRes.data ?? []) as unknown as Prog[];

  const progByTopic = new Map(progressRows.map((p) => [p.topic_slug, p]));
  const views: SkillView[] = skills.map((skill) => {
    const mine = links.filter((l) => l.skill_slug === skill.slug);
    const totalWeight = mine.reduce((sum, l) => sum + Number(l.weight), 0);

    let doneWeight = 0;
    let practicalWeight = 0;
    let completed = 0;
    let inProgress = 0;
    let practiced = 0;
    let confident = 0;

    for (const l of mine) {
      const p = progByTopic.get(l.topic_slug);
      const stages = (p?.stages ?? {}) as Record<string, unknown>;
      const isCompleted = p?.status === "completed";
      const hasPractical = stages.practice === true || stages.build === true;

      if (isCompleted) {
        completed += 1;
        doneWeight += Number(l.weight);
      } else if (p?.status === "in_progress") {
        inProgress += 1;
      }
      if (hasPractical) practicalWeight += Number(l.weight);
      if (hasPractical) practiced += 1;
      if ((p?.confidence ?? 0) >= 4) confident += 1;
    }

    const theoryPct = totalWeight > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0;
    const practicalPct = totalWeight > 0 ? Math.round((practicalWeight / totalWeight) * 100) : 0;

    let level: SkillLevel = "not_started";
    if (completed > 0 || inProgress > 0) {
      if (completed === 0) level = "learning";
      else if (completed < 2 || practiced === 0) level = "practicing";
      else if (confident === 0) level = "competent";
      else level = "demonstrated";
    }

    return {
      slug: skill.slug,
      name: skill.name,
      category: skill.category,
      level,
      theoryPct,
      practicalPct,
      topics_mapped: mine.length,
      topics_completed: completed,
    };
  });

  views.sort((a, b) => LEVEL_ORDER.indexOf(b.level) - LEVEL_ORDER.indexOf(a.level) || b.theoryPct - a.theoryPct);
  return { ok: true, skills: views };
});
