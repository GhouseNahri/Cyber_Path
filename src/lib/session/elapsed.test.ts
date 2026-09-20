import { describe, expect, it } from "vitest";
import { elapsedSeconds } from "./elapsed";

const START = "2026-09-20T10:00:00Z";
const t = (min: number) => Date.parse(START) + min * 60_000;

function session(overrides: Partial<Parameters<typeof elapsedSeconds>[0]> = {}) {
  return {
    status: "active" as const,
    started_at: START,
    paused_seconds: 0,
    last_resumed_at: null,
    duration_seconds: null,
    ...overrides,
  };
}

describe("elapsedSeconds", () => {
  it("returns stored duration for closed sessions", () => {
    const s = session({ status: "completed", duration_seconds: 600 });
    expect(elapsedSeconds(s, t(60))).toBe(600);
  });

  it("counts wall clock from start for an active session", () => {
    expect(elapsedSeconds(session(), t(25))).toBe(1500);
  });

  it("subtracts banked paused_seconds", () => {
    expect(elapsedSeconds(session({ paused_seconds: 300 }), t(25))).toBe(1200);
  });

  it("freezes at the pause moment when paused (last_resumed_at anchors)", () => {
    const s = session({ status: "paused", paused_seconds: 120, last_resumed_at: new Date(t(20)).toISOString() });
    // Window = 20 min = 1200s; minus 120s paused = 1080s, regardless of now.
    expect(elapsedSeconds(s, t(60))).toBe(1080);
  });

  it("clamps to 12h", () => {
    expect(elapsedSeconds(session(), t(60 * 24))).toBe(12 * 3600);
  });

  it("never negative when paused_seconds exceed window", () => {
    expect(elapsedSeconds(session({ paused_seconds: 999999 }), t(1))).toBe(0);
  });
});
