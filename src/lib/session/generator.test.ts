import { describe, expect, it } from "vitest";
import { generateMission } from "./generator";
import type { TopicView } from "@/lib/roadmap/types";

function topic(overrides: Partial<TopicView> & { slug: string }): TopicView {
  const base = {
    slug: overrides.slug,
    phase_slug: "test-phase",
    order_index: 1,
    title: overrides.slug.replace(/-/g, " "),
    summary: "s",
    why_it_matters: "w",
    difficulty: "beginner" as const,
    estimated_minutes: 60,
    stage_hints: {},
    is_optional: false,
    progress: {
      status: "not_started" as const,
      stages: { read: false, practice: false, test: false, build: false },
      confidence: null,
      last_practiced_at: null,
      completed_at: null,
    },
    locked: false,
    unmet: [],
    prereq_total: 0,
    prereq_done: 0,
  };
  return { ...base, ...overrides } as TopicView;
}

describe("generateMission", () => {
  it("picks in-progress topics before fresh ones", () => {
    const tasks = generateMission({
      goalMinutes: 45,
      timezone: "UTC",
      topics: [topic({ slug: "fresh-a" }), topic({ slug: "wip-b", progress: { status: "in_progress", stages: { read: true, practice: false, test: false, build: false }, confidence: null, last_practiced_at: null, completed_at: null } })],
    });
    expect(tasks[0]?.topic_slug).toBe("wip-b");
    expect(tasks[0]?.kind).toBe("practice");
  });

  it("sizes tasks to the daily goal", () => {
    const tasks = generateMission({ goalMinutes: 45, timezone: "UTC", topics: [topic({ slug: "a" }), topic({ slug: "b" })] });
    expect(tasks).toHaveLength(2);
    const total = tasks.reduce((n, t) => n + t.planned_minutes, 0);
    expect(total).toBe(45);
  });

  it("caps at 3 tasks and one task per topic", () => {
    const tasks = generateMission({
      goalMinutes: 90,
      timezone: "UTC",
      topics: [topic({ slug: "a" }), topic({ slug: "b" }), topic({ slug: "c" }), topic({ slug: "d" })],
    });
    expect(tasks).toHaveLength(3);
    expect(new Set(tasks.map((t) => t.topic_slug)).size).toBe(tasks.length);
  });

  it("creates review tasks from the due-revision queue, ranked first", () => {
    const tasks = generateMission({
      goalMinutes: 30,
      timezone: "UTC",
      topics: [
        topic({ slug: "wip" }),
        topic({ slug: "done-weak", progress: { status: "completed", stages: { read: true, practice: true, test: true, build: true }, confidence: 2, last_practiced_at: null, completed_at: "2026-09-01" } }),
      ],
      dueRevisionSlugs: new Set(["done-weak"]),
    });
    expect(tasks[0]?.topic_slug).toBe("done-weak");
    expect(tasks[0]?.kind).toBe("review");
    expect(tasks[1]?.topic_slug).toBe("wip");
  });

  it("caps revisions at 2 per mission", () => {
    const tasks = generateMission({
      goalMinutes: 60,
      timezone: "UTC",
      topics: [
        topic({ slug: "r1", progress: { status: "completed", stages: { read: true, practice: true, test: true, build: true }, confidence: 5, last_practiced_at: null, completed_at: "2026-09-01" } }),
        topic({ slug: "r2", progress: { status: "completed", stages: { read: true, practice: true, test: true, build: true }, confidence: 5, last_practiced_at: null, completed_at: "2026-09-01" } }),
        topic({ slug: "r3", progress: { status: "completed", stages: { read: true, practice: true, test: true, build: true }, confidence: 5, last_practiced_at: null, completed_at: "2026-09-01" } }),
      ],
      dueRevisionSlugs: new Set(["r1", "r2", "r3"]),
    });
    expect(tasks.filter((t) => t.kind === "review")).toHaveLength(2);
  });

  it("never schedules reviews for topics outside the due set", () => {
    const tasks = generateMission({
      goalMinutes: 45,
      timezone: "UTC",
      topics: [
        topic({ slug: "done-strong", progress: { status: "completed", stages: { read: true, practice: true, test: true, build: true }, confidence: 5, last_practiced_at: null, completed_at: "2026-09-01" } }),
      ],
    });
    expect(tasks).toHaveLength(0);
  });

  it("ignores locked and completed (non-review) topics", () => {
    const tasks = generateMission({
      goalMinutes: 45,
      timezone: "UTC",
      topics: [
        topic({ slug: "locked", locked: true }),
        topic({ slug: "done-strong", progress: { status: "completed", stages: { read: true, practice: true, test: true, build: true }, confidence: 5, last_practiced_at: null, completed_at: "2026-09-01" } }),
      ],
    });
    expect(tasks).toHaveLength(0);
  });

  it("skips the first candidate when yesterday was identical (variety)", () => {
    const topics = [topic({ slug: "a" }), topic({ slug: "b" })];
    const same = generateMission({ goalMinutes: 45, timezone: "UTC", topics });
    const ySig = same.map((t) => `${t.topic_slug}:learn`);
    const again = generateMission({ goalMinutes: 45, timezone: "UTC", topics, yesterdayTaskSignatures: ySig });
    // With variety applied, "a" should not lead anymore.
    expect(again[0]?.topic_slug).not.toBe(same[0]?.topic_slug);
  });

  it("links a resource to learn tasks when provided", () => {
    const tasks = generateMission({
      goalMinutes: 30,
      timezone: "UTC",
      topics: [topic({ slug: "a" })],
      resources: [{ topic_slug: "a", id: "res-1", type: "documentation", priority: 1 }],
    });
    expect(tasks[0]?.resource_id).toBe("res-1");
  });
});
