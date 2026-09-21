import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getSkillsOverview } from "@/lib/roadmap/skills";
import { getRoadmapOverview } from "@/lib/roadmap/queries";
import { pathCoverage, matchesTargetRole, type PathContent, type PathCoverage } from "./engine";

export type CareerPathView = PathContent & {
  coverage: PathCoverage;
  selected: boolean;
  matchesTarget: boolean;
};

export type CareerData =
  | { ok: true; paths: CareerPathView[] }
  | { ok: false; missingSchema: true };

function parseCerts(raw: unknown): { name: string; note: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      const o = c as Record<string, unknown>;
      return { name: String(o?.name ?? ""), note: String(o?.note ?? "") };
    })
    .filter((c) => c.name.length > 0);
}

function parsePath(raw: Record<string, unknown>): PathContent | null {
  const slug = raw.slug;
  if (typeof slug !== "string") return null;
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    slug,
    name: String(raw.name ?? slug),
    nice_category: typeof raw.nice_category === "string" ? raw.nice_category : null,
    tagline: String(raw.tagline ?? ""),
    description: String(raw.description ?? ""),
    responsibilities: arr(raw.responsibilities),
    foundational_skills: arr(raw.foundational_skills),
    recommended_topics: arr(raw.recommended_topics),
    project_ideas: arr(raw.project_ideas),
    certifications: parseCerts(raw.certifications),
    entry_guidance: String(raw.entry_guidance ?? ""),
  };
}

export const getCareerData = cache(async (): Promise<CareerData> => {
  const profile = await getProfile();
  if (!profile) return { ok: false, missingSchema: true };

  const supabase = await createClient();
  const [pathsRes, selectedRes, skillsRes, roadmapRes, projectsRes] = await Promise.all([
    supabase.from("career_paths").select("*").order("order_index"),
    supabase.from("user_career_paths").select("path_slug").eq("user_id", profile.id),
    getSkillsOverview(),
    getRoadmapOverview(),
    supabase.from("user_projects").select("idea_slug, status").eq("user_id", profile.id),
  ]);

  if (pathsRes.error || selectedRes.error || projectsRes.error) {
    return { ok: false, missingSchema: true };
  }
  if (skillsRes.ok === false || roadmapRes.ok === false) {
    return { ok: false, missingSchema: true };
  }

  const paths = ((pathsRes.data ?? []) as Record<string, unknown>[])
    .map(parsePath)
    .filter((p): p is PathContent => p !== null);
  const selected = new Set(
    ((selectedRes.data ?? []) as { path_slug: string }[]).map((r) => r.path_slug),
  );

  const skills = skillsRes.skills.map((s) => ({ slug: s.slug, level: s.level }));
  const topics = roadmapRes.phases.flatMap((ph) =>
    ph.topics.map((t) => ({ topic_slug: t.slug, status: t.progress.status })),
  );
  const projects = (projectsRes.data ?? []) as { idea_slug: string | null; status: string }[];

  const targetRoles = profile.target_roles ?? [];
  const views: CareerPathView[] = paths.map((p) => ({
    ...p,
    coverage: pathCoverage(p, skills, topics, projects),
    selected: selected.has(p.slug),
    matchesTarget: matchesTargetRole(p, targetRoles),
  }));

  return { ok: true, paths: views };
});

/** Single path detail (reuses the same computation). */
export const getCareerPathBySlug = cache(async (slug: string): Promise<CareerPathView | null> => {
  const data = await getCareerData();
  if (!data.ok) return null;
  return data.paths.find((p) => p.slug === slug) ?? null;
});
