"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";

export type CareerActionResult = { ok: true; selected: boolean } | { ok: false; error: string };

const REVALIDATE = ["/", "/career", "/settings"];

/** Select or deselect a career path for the signed-in user. */
export async function toggleCareerPath(slug: string): Promise<CareerActionResult> {
  if (typeof slug !== "string" || slug.length === 0 || slug.length > 80 || !/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, error: "Unknown career path." };
  }

  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Your session expired — sign in again." };

  const supabase = await createClient();

  // The path must exist in seeded content.
  const { data: path } = await supabase
    .from("career_paths")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!path) return { ok: false, error: "Unknown career path." };

  const { data: existing } = await supabase
    .from("user_career_paths")
    .select("path_slug")
    .eq("user_id", profile.id)
    .eq("path_slug", slug)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("user_career_paths")
      .delete()
      .eq("user_id", profile.id)
      .eq("path_slug", slug);
    if (error) return { ok: false, error: "Could not update your selection. Try again in a moment." };
    for (const p of REVALIDATE) revalidatePath(p);
    return { ok: true, selected: false };
  }

  const { error } = await supabase
    .from("user_career_paths")
    .insert({ user_id: profile.id, path_slug: slug });
  if (error) return { ok: false, error: "Could not save your selection. Try again in a moment." };

  for (const p of REVALIDATE) revalidatePath(p);
  return { ok: true, selected: true };
}
