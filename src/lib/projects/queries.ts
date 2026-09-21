import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { milestonePct, parseStatus, validIndexes, type ProjectStatus } from "./engine";

export type IdeaRow = {
  slug: string;
  title: string;
  summary: string;
  why_build_it: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimated_hours: number | null;
  skills: string[];
  requirements: string[];
  milestones: string[];
  authorized_use: string;
};

export type UserProject = {
  id: string;
  idea_slug: string | null;
  title: string;
  status: ProjectStatus;
  github_url: string | null;
  demo_url: string | null;
  notes: string | null;
  milestones: string[];
  milestones_done: number[];
  progressPct: number;
  started_at: string | null;
  completed_at: string | null;
  published_at: string | null;
};

export type ProjectsData =
  | { ok: true; ideas: IdeaRow[]; mine: UserProject[] }
  | { ok: false; missingSchema: true };

function parseIdea(raw: Record<string, unknown>): IdeaRow | null {
  const slug = raw.slug;
  if (typeof slug !== "string") return null;
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const diff = raw.difficulty;
  return {
    slug,
    title: String(raw.title ?? slug),
    summary: String(raw.summary ?? ""),
    why_build_it: String(raw.why_build_it ?? ""),
    difficulty: diff === "intermediate" || diff === "advanced" ? diff : "beginner",
    estimated_hours: typeof raw.estimated_hours === "number" ? raw.estimated_hours : null,
    skills: arr(raw.skills),
    requirements: arr(raw.requirements),
    milestones: arr(raw.milestones),
    authorized_use: String(raw.authorized_use ?? ""),
  };
}

/** Catalog + the viewer's tracker rows, merged with their idea's milestones. */
export const getProjectsData = cache(async (): Promise<ProjectsData> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, missingSchema: true };

  const [ideasRes, mineRes] = await Promise.all([
    supabase.from("project_ideas").select("*").order("order_index"),
    supabase.from("user_projects").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
  ]);

  if (ideasRes.error || mineRes.error) return { ok: false, missingSchema: true };

  const ideas = ((ideasRes.data ?? []) as Record<string, unknown>[])
    .map(parseIdea)
    .filter((i): i is IdeaRow => i !== null);
  const ideaBySlug = new Map(ideas.map((i) => [i.slug, i]));

  const mine: UserProject[] = ((mineRes.data ?? []) as Record<string, unknown>[]).map((r) => {
    const idea = typeof r.idea_slug === "string" ? ideaBySlug.get(r.idea_slug) : undefined;
    const milestones = idea?.milestones ?? [];
    return {
      id: String(r.id ?? ""),
      idea_slug: idea ? idea.slug : null,
      title: String(r.title ?? "Untitled project"),
      status: parseStatus(r.status),
      github_url: typeof r.github_url === "string" ? r.github_url : null,
      demo_url: typeof r.demo_url === "string" ? r.demo_url : null,
      notes: typeof r.notes === "string" ? r.notes : null,
      milestones,
      milestones_done: validIndexes(r.milestones_done, milestones.length),
      progressPct: milestonePct(milestones.length, r.milestones_done),
      started_at: typeof r.started_at === "string" ? r.started_at : null,
      completed_at: typeof r.completed_at === "string" ? r.completed_at : null,
      published_at: typeof r.published_at === "string" ? r.published_at : null,
    };
  });

  return { ok: true, ideas, mine };
});
