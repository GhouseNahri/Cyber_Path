/** Timezone-aware "today" helpers.
 *
 *  The user's day boundary comes from profiles.timezone (an IANA name like
 *  "Asia/Kolkata"), never from the server's clock — otherwise "today"
 *  shifts for users in other timezones and the daily mission silently
 *  misaligns. All functions here return plain date keys ("YYYY-MM-DD") or
 *  ISO instants; nothing depends on the server's local time.
 */

function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    // Throws for unknown zone names.
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The user's local calendar day as "YYYY-MM-DD" (en-CA gives ISO order). */
export function dayKeyFor(timezone: string | null | undefined, now: Date = new Date()): string {
  const tz = isValidTimezone(timezone) ? timezone : "UTC";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Minutes elapsed since local midnight in the user's timezone. */
export function minutesSinceLocalMidnight(timezone: string | null | undefined, now: Date = new Date()): number {
  const tz = isValidTimezone(timezone) ? timezone : "UTC";
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = fmt.format(now).split(":").map((x) => Number.parseInt(x, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

/** True when it's already "evening" locally (8 PM+) — used for gentle nudges. */
export function isEveningLocal(timezone: string | null | undefined, now: Date = new Date()): boolean {
  return minutesSinceLocalMidnight(timezone, now) >= 20 * 60;
}

/** Shift a "YYYY-MM-DD" day key by n days (calendar arithmetic on UTC noon
 *  so DST shifts can't skip or repeat a date). */
export function shiftDayKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map((x) => Number.parseInt(x, 10));
  if (!y || !m || !d) return dayKey;
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Last n day keys ending at (and including) `endKey`, oldest first. */
export function dayKeyRange(endKey: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftDayKey(endKey, -(n - 1 - i)));
}
