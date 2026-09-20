import { describe, expect, it } from "vitest";
import { dayKeyFor, shiftDayKey, dayKeyRange, isEveningLocal } from "./day";

describe("dayKeyFor", () => {
  it("uses the user's timezone, not the server's", () => {
    // 20 Sep 23:55 IST == 18:25 UTC → local day is the 20th in IST.
    const justBeforeMidnightIst = new Date("2026-09-20T18:25:00Z");
    expect(dayKeyFor("Asia/Kolkata", justBeforeMidnightIst)).toBe("2026-09-20");

    // 10 minutes later: 00:35 IST on the 21st — the day must roll over.
    const justAfterMidnightIst = new Date("2026-09-20T19:05:00Z");
    expect(dayKeyFor("Asia/Kolkata", justAfterMidnightIst)).toBe("2026-09-21");
  });

  it("falls back to UTC for invalid timezones", () => {
    expect(dayKeyFor("Not/AZone", new Date("2026-09-20T23:55:00Z"))).toBe("2026-09-20");
  });
});

describe("shiftDayKey / dayKeyRange", () => {
  it("shifts across month boundaries", () => {
    expect(shiftDayKey("2026-10-01", -1)).toBe("2026-09-30");
    expect(shiftDayKey("2026-09-30", 1)).toBe("2026-10-01");
  });

  it("produces an ordered range of n keys ending at endKey", () => {
    const range = dayKeyRange("2026-09-20", 7);
    expect(range).toHaveLength(7);
    expect(range[0]).toBe("2026-09-14");
    expect(range[6]).toBe("2026-09-20");
  });
});

describe("isEveningLocal", () => {
  it("detects evening in the user's timezone", () => {
    // 20 Sep 21:00 IST == 15:30 UTC → evening in IST.
    expect(isEveningLocal("Asia/Kolkata", new Date("2026-09-20T15:30:00Z"))).toBe(true);
    // 20 Sep 18:00 IST == 12:30 UTC → afternoon.
    expect(isEveningLocal("Asia/Kolkata", new Date("2026-09-20T12:30:00Z"))).toBe(false);
  });
});
