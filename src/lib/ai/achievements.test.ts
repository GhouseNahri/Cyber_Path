import { describe, expect, it } from "vitest";
import { deriveAchievements } from "./achievements";

const base = {
  completedTopics: 0,
  totalTopics: 27,
  currentStreak: 0,
  longestStreak: 0,
  projectsCompleted: 0,
  quizPasses: 0,
  revisionGraduates: 0,
  firstSessionLogged: false,
};

describe("deriveAchievements", () => {
  it("everything unearned on a fresh account", () => {
    const list = deriveAchievements(base);
    expect(list.every((a) => !a.earned)).toBe(true);
    expect(list.length).toBe(10);
  });

  it("first session and first topic earn their badges", () => {
    const list = deriveAchievements({ ...base, firstSessionLogged: true, completedTopics: 1 });
    expect(list.find((a) => a.id === "first-steps")?.earned).toBe(true);
    expect(list.find((a) => a.id === "first-topic")?.earned).toBe(true);
    expect(list.find((a) => a.id === "five-topics")?.earned).toBe(false);
  });

  it("streak badges use the longest streak and show progress", () => {
    const list = deriveAchievements({ ...base, currentStreak: 4, longestStreak: 4 });
    const week = list.find((a) => a.id === "week-streak")!;
    expect(week.earned).toBe(false);
    expect(week.progressPct).toBe(57);
  });

  it("longest streak keeps the badge even if the current streak broke", () => {
    const list = deriveAchievements({ ...base, currentStreak: 0, longestStreak: 30 });
    expect(list.find((a) => a.id === "month-streak")?.earned).toBe(true);
    expect(list.find((a) => a.id === "week-streak")?.earned).toBe(true);
  });

  it("roadmap percentage badges respect the total", () => {
    const list = deriveAchievements({ ...base, completedTopics: 7, totalTopics: 27 });
    expect(list.find((a) => a.id === "quarter-way")?.earned).toBe(true);
    expect(list.find((a) => a.id === "halfway")?.earned).toBe(false);
  });

  it("project and quiz milestones earn correctly", () => {
    const list = deriveAchievements({ ...base, projectsCompleted: 1, quizPasses: 2, revisionGraduates: 1 });
    expect(list.find((a) => a.id === "builder")?.earned).toBe(true);
    expect(list.find((a) => a.id === "quiz-first-pass")?.earned).toBe(true);
    expect(list.find((a) => a.id === "reviewer")?.earned).toBe(true);
  });
});
