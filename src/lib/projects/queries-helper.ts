import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";

export type ProjectLite = { idea_slug: string | null; status: string };

/** The viewer's projects (idea slug + status only), for evidence badges. */
export const getUserProjects = cache(async (): Promise<ProjectLite[]> => {
  const profile = await getProfile();
  if (!profile) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_projects")
    .select("idea_slug, status")
    .eq("user_id", profile.id);
  if (error) return [];
  return (data ?? []) as ProjectLite[];
});
