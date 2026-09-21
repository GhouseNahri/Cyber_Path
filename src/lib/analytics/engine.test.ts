import { describe, expect, it } from "vitest";
import {
  buildActivity,
  dailyBuckets,
  weeklyBuckets,
  weekStartOf,
  summarize,
  computeVelocity,
  quizStats,
  missedPatterns,
  revisionStats,
  weakByConfidence,
} from "./engine";

describe("buildActivity", () => {
  it("sums completed session seconds per day", () => {
    const m = buildActivity([
      { day_key: "2026-09-20", duration_seconds: 600, tasks_done: 1, tasks_skipped: 0, status: "completed" },
      { day_key: "2026-09-20", duration_seconds: 300, tasks_done: 0, tasks_skipped: 0, status: "completed" },
      { day_key: "2026-09-19", duration_seconds: 1200, tasks_done: 2, tasks_skipped: 1, status: "completed" },
    ]);
    expect(m.get("2026-09-20")).toBe(900);
    expect(m.get("2026-09-19")).toBe(1200);
  });

  it("ignores non-completed sessions and null/negative durations", () => {
    const m = buildActivity([
      { day_key: "2026-09-20", duration_seconds: 600, tasks_done: 0, tasks_skipped: 0, status: "abandoned" },
      { day_key: "2026-09-20", duration_seconds: null, tasks_done: 0, tasks_skipped: 0, status: "completed" },
      { day_key: "2026-09-20", duration_seconds: -5, tasks_done: 0, tasks_skipped: 0, status: "completed" },
    ]);
    expect(m.size).toBe(0);
  });
});

describe("buckets", () => {
  it("dailyBuckets includes zero days and is oldest-first", () => {
    const byDay = new Map([["2026-09-20", 600]]);
    const buckets = dailyBuckets(byDay, "2026-09-22", 3);
    expect(buckets.map((b) => b.key)).toEqual(["2026-09-20", "2026-09-21", "2026-09-22"]);
    expect(buckets.map((b) => b.seconds)).toEqual([600, 0, 0]);
  });

  it("weekStartOf maps to Monday", () => {
    // 2026-09-20 is a Sunday → week starts Monday 2026-09-14.
    expect(weekStartOf("2026-09-20")).toBe("2026-09-14");
    // 2026-09-21 is a Monday → its own start.
    expect(weekStartOf("2026-09-21")).toBe("2026-09-21");
  });

  it("weeklyBuckets sums by week and counts active days", () => {
    const byDay = new Map([
      ["2026-09-21", 600],
      ["2026-09-23", 300],
      ["2026-09-14", 900],
    ]);
    const weeks = weeklyBuckets(byDay, "2026-09-25", 2);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]?.startKey).toBe("2026-09-14");
    expect(weeks[0]?.seconds).toBe(900);
    expect(weeks[0]?.days).toBe(1);
    expect(weeks[1]?.startKey).toBe("2026-09-21");
    expect(weeks[1]?.seconds).toBe(900);
    expect(weeks[1]?.days).toBe(2);
  });
});

describe("summarize", () => {
  it("computes totals, active days, average and best day", () => {
    const buckets = [
      { key: "2026-09-20", seconds: 1800 },
      { key: "2026-09-21", seconds: 0 },
      { key: "2026-09-22", seconds: 600 },
    ];
    const s = summarize(buckets);
    expect(s.totalMinutes).toBe(40);
    expect(s.activeDays).toBe(2);
    expect(s.avgMinutesPerActiveDay).toBe(20);
    expect(s.bestDay).toEqual({ key: "2026-09-20", minutes: 30 });
  });

  it("handles an empty window honestly", () => {
    const s = summarize([{ key: "2026-09-20", seconds: 0 }]);
    expect(s.totalMinutes).toBe(0);
    expect(s.activeDays).toBe(0);
    expect(s.avgMinutesPerActiveDay).toBe(0);
    expect(s.bestDay).toBeNull();
  });
});

describe("computeVelocity", () => {
  it("averages per calendar day and compares with the goal", () => {
    const buckets = [
      { key: "2026-09-20", seconds: 3600 },
      { key: "2026-09-21", seconds: 0 },
      { key: "2026-09-22", seconds: 1800 },
      { key: "2026-09-23", seconds: 0 },
    ];
    const v = computeVelocity(buckets, 45);
    expect(v.avgMinutesPerDay).toBe(22.5);
    expect(v.pctOfGoal).toBe(50);
    expect(v.activeDaysPerWeek).toBe(3.5);
  });
});

describe("quizStats", () => {
  it("aggregates per topic: best, last, attempts, passed", () => {
    const stats = quizStats([
      { topic_slug: "dns", score_pct: 33, passed: false, completed_at: "2026-09-20T10:00:00Z" },
      { topic_slug: "dns", score_pct: 100, passed: true, completed_at: "2026-09-21T10:00:00Z" },
      { topic_slug: "tcp", score_pct: 67, passed: false, completed_at: "2026-09-21T11:00:00Z" },
    ]);
    expect(stats.totalAttempts).toBe(3);
    expect(stats.passRate).toBe(50);
    expect(stats.avgBestScore).toBe(84); // (100 + 67) / 2
    const dns = stats.weakest.find((s) => s.topic_slug === "dns");
    expect(dns).toMatchObject({ attempts: 2, best_pct: 100, last_pct: 100, passed: true });
    expect(stats.weakest[0]?.topic_slug).toBe("tcp");
  });

  it("is empty-safe", () => {
    const stats = quizStats([]);
    expect(stats.totalAttempts).toBe(0);
    expect(stats.passRate).toBe(0);
    expect(stats.weakest).toEqual([]);
  });
});

describe("missedPatterns", () => {
  it("counts categories and computes planned vs actual averages", () => {
    const p = missedPatterns(
      [
        { day_key: "2026-09-18", reason_category: "no_time" },
        { day_key: "2026-09-19", reason_category: "no_time" },
        { day_key: "2026-09-20", reason_category: "too_tired" },
      ],
      [
        { planned_minutes: 60, actual_minutes: 30, status: "completed" },
        { planned_minutes: 40, actual_minutes: null, status: "skipped" },
        { planned_minutes: 50, actual_minutes: 50, status: "completed" },
      ],
    );
    expect(p.total).toBe(3);
    expect(p.topReason).toEqual({ category: "no_time", count: 2 });
    expect(p.avgPlannedMinutes).toBe(50);
    expect(p.avgActualMinutes).toBe(40);
    expect(p.suggestLowerTarget).toBe(false); // 40 >= 50*0.6
  });

  it("suggests a lower target when actual is far below planned with misses", () => {
    const p = missedPatterns(
      [
        { day_key: "2026-09-18", reason_category: "no_time" },
        { day_key: "2026-09-19", reason_category: "no_time" },
        { day_key: "2026-09-20", reason_category: "no_time" },
      ],
      [
        { planned_minutes: 90, actual_minutes: 30, status: "completed" },
        { planned_minutes: 90, actual_minutes: 25, status: "completed" },
      ],
    );
    expect(p.suggestLowerTarget).toBe(true);
  });
});

describe("revisionStats", () => {
  it("buckets reviews into due, upcoming and completed", () => {
    const stats = revisionStats(
      [
        { topic_slug: "a", status: "scheduled", due_day_key: "2026-09-19" }, // overdue → due
        { topic_slug: "b", status: "scheduled", due_day_key: "2026-09-22" }, // due today → due
        { topic_slug: "c", status: "scheduled", due_day_key: "2026-09-25" }, // within 7 days → upcoming
        { topic_slug: "e", status: "scheduled", due_day_key: "2026-10-01" }, // beyond window
        { topic_slug: "d", status: "completed", due_day_key: "2026-09-10" },
      ],
      "2026-09-22",
    );
    expect(stats).toEqual({ due: 2, completed: 1, upcoming7: 1 });
  });
});

describe("weakByConfidence", () => {
  it("returns only completed topics with confidence 1-2, weakest first", () => {
    const weak = weakByConfidence([
      { topic_slug: "a", confidence: 2, status: "completed", completed_at: "2026-09-20T00:00:00Z" },
      { topic_slug: "b", confidence: 1, status: "completed", completed_at: null },
      { topic_slug: "c", confidence: 3, status: "completed", completed_at: null },
      { topic_slug: "d", confidence: 1, status: "in_progress", completed_at: null },
      { topic_slug: "e", confidence: null, status: "completed", completed_at: null },
    ]);
    expect(weak.map((w) => w.topic_slug)).toEqual(["b", "a"]);
  });
});
