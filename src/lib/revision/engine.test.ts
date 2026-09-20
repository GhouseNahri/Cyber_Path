import { describe, expect, it } from "vitest";
import {
  DEFAULT_INTERVALS,
  bucketReviews,
  firstReview,
  intervalForReview,
  isDue,
  nextReviewAfter,
  overdueDays,
  validateIntervals,
  type ReviewRow,
} from "./engine";
import { shiftDayKey } from "@/lib/session/day";

const row = (over: Partial<ReviewRow>): ReviewRow => ({
  topic_slug: "x",
  review_number: 1,
  interval_days: 1,
  due_day_key: "2026-09-20",
  status: "scheduled",
  completed_at: null,
  ...over,
});

describe("interval ladder", () => {
  it("gives review #1..#5 the default 1/3/7/14/30 intervals", () => {
    expect([1, 2, 3, 4, 5].map((n) => intervalForReview(DEFAULT_INTERVALS, n))).toEqual([1, 3, 7, 14, 30]);
  });

  it("returns null past the end of the ladder (graduation)", () => {
    expect(intervalForReview(DEFAULT_INTERVALS, 6)).toBeNull();
  });

  it("supports custom ladders", () => {
    expect(intervalForReview([2, 5], 2)).toBe(5);
    expect(intervalForReview([2, 5], 3)).toBeNull();
  });
});

describe("scheduling", () => {
  it("first review lands at +intervals[0] days", () => {
    expect(firstReview(DEFAULT_INTERVALS, "2026-09-20")).toEqual({
      review_number: 1,
      interval_days: 1,
      due_day_key: "2026-09-21",
    });
  });

  it("walks the full 1/3/7/14/30 ladder from one completion date", () => {
    let next = firstReview(DEFAULT_INTERVALS, "2026-09-20"); // #1 due 09-21
    const dues: string[] = [next!.due_day_key];
    for (let n = 1; n <= 4; n++) {
      next = nextReviewAfter(DEFAULT_INTERVALS, n, next!.due_day_key);
      dues.push(next!.due_day_key);
    }
    expect(dues).toEqual(["2026-09-21", "2026-09-24", "2026-10-01", "2026-10-15", "2026-11-14"]);
    // Review #5 completed → graduated.
    expect(nextReviewAfter(DEFAULT_INTERVALS, 5, "2026-11-14")).toBeNull();
  });

  it("crosses month boundaries correctly", () => {
    const next = nextReviewAfter(DEFAULT_INTERVALS, 1, "2026-09-28"); // +3 → Oct 1
    expect(next?.due_day_key).toBe("2026-10-01");
  });

  it("handles a one-interval ladder: single review then graduation", () => {
    expect(firstReview([7], "2026-09-20")?.due_day_key).toBe("2026-09-27");
    // Completing the only review graduates the topic.
    expect(nextReviewAfter([7], 1, "2026-09-27")).toBeNull();
  });
});

describe("due logic", () => {
  it("scheduled rows are due when due_day_key <= today", () => {
    expect(isDue(row({ due_day_key: "2026-09-20", status: "scheduled" }), "2026-09-20")).toBe(true);
    expect(isDue(row({ due_day_key: "2026-09-19", status: "scheduled" }), "2026-09-20")).toBe(true);
    expect(isDue(row({ due_day_key: "2026-09-21", status: "scheduled" }), "2026-09-20")).toBe(false);
    expect(isDue(row({ due_day_key: "2026-09-19", status: "completed" }), "2026-09-20")).toBe(false);
  });

  it("counts overdue days", () => {
    expect(overdueDays("2026-09-20", "2026-09-20")).toBe(0);
    expect(overdueDays("2026-09-17", "2026-09-20")).toBe(3);
    expect(overdueDays("2026-09-21", "2026-09-20")).toBe(0);
  });
});

describe("bucketReviews", () => {
  it("splits due / upcoming and sorts by due date", () => {
    const b = bucketReviews(
      [
        row({ topic_slug: "a", due_day_key: "2026-09-20" }),
        row({ topic_slug: "b", due_day_key: "2026-09-25" }),
        row({ topic_slug: "c", due_day_key: "2026-09-17" }),
        row({ topic_slug: "d", due_day_key: "2026-09-22", status: "completed" }),
      ],
      "2026-09-20",
    );
    expect(b.due.map((r) => r.topic_slug)).toEqual(["c", "a"]);
    expect(b.upcoming.map((r) => r.topic_slug)).toEqual(["b"]);
  });

  it("marks topics graduated when every review is completed and none scheduled", () => {
    const b = bucketReviews(
      [
        row({ topic_slug: "g", review_number: 1, status: "completed", completed_at: "2026-09-10T10:00:00Z" }),
        row({ topic_slug: "g", review_number: 2, status: "completed", completed_at: "2026-09-13T10:00:00Z" }),
        row({ topic_slug: "h", review_number: 1, status: "completed", completed_at: "2026-09-10T10:00:00Z" }),
        row({ topic_slug: "h", review_number: 2, due_day_key: "2026-09-23" }),
      ],
      "2026-09-20",
    );
    expect(b.graduatedSlugs).toEqual(["g"]);
  });

  it("respects the completed-topics filter for graduation", () => {
    const b = bucketReviews(
      [row({ topic_slug: "reset", review_number: 1, status: "completed", completed_at: "2026-09-10T10:00:00Z" })],
      "2026-09-20",
      new Set(["other"]),
    );
    expect(b.graduatedSlugs).toEqual([]);
  });
});

describe("validateIntervals", () => {
  it("cleans, dedupes, sorts and caps user input", () => {
    expect(validateIntervals([30, 1, 7, 7, 0, -2, "14", 400])).toEqual([1, 7, 14, 30]);
    expect(validateIntervals([])).toEqual(DEFAULT_INTERVALS);
    expect(validateIntervals(["abc", null])).toEqual(DEFAULT_INTERVALS);
    expect(validateIntervals([2, 5, 9, 12, 15, 20, 99])).toHaveLength(6);
  });
});
