/** Pure accountability messaging — deterministic per (date, streak state),
 *  varied across days, empathetic when the reason is serious.
 *  No taunt ever mentions intelligence, worth, or personal circumstances.
 */

import { shiftDayKey } from "@/lib/session/day";
import { reachedMilestone } from "./engine";

export type MissedReasonCategory =
  | "no_time"
  | "too_tired"
  | "college_work"
  | "didnt_understand"
  | "task_too_difficult"
  | "lost_motivation"
  | "forgot"
  | "technical_problem"
  | "personal"
  | "other";

/** Reasons where roasting is never appropriate — respond with support. */
const SERIOUS_REASONS: ReadonlySet<MissedReasonCategory> = new Set(["personal"]);

const COMPLETION_LINES: string[] = [
  "Nice work. You showed up and finished today's mission.",
  "Another day in the books. Keep stacking these.",
  "Mission complete. That's the habit forming.",
  "Clean session. Tomorrow's plan is already waiting.",
  "You did the work today — that's how roadmaps become skills.",
  "Logged and done. Consistency beats intensity.",
  "Solid. Every session makes the next one easier.",
  "Done and dusted. The roadmap didn't stand a chance.",
];

const MILESTONE_LINES: Record<number, string> = {
  1: "Day one, logged. Every streak starts exactly here.",
  3: "Three days. The momentum is real now.",
  7: "A full week of showing up. That's a habit taking root.",
  14: "Two weeks straight. Most people never get here.",
  30: "Thirty days. This isn't a phase anymore — it's who you are.",
  50: "Fifty days of consistent work. Elite consistency.",
  100: "One hundred days. The roadmap is your routine now.",
};

/** Stable hash so a given date always shows the same line, but different
 *  days rotate through the list (no exact-repeat fatigue). */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Message after completing today's mission. Milestones override the rotation. */
export function completionMessage(streak: number, dayKey: string): string {
  const milestone = reachedMilestone(streak);
  if (milestone !== null) return MILESTONE_LINES[milestone] ?? COMPLETION_LINES[0] ?? "";
  const idx = hash(`done:${dayKey}`) % COMPLETION_LINES.length;
  return COMPLETION_LINES[idx] ?? COMPLETION_LINES[0] ?? "";
}

export const MISSED_REASON_LABELS: Record<MissedReasonCategory, string> = {
  no_time: "No time",
  too_tired: "Too tired",
  college_work: "College / work",
  didnt_understand: "Didn't understand the topic",
  task_too_difficult: "Task was too difficult",
  lost_motivation: "Lost motivation",
  forgot: "Forgot",
  technical_problem: "Technical problem",
  personal: "Personal reason",
  other: "Other",
};

const TAUNT_LINES: string[] = [
  "The roadmap didn't disappear. You just ghosted it.",
  "Cyber threats are persistent. Your study schedule apparently isn't.",
  "Today's mission is still sitting there, looking at you.",
  "Missed it. The topics, however, haven't moved an inch.",
  "Zero-day exploit? No — just a zero-session day.",
  "The labs will wait. Your momentum won't.",
  "That's the roadmap collecting dust, not XP.",
];

/** Empathetic lines for serious reasons — never a taunt. */
const SUPPORT_LINES: string[] = [
  "Thanks for telling me. Life comes first — the roadmap will be here when you're ready.",
  "That's a completely fair reason. Take what you need; nothing is lost.",
  "Noted, no judgment. Come back when it makes sense — the plan will adapt.",
];

const REASON_NUDGES: Partial<Record<MissedReasonCategory, string>> = {
  no_time: "If time is the bottleneck, shrinking tomorrow's mission beats skipping it — even 15 minutes keeps the streak alive.",
  too_tired: "On tired days, a single short task is enough to qualify. Small and done beats big and skipped.",
  didnt_understand: "If the topic didn't land, try a different resource on it tomorrow — confusion usually means the explanation, not you.",
  task_too_difficult: "If it was too hard, tomorrow can start with an easier task on the same topic — momentum first, difficulty later.",
  forgot: "If it was a forget, not a skip — that's fixable. A same-time-every-day slot removes the reliance on memory.",
  lost_motivation: "Motivation follows action more than it leads it. One small task tomorrow is a perfectly good restart.",
  technical_problem: "If tech got in the way, note what broke — a stable setup is part of the skill.",
  college_work: "Busy stretches happen. A trimmed mission keeps the chain alive until things calm down.",
};

/** Missed-day message: playful by default, supportive for serious reasons. */
export function missedDayMessage(
  reason: MissedReasonCategory,
  dayKey: string,
  streakBefore: number,
): string {
  if (SERIOUS_REASONS.has(reason)) {
    const idx = hash(`support:${dayKey}`) % SUPPORT_LINES.length;
    return SUPPORT_LINES[idx] ?? SUPPORT_LINES[0] ?? "";
  }
  const taunt = TAUNT_LINES[hash(`miss:${dayKey}`) % TAUNT_LINES.length] ?? TAUNT_LINES[0] ?? "";
  const nudge = REASON_NUDGES[reason];
  const streakNote =
    streakBefore > 0
      ? `Your ${streakBefore}-day run is paused, not gone — today decides whether it resumes.`
      : "";
  return [taunt, nudge, streakNote].filter(Boolean).join(" ");
}

/** The day key for "yesterday" relative to a day key. */
export function yesterdayKey(dayKey: string): string {
  return shiftDayKey(dayKey, -1);
}
