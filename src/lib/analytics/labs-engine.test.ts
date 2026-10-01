import { describe, expect, it } from "vitest";

import {
  completedTypeMix,
  labsSummary,
  lastMonthKeys,
  monthKeyFor,
  monthLabel,
  monthlyCompletions,
  skillGrowth,
  topSkills,
  type RawLabRow,
} from "./labs-engine";

const TZ = "UTC";

function row(overrides: Partial<RawLabRow>): RawLabRow {
  return {
    lab_slug: "lab-a",
    status: "completed",
    lab_type: "external",
    minutes_spent: 30,
    completed_at: "2026-09-10T12:00:00Z",
    ...overrides,
  };
}

describe("month helpers", () => {
  it("formats ISO instants to month keys in the given timezone", () => {
    // 2026-09-30T21:00:00Z is already October in Asia/Kolkata.
    expect(monthKeyFor("UTC", "2026-09-30T21:00:00Z")).toBe("2026-09");
    expect(monthKeyFor("Asia/Kolkata", "2026-09-30T21:00:00Z")).toBe("2026-10");
  });

  it("labels month keys and walks backwards through year boundaries", () => {
    expect(monthLabel("2026-01")).toBe("Jan");
    expect(lastMonthKeys("2026-01", 6)).toEqual(["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"]);
  });

  it("returns nothing for malformed today keys", () => {
    expect(lastMonthKeys("not-a-date", 6)).toEqual([]);
  });

  it("falls back to UTC math for invalid timezones", () => {
    expect(monthKeyFor("Mars/Olympus", "2026-09-30T21:00:00Z")).toBe("2026-09");
  });
});

describe("labsSummary", () => {
  it("groups statuses and averages minutes over completed labs only", () => {
    const s = labsSummary([
      row({}),
      row({ completed_at: "2026-08-01T00:00:00Z", minutes_spent: 90 }),
      row({ status: "in_progress", completed_at: null, minutes_spent: 15 }),
      row({ status: "revisit", completed_at: null, minutes_spent: 0 }),
      row({ status: "abandoned", completed_at: null, minutes_spent: 0 }),
      row({ status: "not_started", completed_at: null, lab_slug: null, minutes_spent: 0 } as unknown as RawLabRow),
    ]);
    expect(s.tracked).toBe(6);
    expect(s.completed).toBe(2);
    expect(s.active).toBe(2);
    expect(s.abandoned).toBe(1);
    expect(s.minutesTotal).toBe(135);
    expect(s.avgMinutesPerCompleted).toBe(60); // (30 + 90) / 2
  });

  it("ignores junk minutes instead of crashing", () => {
    const s = labsSummary([row({ minutes_spent: Number.NaN }), row({ minutes_spent: -5 }), row({ minutes_spent: 12.7 })]);
    expect(s.minutesTotal).toBe(13);
  });

  it("is honest about an empty tracker", () => {
    expect(labsSummary([])).toEqual({
      tracked: 0,
      completed: 0,
      active: 0,
      abandoned: 0,
      minutesTotal: 0,
      avgMinutesPerCompleted: 0,
    });
  });
});

describe("monthlyCompletions", () => {
  it("counts completions per month and keeps zero months", () => {
    const rows = [
      row({ completed_at: "2026-09-02T10:00:00Z" }),
      row({ completed_at: "2026-09-28T23:30:00Z" }),
      row({ completed_at: "2026-07-15T10:00:00Z" }),
      row({ status: "in_progress", completed_at: null }),
    ];
    const buckets = monthlyCompletions(rows, TZ, "2026-10-01", 4);
    expect(buckets.map((b) => b.label)).toEqual(["Jul", "Aug", "Sep", "Oct"]);
    expect(buckets.map((b) => b.completed)).toEqual([1, 0, 2, 0]);
  });

  it("attributes late-night completions to the right local month", () => {
    const rows = [row({ completed_at: "2026-09-30T21:00:00Z" })];
    const buckets = monthlyCompletions(rows, "Asia/Kolkata", "2026-10-15", 2);
    expect(buckets.map((b) => b.completed)).toEqual([0, 1]); // Sep 0, Oct 1
  });
});

describe("completedTypeMix", () => {
  it("groups completed labs by type, busiest first, dropping zero types", () => {
    const rows = [
      row({ lab_type: "simulation" }),
      row({ lab_type: "simulation", lab_slug: "lab-b" }),
      row({ lab_type: "ctf", lab_slug: "lab-c" }),
      row({ lab_type: "external", lab_slug: "lab-d", status: "in_progress", completed_at: null }),
      row({ lab_type: "home_lab", lab_slug: "lab-e", status: "not_started", completed_at: null }),
    ];
    const mix = completedTypeMix(rows);
    expect(mix).toEqual([
      { labType: "simulation", label: "Built-in simulation", count: 2 },
      { labType: "ctf", label: "CTF", count: 1 },
    ]);
  });
});

describe("skillGrowth", () => {
  const links = [
    { lab_slug: "lab-a", skill_slug: "linux-basics" },
    { lab_slug: "lab-a", skill_slug: "permissions" },
    { lab_slug: "lab-b", skill_slug: "linux-basics" },
    { lab_slug: "lab-c", skill_slug: "networking" },
  ];

  it("grows cumulative labs and distinct skills month over month", () => {
    const rows = [
      row({ lab_slug: "lab-a", completed_at: "2026-08-10T00:00:00Z" }),
      row({ lab_slug: "lab-b", completed_at: "2026-09-05T00:00:00Z" }),
      row({ lab_slug: "lab-c", completed_at: "2026-09-20T00:00:00Z" }),
    ];
    const points = skillGrowth(rows, links, TZ, "2026-10-05", 4);
    expect(points.map((p) => p.label)).toEqual(["Jul", "Aug", "Sep", "Oct"]);
    expect(points.map((p) => p.labs)).toEqual([0, 1, 3, 3]);
    expect(points.map((p) => p.skills)).toEqual([0, 2, 3, 3]); // lab-a: 2 skills; lab-b shares linux-basics; lab-c adds networking
  });

  it("carries pre-window completions into the first point", () => {
    const rows = [row({ lab_slug: "lab-a", completed_at: "2026-01-10T00:00:00Z" })];
    const points = skillGrowth(rows, links, TZ, "2026-10-05", 3);
    expect(points.map((p) => p.labs)).toEqual([1, 1, 1]);
    expect(points.map((p) => p.skills)).toEqual([2, 2, 2]);
  });

  it("stays at zero with no completions", () => {
    const points = skillGrowth([], links, TZ, "2026-10-05", 3);
    expect(points.map((p) => ({ labs: p.labs, skills: p.skills }))).toEqual([
      { labs: 0, skills: 0 },
      { labs: 0, skills: 0 },
      { labs: 0, skills: 0 },
    ]);
  });
});

describe("topSkills", () => {
  it("ranks skills by confirmed labs and breaks ties deterministically", () => {
    const rows = [
      row({ lab_slug: "lab-a" }),
      row({ lab_slug: "lab-b" }),
      row({ lab_slug: "lab-c", status: "in_progress", completed_at: null }),
    ];
    const links = [
      { lab_slug: "lab-a", skill_slug: "linux-basics" },
      { lab_slug: "lab-a", skill_slug: "permissions" },
      { lab_slug: "lab-b", skill_slug: "linux-basics" },
      { lab_slug: "lab-c", skill_slug: "networking" },
    ];
    expect(topSkills(rows, links, 3)).toEqual([
      { slug: "linux-basics", labs: 2 },
      { slug: "permissions", labs: 1 },
    ]);
  });

  it("respects the limit", () => {
    const rows = [row({})];
    const links = [
      { lab_slug: "lab-a", skill_slug: "a" },
      { lab_slug: "lab-a", skill_slug: "b" },
      { lab_slug: "lab-a", skill_slug: "c" },
    ];
    expect(topSkills(rows, links, 2)).toEqual([
      { slug: "a", labs: 1 },
      { slug: "b", labs: 1 },
    ]);
  });
});
