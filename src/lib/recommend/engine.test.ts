import { describe, expect, it } from "vitest";
import { recommend, humanizeReason, type TopicState, type RecommendInput } from "./engine";

function topic(over: Partial<TopicState> & { slug: string }): TopicState {
  return {
    title:
      over.title ??
      over.slug
        .replaceAll("-", " ")
        .split(" ")
        .map((w) => (w.length > 0 ? (w[0]?.toUpperCase() ?? w) + w.slice(1) : w))
        .join(" "),
    summary: "summary",
    estimated_minutes: 30,
    status: "not_started",
    locked: false,
    stages_done: 0,
    phase_title: "Phase",
    confidence: null,
    ...over,
  };
}

const baseInput: RecommendInput = {
  topics: [],
  dueRevisions: [],
  weakQuizTopics: [],
  lowConfidenceTopics: [],
  selectedCareerTopics: [],
  missed: { total: 0, suggestLowerTarget: false, topReasonLabel: null },
  goalMinutes: 45,
  avgActualMinutes: null,
};

const tA = () => topic({ slug: "topic-a", phase_title: "P1" });
const tB = () => topic({ slug: "topic-b", phase_title: "P1" });
const tC = () => topic({ slug: "topic-c", phase_title: "P2" });

describe("recommend", () => {
  it("ranks due revisions first, urgency-scaled by overdue days", () => {
    const recs = recommend({
      ...baseInput,
      topics: [tA()],
      dueRevisions: [
        { topic_slug: "topic-a", title: "Topic A", overdue_days: 0 },
        { topic_slug: "topic-b", title: "Topic B", overdue_days: 5 },
      ],
    });
    expect(recs[0]?.kind).toBe("due_revision");
    expect(recs[0]?.title).toContain("Topic B");
    expect(recs[0]?.score).toBe(120 + 20); // capped at +20
    expect(recs[1]?.score).toBe(120);
    expect(recs[0]?.why).toContain("5 days overdue");
  });

  it("explains a phase dependency in the why-line", () => {
    const recs = recommend({
      ...baseInput,
      topics: [tA(), tB()],
    });
    const a = recs.find((r) => r.title === "Start: Topic A");
    expect(a?.why).toContain("Topic B depends on it");
    expect(a?.kind).toBe("start_topic");
  });

  it("ranks career-aligned topics above plain start topics with path evidence", () => {
    const recs = recommend({
      ...baseInput,
      topics: [tA(), tC()],
      selectedCareerTopics: ["topic-c"],
    });
    expect(recs[0]?.kind).toBe("career_next");
    expect(recs[0]?.title).toBe("Topic C");
    expect(recs[0]?.score).toBe(100);
    // No duplicate start_topic row for the same slug.
    expect(recs.filter((r) => r.title === "Topic C")).toHaveLength(1);
  });

  it("prefers in-progress over fresh topics and counts stages in the why", () => {
    const recs = recommend({
      ...baseInput,
      topics: [tA(), topic({ slug: "topic-b", status: "in_progress", stages_done: 2 })],
    });
    expect(recs[0]?.kind).toBe("continue_topic");
    expect(recs[0]?.why).toContain("2/4 stages done");
  });

  it("boosts an in-progress topic that is also career-aligned", () => {
    const recs = recommend({
      ...baseInput,
      topics: [topic({ slug: "topic-a", status: "in_progress", stages_done: 1 })],
      selectedCareerTopics: ["topic-a"],
    });
    expect(recs[0]?.kind).toBe("career_next");
    expect(recs[0]?.score).toBe(110);
    expect(recs.filter((r) => r.kind === "continue_topic")).toHaveLength(0);
  });

  it("emits low-confidence review only for completed topics", () => {
    const recs = recommend({
      ...baseInput,
      topics: [topic({ slug: "topic-a", status: "completed", confidence: 1 })],
      lowConfidenceTopics: [{ topic_slug: "topic-a", confidence: 1 }],
    });
    expect(recs[0]?.kind).toBe("low_confidence_review");
    expect(recs[0]?.why).toContain("rated your confidence 1/5");
    // 60 + (3 − 1) × 5
    expect(recs[0]?.score).toBe(70);
  });

  it("skips low-confidence entries whose topic is missing or not completed", () => {
    const recs = recommend({
      ...baseInput,
      topics: [tA()],
      lowConfidenceTopics: [
        { topic_slug: "topic-a", confidence: 2 },
        { topic_slug: "ghost", confidence: 1 },
      ],
    });
    // topic-a is still fresh so a start_topic rec is fine — but no
    // low-confidence review may appear for it or for the ghost.
    expect(recs.filter((r) => r.kind === "low_confidence_review")).toHaveLength(0);
    expect(recs.filter((r) => r.title === "Review: ghost")).toHaveLength(0);
  });

  it("emits weak-quiz retest below the pass line with evidence", () => {
    const recs = recommend({
      ...baseInput,
      topics: [tA()],
      weakQuizTopics: [{ topic_slug: "topic-a", best_pct: 40, attempts: 2 }],
    });
    const retest = recs.find((r) => r.kind === "weak_quiz_retest");
    expect(retest?.why).toContain("40%");
    expect(retest?.score).toBe(95 - 40);
    expect(retest?.href).toContain("#test");
  });

  it("recommends a smaller target only with 3+ misses and the flag set", () => {
    const small = recommend({
      ...baseInput,
      goalMinutes: 60,
      missed: { total: 3, suggestLowerTarget: true, topReasonLabel: "No time" },
    });
    expect(small).toHaveLength(1);
    expect(small[0]?.kind).toBe("smaller_target");
    expect(small[0]?.title).toBe("Try a 40-minute daily target");
    expect(small[0]?.why).toContain("No time");
    expect(small[0]?.href).toBe("/settings");

    const quiet = recommend({
      ...baseInput,
      goalMinutes: 60,
      missed: { total: 2, suggestLowerTarget: true, topReasonLabel: null },
    });
    expect(quiet).toHaveLength(0);
  });

  it("never emits a locked topic", () => {
    const recs = recommend({
      ...baseInput,
      topics: [topic({ slug: "topic-a", locked: true }), tB()],
    });
    expect(recs.map((r) => r.title)).not.toContain("Start: topic a");
    expect(recs[0]?.title).toBe("Start: Topic B");
  });

  it("orders the full mix deterministically", () => {
    const recs = recommend({
      ...baseInput,
      topics: [tA(), topic({ slug: "topic-b", status: "in_progress", stages_done: 3 }), tC()],
      selectedCareerTopics: ["topic-c"],
      dueRevisions: [{ topic_slug: "topic-a", title: "Topic A", overdue_days: 2 }],
      weakQuizTopics: [{ topic_slug: "topic-c", best_pct: 50, attempts: 1 }],
    });
    expect(recs.map((r) => r.kind)).toEqual([
      "due_revision", // 128
      "career_next", // 100
      "continue_topic", // 96
      "start_topic", // 70
      "weak_quiz_retest", // 45
    ]);
  });

  it("returns an empty list when there is nothing to act on", () => {
    expect(recommend(baseInput)).toEqual([]);
  });
});

describe("humanizeReason", () => {
  it("converts snake_case labels", () => {
    expect(humanizeReason("no_time")).toBe("No Time");
    expect(humanizeReason(null)).toBeNull();
  });
});
