import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Shape of public.profiles (keep in sync with supabase/migrations). */
export type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  timezone: string;
  daily_goal_minutes: number;
  preferred_study_time: string | null;
  experience_level: string | null;
  target_roles: string[];
  learning_style: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

/** Current authenticated user (or null). Cached per request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Current user's profile row, or null when missing/not signed in.
 *  Cached per request so layout + pages share one query. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
});
