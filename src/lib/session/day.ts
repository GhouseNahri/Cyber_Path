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
