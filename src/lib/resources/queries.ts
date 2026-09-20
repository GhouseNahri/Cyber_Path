import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { LibraryFacets, ResourceItem, ResourceStatus } from "./types";

type ResourceDbRow = {
  id: string;
  topic_slug: string;
  title: string;
  provider: string;
  url: string;
  type: string;
  difficulty: string | null;
  estimated_minutes: number | null;
  is_free: boolean;
  is_official: boolean;
  priority: number;
  last_verified: string | null;
  notes: string | null;
  topics: { title: string } | { title: string }[] | null;
  roadmap_phases: { title: string } | { title: string }[] | null;
};

type StatusDbRow = { resource_id: string; status: string };

/** All library resources + the viewer's statuses + computed facets. */
export const getLibrary = cache(async (): Promise<
  | { ok: true; items: ResourceItem[]; facets: LibraryFacets }
  | { ok: false; missingSchema: true }
> => {
  const supabase = await createClient();

  const res = await supabase
    .from("resources")
    .select(
      "*, topics ( title ), roadmap_phases!topics_phase_slug_fkey ( title )",
    )
    .order("priority")
    .order("title");

  // FK name guess may be wrong; fall back to the simple join set.
  let rows = (res.data ?? null) as unknown as ResourceDbRow[] | null;
  if (res.error) {
    const retry = await supabase
      .from("resources")
      .select("*, topics ( title, roadmap_phases ( title ) )")
      .order("priority")
      .order("title");
    if (retry.error) return { ok: false, missingSchema: true };
    const nested = ((retry.data ?? []) as unknown as {
      topics: { title: string; roadmap_phases: { title: string } | null } | null;
    }[]).map((r) => ({
      ...r,
      topics: r.topics ? { title: r.topics.title } : null,
      roadmap_phases: r.topics?.roadmap_phases ? { title: r.topics.roadmap_phases.title } : null,
    }));
    rows = nested as unknown as ResourceDbRow[];
  }

  if (!rows) return { ok: false, missingSchema: true };

  // Viewer statuses (owner-only via RLS; null for signed-out visitors).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let statusByResource = new Map<string, ResourceStatus>();
  if (user) {
    const statusRes = await supabase.from("user_resource_status").select("resource_id, status");
    if (!statusRes.error) {
      statusByResource = new Map(
        ((statusRes.data ?? []) as unknown as StatusDbRow[]).map((s) => [
          s.resource_id,
          s.status as ResourceStatus,
        ]),
      );
    }
  }

  const phaseTitleByTopic = new Map<string, string>();
  const topicTitleBySlug = new Map<string, string>();

  const items: ResourceItem[] = rows.map((r) => {
    const topic = Array.isArray(r.topics) ? r.topics[0] : r.topics;
    const phase = Array.isArray(r.roadmap_phases) ? r.roadmap_phases[0] : r.roadmap_phases;
    const topicTitle = topic?.title ?? r.topic_slug;
    const phaseTitle = phase?.title ?? "Roadmap";
    topicTitleBySlug.set(r.topic_slug, topicTitle);
    phaseTitleByTopic.set(r.topic_slug, phaseTitle);
    return {
      id: r.id,
      topic_slug: r.topic_slug,
      title: r.title,
      provider: r.provider,
      url: r.url,
      type: r.type as ResourceItem["type"],
      difficulty: (r.difficulty as ResourceItem["difficulty"]) ?? null,
      estimated_minutes: r.estimated_minutes,
      is_free: r.is_free,
      is_official: r.is_official,
      priority: r.priority,
      last_verified: r.last_verified,
      notes: r.notes,
      user_status: statusByResource.get(r.id) ?? null,
      topic_title: topicTitle,
      topic_phase_title: phaseTitle,
    };
  });

  const facets: LibraryFacets = {
    topics: [...topicTitleBySlug.entries()]
      .map(([slug, title]) => ({ slug, title }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    types: [...new Set(items.map((i) => i.type))].sort(),
    difficulties: [...new Set(items.map((i) => i.difficulty).filter((d) => d !== null))].map((d) => String(d)).sort(),
  };

  return { ok: true, items, facets };
});

/** Statuses for one topic's resources (topic detail page). */
export const getResourceStatusesForTopic = cache(async (topicSlug: string): Promise<Map<string, ResourceStatus>> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Map();

  const res = await supabase
    .from("user_resource_status")
    .select("resource_id, status, resources!inner ( topic_slug )")
    .eq("resources.topic_slug", topicSlug);

  const map = new Map<string, ResourceStatus>();
  if (!res.error) {
    for (const row of (res.data ?? []) as unknown as { resource_id: string; status: string }[]) {
      map.set(row.resource_id, row.status as ResourceStatus);
    }
  }
  return map;
});
