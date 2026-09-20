import { describe, expect, it } from "vitest";
import { completionMessage, missedDayMessage } from "./messages";

describe("completionMessage", () => {
  it("is stable for the same day but varies across days", () => {
    const a = completionMessage(2, "2026-09-19");
    const b = completionMessage(2, "2026-09-19");
    const c = completionMessage(2, "2026-09-20");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("milestone days get the milestone line", () => {
    expect(completionMessage(1, "2026-09-20")).toContain("Day one");
    expect(completionMessage(7, "2026-09-20")).toContain("week");
    expect(completionMessage(100, "2026-09-20")).toContain("hundred");
  });
});

describe("missedDayMessage", () => {
  it("is playful for light reasons", () => {
    const msg = missedDayMessage("no_time", "2026-09-20", 3);
    expect(msg).toMatch(/roadmap|mission|session|momentum|labs|topics/i);
  });

  it("never taunts on serious reasons — empathy override", () => {
    for (const dayKey of ["2026-09-19", "2026-09-20", "2026-09-21"]) {
      const msg = missedDayMessage("personal", dayKey, 5);
      expect(msg).not.toMatch(/ghosted|persistent|dust|exploit|looking at you/i);
      expect(msg).toMatch(/here when you|fair reason|no judgment/i);
    }
  });

  it("includes a reason-specific nudge for actionable reasons", () => {
    const msg = missedDayMessage("too_tired", "2026-09-20", 0);
    expect(msg).toContain("single short task");
  });

  it("mentions the paused run when a streak exists", () => {
    const msg = missedDayMessage("forgot", "2026-09-20", 6);
    expect(msg).toContain("6-day run");
  });

  it("no streak note when streak is zero", () => {
    const msg = missedDayMessage("forgot", "2026-09-20", 0);
    expect(msg).not.toContain("day run");
  });
});
