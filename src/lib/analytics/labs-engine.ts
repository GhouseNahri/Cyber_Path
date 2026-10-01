/**
 * Labs analytics (L5) — pure math over the user's tracker rows and the
 * labs' mapped skills. Same philosophy as the rest of analytics: only
 * metrics that change what you do next, honest about gaps (no fabricated
 * history — months with zero completions stay zero).
 *
 * No database, no React. The caller passes rows already scoped to the user
 * by RLS plus the user's timezone day key.
 */

import { LAB_TYPE_LABEL, parseLabType, type LabType } from "@/lib/labs/engine";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A user_labs row reduced to what analytics needs. */
export type RawLabRow = {
  lab_slug: string | null;
  status: string;
  lab_type: string;
  minutes_spent: number;
  completed_at: string | null;
};

export type LabSkillLink = { lab_slug: string; skill_slug: string };

// ── Month keys (timezone-aware, deterministic) ────────────────────────────

/** "2026-10" for an ISO instant, formatted in the user's timezone (UTC fallback). */
export function monthKeyFor(timezone: string | null | undefined, iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC", year: "numeric", month: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 7);
  }
}

/** Label ("Oct") for a "2026-10" month key. */
export function monthLabel(key: string): string {
  const m = Number.parseInt(key.slice(5, 7), 10);
  return MONTHS[m - 1] ?? key;
}

/** Last n month keys ("YYYY-MM") ending at the month of `todayKey`, oldest first. */
export function lastMonthKeys(todayKey: string, n: number): string[] {
  const [y, m] = todayKey.split("-").map((x) => Number.parseInt(x, 10));
  if (!y || !m) return [];
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    // UTC-15 avoids month-boundary drift in the arithmetic.
    const d = new Date(Date.UTC(y, m - 1 - i, 15));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

// ── Summary ───────────────────────────────────────────────────────────────

export type LabsSummary = {
  tracked: number;
  completed: number;
  /** in_progress + revisit — work currently open. */
  active: number;
  abandoned: number;
  /** Total manually-logged minutes across every tracked lab. */
  minutesTotal: number;
  /** Average minutes on completed labs only (in-progress time excluded). */
  avgMinutesPerCompleted: number;
};

function clampMinutes(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;
}

export function labsSummary(rows: RawLabRow[]): LabsSummary {
  let completed = 0;
  let active = 0;
  let abandoned = 0;
  let minutesTotal = 0;
  let completedMinutes = 0;
  for (const r of rows) {
    minutesTotal += clampMinutes(r.minutes_spent);
    if (r.status === "completed") {
      completed += 1;
      completedMinutes += clampMinutes(r.minutes_spent);
    } else if (r.status === "in_progress" || r.status === "revisit") {
      active += 1;
    } else if (r.status === "abandoned") {
      abandoned += 1;
    }
  }
  return {
    tracked: rows.length,
    completed,
    active,
    abandoned,
    minutesTotal,
    avgMinutesPerCompleted: completed > 0 ? Math.round(completedMinutes / completed) : 0,
  };
}

// ── Monthly completion trend ──────────────────────────────────────────────

export type MonthBucket = { key: string; label: string; completed: number };

/** Completions per month for the last n months (zero months included). */
export function monthlyCompletions(
  rows: RawLabRow[],
  timezone: string | null | undefined,
  todayKey: string,
  n: number,
): MonthBucket[] {
  const keys = lastMonthKeys(todayKey, n);
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== "completed" || !r.completed_at) continue;
    const mk = monthKeyFor(timezone, r.completed_at);
    if (mk) counts.set(mk, (counts.get(mk) ?? 0) + 1);
  }
  return keys.map((key) => ({ key, label: monthLabel(key), completed: counts.get(key) ?? 0 }));
}

// ── Completed-by-type mix ─────────────────────────────────────────────────

export type TypeMix = { labType: string; label: string; count: number };

/** Completed labs grouped by type, busiest first (zero types dropped). */
export function completedTypeMix(rows: RawLabRow[]): TypeMix[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== "completed") continue;
    const t = parseLabType(r.lab_type);
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([labType, count]) => ({ labType, label: LAB_TYPE_LABEL[labType as LabType] ?? labType, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Skill growth over time ────────────────────────────────────────────────

export type SkillGrowthPoint = {
  key: string;
  label: string;
  /** Cumulative completed labs as of the end of this month. */
  labs: number;
  /** Cumulative distinct skills evidenced by those labs. */
  skills: number;
};

/**
 * Cumulative labs + distinct evidenced skills per month. Labs completed
 * before the window count toward the first point (honest totals, not a
 * pretend fresh start).
 */
export function skillGrowth(
  rows: RawLabRow[],
  labSkills: LabSkillLink[],
  timezone: string | null | undefined,
  todayKey: string,
  n: number,
): SkillGrowthPoint[] {
  const keys = lastMonthKeys(todayKey, n);
  const skillsByLab = new Map<string, string[]>();
  for (const l of labSkills) {
    const list = skillsByLab.get(l.lab_slug) ?? [];
    list.push(l.skill_slug);
    skillsByLab.set(l.lab_slug, list);
  }

  const done = rows
    .filter((r) => r.status === "completed" && r.completed_at && r.lab_slug)
    .map((r) => ({ mk: monthKeyFor(timezone, r.completed_at as string), slug: r.lab_slug as string }))
    .filter((r) => r.mk !== "")
    .sort((a, b) => (a.mk < b.mk ? -1 : a.mk > b.mk ? 1 : 0));

  let labs = 0;
  const seenSkills = new Set<string>();
  let cursor = 0;

  return keys.map((key) => {
    // Everything completed up to the end of this month folds in here —
    // including work from before the window (first point carries it).
    for (;;) {
      const next = done[cursor];
      if (!next || next.mk > key) break;
      labs += 1;
      for (const s of skillsByLab.get(next.slug) ?? []) seenSkills.add(s);
      cursor += 1;
    }
    return { key, label: monthLabel(key), labs, skills: seenSkills.size };
  });
}

// ── Strongest skills ──────────────────────────────────────────────────────

export type TopSkill = { slug: string; labs: number };

/** Skills confirmed by the most completed labs, strongest first. */
export function topSkills(rows: RawLabRow[], labSkills: LabSkillLink[], limit: number): TopSkill[] {
  const doneSlugs = new Set(rows.filter((r) => r.status === "completed" && r.lab_slug).map((r) => r.lab_slug as string));
  const counts = new Map<string, number>();
  for (const l of labSkills) {
    if (!doneSlugs.has(l.lab_slug)) continue;
    counts.set(l.skill_slug, (counts.get(l.skill_slug) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([slug, labs]) => ({ slug, labs }))
    .sort((a, b) => b.labs - a.labs || a.slug.localeCompare(b.slug))
    .slice(0, limit);
}
