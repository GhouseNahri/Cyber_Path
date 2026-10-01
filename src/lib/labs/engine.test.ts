import { describe, expect, it } from "vitest";
import {
  canTransitionLab,
  filterLabs,
  formatLabMinutes,
  labStats,
  parseCriteria,
  parseHints,
  parseLabDifficulty,
  parseLabStatus,
  parseLabType,
  statusTimestampPatch,
  suggestedLabs,
  type FilterableLab,
} from "./engine";

describe("lab status machine", () => {
  it("allows the documented forward transitions", () => {
    expect(canTransitionLab("not_started", "in_progress")).toBe(true);
    expect(canTransitionLab("in_progress", "completed")).toBe(true);
    expect(canTransitionLab("in_progress", "abandoned")).toBe(true);
    expect(canTransitionLab("completed", "revisit")).toBe(true);
    expect(canTransitionLab("completed", "abandoned")).toBe(true);
    expect(canTransitionLab("revisit", "in_progress")).toBe(true);
    expect(canTransitionLab("abandoned", "in_progress")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(canTransitionLab("not_started", "completed")).toBe(false);
    expect(canTransitionLab("not_started", "revisit")).toBe(false);
    expect(canTransitionLab("in_progress", "revisit")).toBe(false);
    expect(canTransitionLab("completed", "in_progress")).toBe(false);
    expect(canTransitionLab("revisit", "completed")).toBe(false);
    expect(canTransitionLab("in_progress", "in_progress")).toBe(false);
    expect(canTransitionLab("completed", "completed")).toBe(false);
  });

  it("abandoned labs can restart but never skip to completed", () => {
    expect(canTransitionLab("abandoned", "completed")).toBe(false);
    expect(canTransitionLab("abandoned", "revisit")).toBe(false);
  });

  it("sets the right timestamp per target status", () => {
    expect(statusTimestampPatch("in_progress", "t1")).toEqual({ started_at: "t1" });
    expect(statusTimestampPatch("completed", "t2")).toEqual({ completed_at: "t2" });
    expect(statusTimestampPatch("revisit", "t3")).toEqual({ revisit_at: "t3" });
    expect(statusTimestampPatch("abandoned", "t4")).toEqual({ abandoned_at: "t4" });
    expect(statusTimestampPatch("not_started", "t5")).toEqual({});
  });

  it("parses unknown DB values defensively to not_started", () => {
    expect(parseLabStatus("completed")).toBe("completed");
    expect(parseLabStatus("garbage")).toBe("not_started");
    expect(parseLabStatus(null)).toBe("not_started");
    expect(parseLabStatus(42)).toBe("not_started");
  });
});

describe("type + difficulty parsing", () => {
  it("parses lab types with external as default", () => {
    expect(parseLabType("simulation")).toBe("simulation");
    expect(parseLabType("home_lab")).toBe("home_lab");
    expect(parseLabType("nope")).toBe("external");
    expect(parseLabType(undefined)).toBe("external");
  });

  it("parses difficulties with beginner as default", () => {
    expect(parseLabDifficulty("expert")).toBe("expert");
    expect(parseLabDifficulty("adaptive")).toBe("adaptive");
    expect(parseLabDifficulty("nope")).toBe("beginner");
  });
});

describe("hints + criteria", () => {
  it("parses tiered hints, sorts by tier, drops junk", () => {
    const hints = parseHints([
      { tier: 2, text: "second" },
      { tier: 1, text: "first" },
      { tier: "x", text: "bad tier ok" },
      { text: "no tier" },
      { tier: 3 },
      "junk",
      null,
    ]);
    expect(hints).toEqual([
      { tier: 1, text: "first" },
      { tier: 2, text: "second" },
      // Missing/bad tiers fall back to "position so far" at push time.
      { tier: 3, text: "bad tier ok" },
      { tier: 4, text: "no tier" },
    ]);
  });

  it("returns empty for non-array hints", () => {
    expect(parseHints(null)).toEqual([]);
    expect(parseHints("x")).toEqual([]);
  });

  it("parses completion criteria modes", () => {
    expect(parseCriteria({ mode: "manual" })).toEqual({ mode: "manual" });
    expect(parseCriteria({ mode: "sim", sim_key: "linux-perms" })).toEqual({ mode: "sim", sim_key: "linux-perms" });
    expect(parseCriteria({ mode: "sim" })).toEqual({ mode: "unknown" });
    expect(parseCriteria({ mode: "sandbox" })).toEqual({ mode: "unknown" });
    expect(parseCriteria(null)).toEqual({ mode: "unknown" });
    expect(parseCriteria("manual")).toEqual({ mode: "unknown" });
  });
});

describe("catalog filtering", () => {
  const labs: FilterableLab[] = [
    { slug: "a", lab_type: "external", category_slug: "linux", difficulty: "beginner", status: "completed" },
    { slug: "b", lab_type: "home_lab", category_slug: "linux", difficulty: "easy", status: "in_progress" },
    { slug: "c", lab_type: "ctf", category_slug: "ctf", difficulty: "beginner", status: null },
    { slug: "d", lab_type: "external", category_slug: "networking", difficulty: "easy", status: "not_started" },
  ];

  it("filters by single facets", () => {
    expect(filterLabs(labs, { type: "ctf", category: "all", difficulty: "all", status: "all" }).map((l) => l.slug)).toEqual(["c"]);
    expect(filterLabs(labs, { type: "all", category: "linux", difficulty: "all", status: "all" }).map((l) => l.slug)).toEqual(["a", "b"]);
    expect(filterLabs(labs, { type: "all", category: "all", difficulty: "easy", status: "all" }).map((l) => l.slug)).toEqual(["b", "d"]);
  });

  it("treats not_started as both untracked and tracked-not-started", () => {
    expect(filterLabs(labs, { type: "all", category: "all", difficulty: "all", status: "not_started" }).map((l) => l.slug)).toEqual(["c", "d"]);
  });

  it("combines facets with AND", () => {
    const f = { type: "external", category: "linux", difficulty: "beginner", status: "completed" } as const;
    expect(filterLabs(labs, f).map((l) => l.slug)).toEqual(["a"]);
  });
});

describe("stats + formatting", () => {
  it("aggregates tracker rows", () => {
    const s = labStats([
      { status: "completed", minutes_spent: 90, lab_type: "external" },
      { status: "completed", minutes_spent: 45, lab_type: "ctf" },
      { status: "in_progress", minutes_spent: 30, lab_type: "home_lab" },
      { status: "revisit", minutes_spent: 10, lab_type: "ctf" },
      { status: "abandoned", minutes_spent: 5, lab_type: "external" },
    ]);
    expect(s).toEqual({
      total: 5,
      completed: 2,
      inProgress: 1,
      revisiting: 1,
      abandoned: 1,
      minutesTotal: 180,
      ctfCount: 2,
      homeLabCount: 1,
    });
  });

  it("handles an empty tracker", () => {
    const s = labStats([]);
    expect(s.total).toBe(0);
    expect(s.minutesTotal).toBe(0);
  });

  it("formats minutes honestly", () => {
    expect(formatLabMinutes(0)).toBe("0m");
    expect(formatLabMinutes(45)).toBe("45m");
    expect(formatLabMinutes(60)).toBe("1h");
    expect(formatLabMinutes(135)).toBe("2h 15m");
  });
});

describe("suggested labs", () => {
  const catalog = [
    { slug: "done-lab", status: "completed" as const },
    { slug: "active-lab", status: "in_progress" as const },
    { slug: "map-lab", status: null },
    { slug: "next-lab", status: null },
    { slug: "unmapped-lab", status: null },
  ];
  const map = new Map([
    ["map-lab", ["in-progress-topic"]],
    ["next-lab", ["early-topic"]],
    ["done-lab", ["in-progress-topic"]],
    ["active-lab", ["in-progress-topic"]],
  ]);

  it("ranks in-progress-topic labs first, then roadmap-order labs", () => {
    const picks = suggestedLabs(catalog, map, ["early-topic", "in-progress-topic"], new Set(["in-progress-topic"]));
    expect(picks).toEqual(["map-lab", "next-lab"]);
  });

  it("falls back to roadmap-order topics when nothing is in progress", () => {
    const picks = suggestedLabs(catalog, map, ["early-topic", "in-progress-topic"], new Set());
    // next-lab maps to the earliest roadmap topic (score 50) — it leads.
    expect(picks).toEqual(["next-lab", "map-lab"]);
  });

  it("respects the limit", () => {
    const picks = suggestedLabs(catalog, map, ["in-progress-topic", "far-future-topic"], new Set(), 1);
    expect(picks).toEqual(["map-lab"]);
  });
});
