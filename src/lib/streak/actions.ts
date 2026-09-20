"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { dayKeyFor, dayKeyRange } from "@/lib/session/day";
import type { ActionResult } from "@/lib/roadmap/actions";
import type { MissedReasonCategory } from "./messages";

const REASONS: ReadonlySet<string> = new Set([
  "no_time", "too_tired", "college_work", "didnt_understand", "task_too_difficult",
  "lost_motivation", "forgot", "technical_problem", "personal", "other",
]);

/** Record (or update) a missed-day self-report. Upsert keyed (user_id, day_key). */
export async function recordMissedDay(input: {
  dayKey: string;
  reason: string;
  text?: string;
}): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  if (!REASONS.has(input.reason)) {
    return { ok: false, error: "Pick a reason from the list." };
  }

  const supabase = await createClient();
  const todayKey = dayKeyFor(profile.timezone);
  // Accept yesterday or today only — the prompt never asks about older days.
  const allowed = new Set(dayKeyRange(todayKey, 2));
  if (!allowed.has(input.dayKey)) {
    return { ok: false, error: "That day can't be reported." };
  }

  const { error } = await supabase.from("missed_days").upsert({
    user_id: profile.id,
    day_key: input.dayKey,
    reason_category: input.reason,
    reason_text: input.text?.trim() ? input.text.trim().slice(0, 500) : null,
  });

  if (error) return { ok: false, error: "Could not save your note. Try again." };

  revalidatePath("/", "layout");
  return { ok: true };
}
