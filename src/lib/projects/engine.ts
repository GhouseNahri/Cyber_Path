/**
 * Pure project-tracker logic: the status state machine, milestone progress,
 * and URL validation. Single source of truth for what statuses exist, how
 * they may move, and how far along a project is.
 */

export type ProjectStatus = "idea" | "planned" | "building" | "completed" | "published";

export const PROJECT_STATUSES: ProjectStatus[] = ["idea", "planned", "building", "completed", "published"];

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  idea: "Idea",
  planned: "Planned",
  building: "Building",
  completed: "Completed",
  published: "Published",
};

/** Rank of each status for ordering and forward-only enforcement. */
export const STATUS_RANK: Record<ProjectStatus, number> = {
  idea: 0,
  planned: 1,
  building: 2,
  completed: 3,
  published: 4,
};

/** A status transition is legal when it moves forward exactly one step, OR
 *  moves backward any number of steps (reopening a finished project). */
export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  if (from === to) return false;
  const f = STATUS_RANK[from];
  const t = STATUS_RANK[to];
  return t === f + 1 || t < f;
}

/** Parse an arbitrary DB value into a known status (defensive). */
export function parseStatus(raw: unknown): ProjectStatus {
  return PROJECT_STATUSES.includes(raw as ProjectStatus) ? (raw as ProjectStatus) : "idea";
}

/**
 * Milestone progress. `done` is a list of milestone indexes (0-based);
 * invalid and duplicate indexes are ignored. Returns 0-100.
 */
export function milestonePct(totalMilestones: number, done: unknown): number {
  if (totalMilestones <= 0) return 0;
  const count = validIndexes(done, totalMilestones).length;
  return Math.min(100, Math.round((count / totalMilestones) * 100));
}

/** Sanitized list of done milestone indexes, deduplicated and in range. */
export function validIndexes(done: unknown, totalMilestones: number): number[] {
  if (!Array.isArray(done)) return [];
  const set = new Set<number>();
  for (const v of done) {
    const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
    if (Number.isInteger(n) && n >= 0 && n < totalMilestones) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

/** The first milestone index not yet done, or null when all are done. */
export function nextMilestoneIndex(totalMilestones: number, done: unknown): number | null {
  const doneSet = new Set(validIndexes(done, totalMilestones));
  for (let i = 0; i < totalMilestones; i++) {
    if (!doneSet.has(i)) return i;
  }
  return null;
}

/** Accept only https URLs (github/demo links are public artifacts). */
export function isValidProjectUrl(raw: string): boolean {
  if (raw.length === 0) return true; // empty = clear the field
  if (raw.length > 300) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.hostname.length > 0;
  } catch {
    return false;
  }
}
