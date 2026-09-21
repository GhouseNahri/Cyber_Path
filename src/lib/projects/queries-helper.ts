import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";

export type ProjectLite = {
  id: string;
  title: string;
  idea_slug: string | null;
  status: string;
  github_url: string | null;
};

/** The viewer's projects (lite shape), for evidence badges and linking. */
export const getUserProjects = cache(async (): Promise<ProjectLite[]> => {
  const profile = await getProfile();
  if (!profile) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_projects")
    .select("id, title, idea_slug, status, github_url")
    .eq("user_id", profile.id);
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id ?? ""),
    title: String(r.title ?? "Untitled project"),
    idea_slug: typeof r.idea_slug === "string" ? r.idea_slug : null,
    status: String(r.status ?? "idea"),
    github_url: typeof r.github_url === "string" ? r.github_url : null,
  }));
});
