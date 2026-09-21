import { describe, expect, it } from "vitest";
import {
  canTransition,
  isValidProjectUrl,
  milestonePct,
  nextMilestoneIndex,
  parseStatus,
  validIndexes,
} from "./engine";

describe("canTransition", () => {
  it("allows single forward steps", () => {
    expect(canTransition("idea", "planned")).toBe(true);
    expect(canTransition("planned", "building")).toBe(true);
    expect(canTransition("building", "completed")).toBe(true);
    expect(canTransition("completed", "published")).toBe(true);
  });
  it("rejects skips and identity", () => {
    expect(canTransition("idea", "building")).toBe(false);
    expect(canTransition("idea", "published")).toBe(false);
    expect(canTransition("building", "building")).toBe(false);
  });
  it("allows backward moves (reopen) but not sideways invention", () => {
    expect(canTransition("published", "building")).toBe(true);
    expect(canTransition("completed", "idea")).toBe(true);
  });
});

describe("parseStatus", () => {
  it("passes known statuses and falls back to idea", () => {
    expect(parseStatus("building")).toBe("building");
    expect(parseStatus("garbage")).toBe("idea");
    expect(parseStatus(null)).toBe("idea");
  });
});

describe("milestones", () => {
  it("computes percentage from valid indexes", () => {
    expect(milestonePct(5, [0, 1])).toBe(40);
    expect(milestonePct(5, [0, 1, 2, 3, 4])).toBe(100);
    expect(milestonePct(5, [])).toBe(0);
    expect(milestonePct(0, [0, 1])).toBe(0);
  });
  it("ignores invalid, duplicate and out-of-range indexes", () => {
    expect(validIndexes([0, 0, 2, 9, -1, "x"], 5)).toEqual([0, 2]);
    expect(milestonePct(5, [0, 0, 2, 9, -1])).toBe(40);
    expect(nextMilestoneIndex(5, [0, 1])).toBe(2);
    expect(nextMilestoneIndex(5, [0, 1, 2, 3, 4])).toBeNull();
  });
});

describe("isValidProjectUrl", () => {
  it("accepts https URLs and empty (clear)", () => {
    expect(isValidProjectUrl("https://github.com/user/repo")).toBe(true);
    expect(isValidProjectUrl("")).toBe(true);
  });
  it("rejects non-https, garbage and oversize", () => {
    expect(isValidProjectUrl("http://github.com/user/repo")).toBe(false);
    expect(isValidProjectUrl("javascript:alert(1)")).toBe(false);
    expect(isValidProjectUrl("not a url")).toBe(false);
    expect(isValidProjectUrl(`https://x.com/${"a".repeat(300)}`)).toBe(false);
  });
});
