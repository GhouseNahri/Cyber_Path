/**
 * Permission-aware AI context builder.
 *
 * Assembles only the context the user has explicitly allowed, from the app's
 * existing RLS-scoped queries. Returns both the prompt fragment and a
 * human-readable list of what was included (surfaced in the AI panel so the
 * user always knows what the assistant can see).
 */
import "server-only";

import { cache } from "react";
import { getProfile } from "@/lib/profile";
import { getRoadmapOverview } from "@/lib/roadmap/queries";
import { getStreakData } from "@/lib/streak/queries";
import { getRevisionQueue } from "@/lib/revision/queries";

export type AiPermissions = {
  assistant_enabled: boolean;
  use_roadmap_context: boolean;
  use_progress_context: boolean;
  use_github_context: boolean;
  history_enabled: boolean;
  response_level: "beginner" | "intermediate" | "advanced";
};

export type BuiltContext = {
  /** Context-only prompt fragment (base rules/level are added by modes). */
  contextBlock: string;
  /** Human-readable list of context categories actually included. */
  visible: string[];
};

/** Character budget for the context block — keeps requests cheap and fast. */
const CONTEXT_CHAR_BUDGET = 12_000;

/**
 * Build the system prompt from the user's permissions.
 * `topicSlug` scopes the context to one roadmap topic when provided.
 */
export const buildContext = cache(
  async (perms: AiPermissions, topicSlug?: string | null): Promise<BuiltContext> => {
    const parts: string[] = [];
    const visible: string[] = [];

    const profile = await getProfile();
    if (profile) {
      parts.push(
        `User profile: display name "${profile.display_name ?? "learner"}", daily goal ${profile.daily_goal_minutes} minutes, experience level ${profile.experience_level ?? "unspecified"}.`,
      );
    }

    if (perms.use_roadmap_context) {
      const overview = await getRoadmapOverview();
      if (overview.ok) {
        const topics = overview.phases.flatMap((p) => p.topics.map((t) => ({ phase: p.title, t })));
        const done = topics.filter((x) => x.t.progress.status === "completed");
        const inProgress = topics.filter((x) => x.t.progress.status === "in_progress");
        const next = topics.find((x) => !x.t.locked && x.t.progress.status !== "completed");

        const lines: string[] = [];
        for (const x of inProgress) lines.push(`- IN PROGRESS: ${x.t.title} (${x.t.slug}) — phase: ${x.phase}`);
        if (next) lines.push(`- NEXT UP: ${next.t.title} (${next.t.slug}) — phase: ${next.phase}, ~${next.t.estimated_minutes} min`);
        // Completed topics as a compact slug list to stay in budget.
        if (done.length > 0) lines.push(`- COMPLETED (${done.length}): ${done.map((d) => d.t.slug).join(", ")}`);

        parts.push(
          `Roadmap context (from the user's roadmap):\n${lines.join("\n")}`,
          "Use this to ground 'what should I learn next', prerequisites, and topic explanations.",
        );
        visible.push("Roadmap (phases, current topic, progress)");

        if (topicSlug) {
          const t = topics.find((x) => x.t.slug === topicSlug)?.t;
          if (t) {
            parts.push(
              `Focus topic: "${t.title}" (${t.slug}). Summary: ${t.summary} Prerequisites: ${
                t.unmet.length > 0 ? t.unmet.map((u) => u.title).join(", ") : "all met"
              }. User stages: read=${t.progress.stages.read}, practice=${t.progress.stages.practice}, test=${t.progress.stages.test}, build=${t.progress.stages.build}.`,
            );
            visible.push(`Focus topic: ${t.title}`);
          }
        }
      }
    }

    if (perms.use_progress_context) {
      const [streak, revision] = await Promise.all([getStreakData(), getRevisionQueue()]);
      if (streak.ok) {
        parts.push(
          `Progress context: current streak ${streak.streak.current} day(s), longest ${streak.streak.longest}, ${streak.streak.totalActiveDays} active day(s). Today qualified: ${streak.streak.todayQualified ? "yes" : "not yet"}.`,
        );
        visible.push("Streak & activity summary");
      }
      if (revision.ok) {
        const due = revision.due.slice(0, 8).map((r) => r.topic_title);
        if (due.length > 0) parts.push(`Topics due for spaced revision: ${due.join("; ")}.`);
        visible.push("Revision queue (due topics)");
      }
    }

    return { contextBlock: truncate(parts.join("\n\n")), visible };
  },
);

/** Last-resort guard so a huge context can never blow the request budget. */
function truncate(text: string): string {
  if (text.length <= CONTEXT_CHAR_BUDGET) return text;
  return `${text.slice(0, CONTEXT_CHAR_BUDGET)}\n[context truncated]`;
}
