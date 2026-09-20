import type { ResourceRow } from "@/lib/roadmap/types";

export type ResourceStatus = "saved" | "done" | "skip";

/** A resource enriched with the viewer's status and topic context. */
export type ResourceItem = ResourceRow & {
  user_status: ResourceStatus | null;
  topic_title: string;
  topic_phase_title: string;
};

export type LibraryFacets = {
  topics: { slug: string; title: string }[];
  types: string[];
  difficulties: string[];
};

export type LibraryFilters = {
  topic: string | null;
  type: string | null;
  difficulty: string | null;
  free: boolean | null; // null = any, true = free only, false = paid only
  official: boolean;
  status: "all" | "saved" | "done" | "not_started";
};
