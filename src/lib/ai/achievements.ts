/**
 * Achievements (master prompt Phase 29) — meaningful milestones derived from
 * data the platform already tracks. Pure functions, no new tables, no
 * pseudo-activity badges.
 */

export type Achievement = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  /** true when the milestone has been reached. */
  earned: boolean;
  /** Optional progress hint when not yet earned (0–100). */
  progressPct: number | null;
};

export function deriveAchievements(input: {
  completedTopics: number;
  totalTopics: number;
  currentStreak: number;
  longestStreak: number;
  projectsCompleted: number;
  quizPasses: number;
  revisionGraduates: number;
  firstSessionLogged: boolean;
}): Achievement[] {
  const streakPct = (n: number) => Math.min(100, Math.round((input.currentStreak / n) * 100));
  return [
    {
      id: "first-steps",
      title: "First Steps",
      description: "Logged your first study session",
      emoji: "🌱",
      earned: input.firstSessionLogged,
      progressPct: input.firstSessionLogged ? 100 : null,
    },
    {
      id: "first-topic",
      title: "First Topic",
      description: "Completed your first roadmap topic",
      emoji: "🎯",
      earned: input.completedTopics >= 1,
      progressPct: input.completedTopics >= 1 ? 100 : null,
    },
    {
      id: "week-streak",
      title: "On a Roll",
      description: "Reached a 7-day streak",
      emoji: "🔥",
      earned: input.longestStreak >= 7,
      progressPct: input.longestStreak >= 7 ? 100 : streakPct(7),
    },
    {
      id: "month-streak",
      title: "Iron Habit",
      description: "Reached a 30-day streak",
      emoji: "⚡",
      earned: input.longestStreak >= 30,
      progressPct: input.longestStreak >= 30 ? 100 : Math.min(100, Math.round((input.longestStreak / 30) * 100)),
    },
    {
      id: "quiz-first-pass",
      title: "Proven",
      description: "Passed your first knowledge check",
      emoji: "✅",
      earned: input.quizPasses >= 1,
      progressPct: input.quizPasses >= 1 ? 100 : null,
    },
    {
      id: "five-topics",
      title: "Momentum",
      description: "Completed 5 roadmap topics",
      emoji: "📚",
      earned: input.completedTopics >= 5,
      progressPct: Math.min(100, Math.round((input.completedTopics / 5) * 100)),
    },
    {
      id: "reviewer",
      title: "Reviewer",
      description: "Graduated topics from spaced revision",
      emoji: "🔁",
      earned: input.revisionGraduates >= 1,
      progressPct: input.revisionGraduates >= 1 ? 100 : null,
    },
    {
      id: "builder",
      title: "Builder",
      description: "Completed or published a project",
      emoji: "🏗️",
      earned: input.projectsCompleted >= 1,
      progressPct: input.projectsCompleted >= 1 ? 100 : null,
    },
    {
      id: "quarter-way",
      title: "Quarter Way",
      description: "Completed 25% of the roadmap",
      emoji: "🧭",
      earned: input.totalTopics > 0 && input.completedTopics / input.totalTopics >= 0.25,
      progressPct:
        input.totalTopics > 0 ? Math.min(100, Math.round((input.completedTopics / input.totalTopics / 0.25) * 100)) : 0,
    },
    {
      id: "halfway",
      title: "Halfway Hero",
      description: "Completed 50% of the roadmap",
      emoji: "🏔️",
      earned: input.totalTopics > 0 && input.completedTopics / input.totalTopics >= 0.5,
      progressPct:
        input.totalTopics > 0 ? Math.min(100, Math.round((input.completedTopics / input.totalTopics / 0.5) * 100)) : 0,
    },
  ];
}

/** Adapter: assemble the achievement inputs from existing dashboard queries. */
export function achievementsFromDashboardData(input: {
  completedTopics: number;
  totalTopics: number;
  currentStreak: number;
  longestStreak: number;
  projectsCompleted: number;
  quizPasses: number;
  revisionGraduates: number;
  firstSessionLogged: boolean;
}): Achievement[] {
  return deriveAchievements(input);
}
