/**
 * Pure labs logic: the status state machine, lab-type metadata, hint/criteria
 * parsing and catalog filtering. Single source of truth for what lab statuses
 * exist, how they may move, and how the UI labels them. No DB, no React.
 *
 * Status machine (mirrors the projects engine's style):
 *
 *   not_started → in_progress
 *   in_progress → completed | abandoned
 *   completed   → revisit | abandoned
 *   revisit     → in_progress | abandoned
 *   abandoned   → in_progress        (deliberately un-abandonable only by
 *                                     restarting work; history stays)
 *
 * `abandoned` is a state, never a delete — the row (and its attempts and
 * evidence) remain.
 */

export type LabStatus = "not_started" | "in_progress" | "completed" | "revisit" | "abandoned";

export const LAB_STATUSES: LabStatus[] = ["not_started", "in_progress", "completed", "revisit", "abandoned"];

export const LAB_STATUS_LABEL: Record<LabStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  revisit: "Revisit",
  abandoned: "Abandoned",
};

/** Rank for ordering; not a linear progression (revisit sits after completed). */
export const LAB_STATUS_RANK: Record<LabStatus, number> = {
  not_started: 0,
  in_progress: 1,
  completed: 2,
  revisit: 3,
  abandoned: 4,
};

const EDGES: Record<LabStatus, LabStatus[]> = {
  not_started: ["in_progress"],
  in_progress: ["completed", "abandoned"],
  completed: ["revisit", "abandoned"],
  revisit: ["in_progress", "abandoned"],
  abandoned: ["in_progress"],
};

export function canTransitionLab(from: LabStatus, to: LabStatus): boolean {
  if (from === to) return false;
  return EDGES[from].includes(to);
}

/** Parse an arbitrary DB value into a known status (defensive, like parseStatus in projects). */
export function parseLabStatus(raw: unknown): LabStatus {
  return LAB_STATUSES.includes(raw as LabStatus) ? (raw as LabStatus) : "not_started";
}

/** Timestamp columns the transition sets or clears. `now` injected for purity. */
export function statusTimestampPatch(to: LabStatus, now: string): Record<string, string | null> {
  switch (to) {
    case "in_progress":
      return { started_at: now };
    case "completed":
      return { completed_at: now };
    case "revisit":
      return { revisit_at: now };
    case "abandoned":
      return { abandoned_at: now };
    default:
      return {};
  }
}

// ── Lab types ─────────────────────────────────────────────────────────────

export type LabType = "simulation" | "sandbox" | "external" | "ctf" | "home_lab" | "custom";

export const LAB_TYPES: LabType[] = ["simulation", "sandbox", "external", "ctf", "home_lab", "custom"];

export const LAB_TYPE_LABEL: Record<LabType, string> = {
  simulation: "Built-in simulation",
  sandbox: "Sandboxed lab",
  external: "Provider lab",
  ctf: "CTF",
  home_lab: "Home lab",
  custom: "Custom lab",
};

export function parseLabType(raw: unknown): LabType {
  return LAB_TYPES.includes(raw as LabType) ? (raw as LabType) : "external";
}

// ── Difficulty ────────────────────────────────────────────────────────────

export type LabDifficulty = "beginner" | "easy" | "intermediate" | "advanced" | "expert" | "adaptive";

export const LAB_DIFFICULTIES: LabDifficulty[] = [
  "beginner",
  "easy",
  "intermediate",
  "advanced",
  "expert",
  "adaptive",
];

export const LAB_DIFFICULTY_LABEL: Record<LabDifficulty, string> = {
  beginner: "Beginner",
  easy: "Easy",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
  adaptive: "Adaptive",
};

export function parseLabDifficulty(raw: unknown): LabDifficulty {
  return LAB_DIFFICULTIES.includes(raw as LabDifficulty) ? (raw as LabDifficulty) : "beginner";
}

// ── Hints + completion criteria (jsonb, defensively parsed) ───────────────

export type LabHint = { tier: number; text: string };

export function parseHints(raw: unknown): LabHint[] {
  if (!Array.isArray(raw)) return [];
  const hints: LabHint[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== "object") continue;
    const tier = (item as Record<string, unknown>).tier;
    const text = (item as Record<string, unknown>).text;
    if (typeof text !== "string" || text.length === 0) continue;
    hints.push({ tier: typeof tier === "number" ? tier : hints.length + 1, text });
  }
  return hints.sort((a, b) => a.tier - b.tier);
}

export type CompletionCriteria = { mode: "manual" } | { mode: "sim"; sim_key: string } | { mode: "unknown" };

export function parseCriteria(raw: unknown): CompletionCriteria {
  if (raw === null || typeof raw !== "object") return { mode: "unknown" };
  const mode = (raw as Record<string, unknown>).mode;
  if (mode === "manual") return { mode: "manual" };
  if (mode === "sim") {
    const key = (raw as Record<string, unknown>).sim_key;
    if (typeof key === "string" && key.length > 0) return { mode: "sim", sim_key: key };
  }
  return { mode: "unknown" };
}

// ── Catalog filtering (pure; used by the Labs dashboard) ──────────────────

export type LabFilters = {
  type: LabType | "all";
  category: string | "all";
  difficulty: LabDifficulty | "all";
  status: LabStatus | "all";
};

export const DEFAULT_LAB_FILTERS: LabFilters = { type: "all", category: "all", difficulty: "all", status: "all" };

export type FilterableLab = {
  slug: string;
  lab_type: LabType;
  category_slug: string;
  difficulty: LabDifficulty;
  status: LabStatus | null; // null = not in the user's tracker
};

export function filterLabs(labs: FilterableLab[], f: LabFilters): FilterableLab[] {
  return labs.filter(
    (l) =>
      (f.type === "all" || l.lab_type === f.type) &&
      (f.category === "all" || l.category_slug === f.category) &&
      (f.difficulty === "all" || l.difficulty === f.difficulty) &&
      (f.status === "all" ||
        (f.status === "not_started"
          ? // "Not started" includes rows the user tracked but never began.
            l.status === null || l.status === "not_started"
          : l.status === f.status)),
  );
}

// ── Dashboard stats (pure; input = the user's tracker rows) ───────────────

export type TrackerRow = { status: LabStatus; minutes_spent: number; lab_type: LabType };

export type LabStats = {
  total: number;
  completed: number;
  inProgress: number;
  revisiting: number;
  abandoned: number;
  minutesTotal: number;
  ctfCount: number;
  homeLabCount: number;
};

export function labStats(rows: TrackerRow[]): LabStats {
  const s: LabStats = {
    total: rows.length,
    completed: 0,
    inProgress: 0,
    revisiting: 0,
    abandoned: 0,
    minutesTotal: 0,
    ctfCount: 0,
    homeLabCount: 0,
  };
  for (const r of rows) {
    if (r.status === "completed") s.completed += 1;
    else if (r.status === "in_progress") s.inProgress += 1;
    else if (r.status === "revisit") s.revisiting += 1;
    else if (r.status === "abandoned") s.abandoned += 1;
    s.minutesTotal += r.minutes_spent;
    if (r.lab_type === "ctf") s.ctfCount += 1;
    if (r.lab_type === "home_lab") s.homeLabCount += 1;
  }
  return s;
}

/** "2h 15m" style — mirrors the honest, low-key formatting used elsewhere. */
export function formatLabMinutes(total: number): string {
  if (total <= 0) return "0m";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Deterministic "practice alongside your roadmap" pick for the dashboard:
 * labs mapped to the user's in-progress topics first (roadmap order), then
 * labs mapped to their next unlocked topics. Pure — the caller supplies
 * already-scoped topic ordering and the lab→topic map.
 */
export function suggestedLabs(
  catalog: { slug: string; status: LabStatus | null }[],
  labTopicMap: Map<string, string[]>,
  topicOrder: string[],
  inProgressTopics: Set<string>,
  limit = 3,
): string[] {
  const rank = (slug: string): number => {
    const status = catalog.find((c) => c.slug === slug)?.status;
    if (status === "completed" || status === "in_progress") return -1; // already engaged
    return 0;
  };
  const scored: { slug: string; score: number; order: number }[] = [];
  catalog.forEach((lab, idx) => {
    if (rank(lab.slug) !== 0) return;
    const topics = labTopicMap.get(lab.slug) ?? [];
    let score = 0;
    for (const t of topics) {
      if (inProgressTopics.has(t)) score += 100;
      else {
        const nextIdx = topicOrder.indexOf(t);
        if (nextIdx !== -1) score += Math.max(0, 50 - nextIdx); // earlier roadmap topics first
      }
    }
    if (score > 0) scored.push({ slug: lab.slug, score, order: idx });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.slice(0, limit).map((s) => s.slug);
}
