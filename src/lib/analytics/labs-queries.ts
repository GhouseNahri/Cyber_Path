/**
 * Labs analytics (L5) — server side. Composes the caller's tracker rows and
 * the labs' skill links, then feeds the pure engine. Every read is RLS-scoped
 * to the signed-in user; missing labs tables degrade to an unavailable flag
 * (the page shows an honest setup state instead of fake zeros).
 */

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { dayKeyFor } from "@/lib/session/day";
import {
  completedTypeMix,
  labsSummary,
  monthlyCompletions,
  skillGrowth,
  topSkills,
  type LabSkillLink,
  type MonthBucket,
  type RawLabRow,
  type SkillGrowthPoint,
  type TypeMix,
} from "./labs-engine";

export type LabsSummaryView = {
  tracked: number;
  completed: number;
  active: number;
  abandoned: number;
  minutesTotal: number;
  avgMinutesPerCompleted: number;
};

export type MonthBucketView = MonthBucket;
export type TypeMixView = TypeMix;
export type SkillGrowthPointView = SkillGrowthPoint;
export type TopSkillView = { slug: string; name: string; labs: number };

export type LabsAnalytics = {
  summary: LabsSummaryView;
  /** Last 6 months of completions (oldest first). */
  monthly: MonthBucketView[];
  typeMix: TypeMixView[];
  /** Cumulative labs + distinct evidenced skills per month. */
  growth: SkillGrowthPointView[];
  top: TopSkillView[];
  /** False when the labs tables are not reachable (migration not applied). */
  available: boolean;
};

export const getLabsAnalytics = cache(async (): Promise<LabsAnalytics> => {
  const profile = await getProfile();
  if (!profile) {
    return {
      summary: { tracked: 0, completed: 0, active: 0, abandoned: 0, minutesTotal: 0, avgMinutesPerCompleted: 0 },
      monthly: [],
      typeMix: [],
      growth: [],
      top: [],
      available: false,
    };
  }

  const supabase = await createClient();
  const [rowsRes, linksRes] = await Promise.all([
    supabase
      .from("user_labs")
      .select("lab_slug, status, lab_type, minutes_spent, completed_at")
      .eq("user_id", profile.id),
    supabase.from("lab_skills").select("lab_slug, skill_slug"),
  ]);

  // Missing labs tables → section reports unavailable; no fabricated zeros.
  const available = !rowsRes.error && !linksRes.error;
  const rows = (available ? rowsRes.data ?? [] : []) as unknown as RawLabRow[];
  const links = (available ? linksRes.data ?? [] : []) as unknown as LabSkillLink[];

  const todayKey = dayKeyFor(profile.timezone);
  const summary = labsSummary(rows);
  const monthly = monthlyCompletions(rows, profile.timezone, todayKey, 6);
  const mix = completedTypeMix(rows);
  const growth = skillGrowth(rows, links, profile.timezone, todayKey, 6);
  const top = topSkills(rows, links, 5);

  // Resolve skill names for the top-skills list (public content table).
  const skillNames = new Map<string, string>();
  if (top.length > 0) {
    const { data: skills } = await supabase
      .from("skills")
      .select("slug, name")
      .in("slug", top.map((t) => t.slug));
    for (const s of (skills ?? []) as { slug: string; name: string }[]) skillNames.set(s.slug, s.name);
  }

  return {
    summary,
    monthly,
    typeMix: mix,
    growth,
    top: top.map((t) => ({ slug: t.slug, name: skillNames.get(t.slug) ?? t.slug, labs: t.labs })),
    available,
  };
});
