/** Time-of-day greeting, computed from an IANA timezone to stay correct
 *  regardless of the viewer's machine timezone. Falls back gracefully. */

export type Greeting = "Good morning" | "Good afternoon" | "Good evening";

export function timeGreeting(timeZone?: string, now: Date = new Date()): Greeting {
  let hour: number;
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: timeZone || undefined,
      }).format(now),
    );
  } catch {
    hour = now.getHours(); // invalid zone string — use local clock
  }
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Formats today's date for the dashboard header in the given timezone. */
export function formatToday(timeZone?: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: timeZone || undefined,
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(now);
  }
}
