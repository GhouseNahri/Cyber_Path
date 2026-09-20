import { describe, expect, it } from "vitest";
import { computeStreak, isQualifiedDay, nextMilestone, reachedMilestone, DEFAULT_STREAK_CONFIG } from "./engine";
import type { DayActivity } from "./engine";

const CFG = DEFAULT_STREAK_CONFIG; // min 900s (15 min) or 1 task

function day(key: string, seconds = 0, tasks_done = 0): DayActivity {
  return { day_key: key, seconds, tasks_done };
}

describe("isQualifiedDay", () => {
  it("qualifies with at least one completed task", () => {
    expect(isQualifiedDay(day("2026-09-20", 0, 1), CFG)).toBe(true);
  });

  it("qualifies with 15+ minutes of study even without a task", () => {
    expect(isQualifiedDay(day("2026-09-20", 900, 0), CFG)).toBe(true);
  });

  it("does NOT qualify for just opening the app or a tiny timer run", () => {
    expect(isQualifiedDay(day("2026-09-20", 0, 0), CFG)).toBe(false);
    expect(isQualifiedDay(day("2026-09-20", 60, 0), CFG)).toBe(false);
    expect(isQualifiedDay(day("2026-09-20", 899, 0), CFG)).toBe(false);
  });
});

describe("computeStreak", () => {
  it("counts consecutive qualified days", () => {
    const s = computeStreak(
      [day("2026-09-18", 0, 2), day("2026-09-19", 1200, 0), day("2026-09-20", 0, 1)],
      "2026-09-20",
    );
    expect(s.current).toBe(3);
    expect(s.longest).toBe(3);
    expect(s.totalActiveDays).toBe(3);
    expect(s.todayQualified).toBe(true);
    expect(s.atRiskToday).toBe(false);
  });

  it("keeps the run alive at-risk when today isn't done yet", () => {
    const s = computeStreak(
      [day("2026-09-18", 0, 1), day("2026-09-19", 0, 1)],
      "2026-09-20",
    );
    expect(s.current).toBe(2);
    expect(s.todayQualified).toBe(false);
    expect(s.atRiskToday).toBe(true);
  });

  it("a single missed day breaks the run", () => {
    const s = computeStreak(
      [day("2026-09-16", 0, 1), day("2026-09-17", 0, 0), day("2026-09-18", 0, 1), day("2026-09-19", 0, 1)],
      "2026-09-19",
    );
    expect(s.current).toBe(2);
    expect(s.longest).toBe(2);
  });

  it("longest exceeds current when an earlier run was bigger", () => {
    const s = computeStreak(
      [
        day("2026-09-01", 0, 1), day("2026-09-02", 0, 1), day("2026-09-03", 0, 1),
        day("2026-09-04", 0, 0),
        day("2026-09-18", 0, 1), day("2026-09-19", 0, 1),
      ],
      "2026-09-19",
    );
    expect(s.current).toBe(2);
    expect(s.longest).toBe(3);
    expect(s.totalActiveDays).toBe(5);
  });

  it("aggregates duplicate rows for the same day (multiple sessions)", () => {
    const s = computeStreak(
      [day("2026-09-19", 500, 0), day("2026-09-19", 500, 0), day("2026-09-19", 0, 0)],
      "2026-09-20",
    );
    // 1000s total >= 900 → qualified, run alive at-risk.
    expect(s.current).toBe(1);
    expect(s.atRiskToday).toBe(true);
  });

  it("unqualified today with no prior run stays at zero", () => {
    const s = computeStreak([day("2026-09-19", 10, 0)], "2026-09-20");
    expect(s.current).toBe(0);
    expect(s.atRiskToday).toBe(false);
  });
});

describe("milestones", () => {
  it("next milestone climbs the ladder", () => {
    expect(nextMilestone(0)).toBe(1);
    expect(nextMilestone(2)).toBe(3);
    expect(nextMilestone(7)).toBe(14);
    expect(nextMilestone(100)).toBe(null);
  });

  it("reached milestone fires exactly on the number", () => {
    expect(reachedMilestone(7)).toBe(7);
    expect(reachedMilestone(8)).toBe(null);
  });
});
