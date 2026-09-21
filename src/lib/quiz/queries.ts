import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { QuizChoice } from "./engine";

/** A question as the CLIENT may see it: no answer, ever. */
export type ClientQuestion = {
  position: number;
  kind: "mcq" | "tf" | "scenario";
  question: string;
  choices: QuizChoice[];
};

export type AttemptSummary = {
  attempt_number: number;
  score_pct: number;
  passed: boolean;
  completed_at: string;
};

export type QuizData =
  | { ok: true; hasQuiz: true; questions: ClientQuestion[]; attempts: AttemptSummary[]; bestPct: number | null; passed: boolean }
  | { ok: true; hasQuiz: false; questions: []; attempts: []; bestPct: null; passed: false }
  | { ok: false; missingSchema: true };

function parseChoices(raw: unknown): QuizChoice[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: QuizChoice[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") return null;
    const o = c as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.text !== "string") return null;
    out.push({ id: o.id, text: o.text });
  }
  return out;
}

/**
 * Per-topic quiz state: client-safe questions (answer stripped server-side)
 * plus the viewer's own attempt history. Never selects answer_index for
 * client delivery.
 */
export const getQuizForTopic = cache(async (topicSlug: string): Promise<QuizData> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, missingSchema: true };

  const qRes = await supabase
    .from("quiz_questions")
    .select("position, kind, question, choices")
    .eq("topic_slug", topicSlug)
    .order("position");

  if (qRes.error) {
    if (qRes.error.code === "42P01") return { ok: false, missingSchema: true };
    return { ok: false, missingSchema: true };
  }

  const rows = (qRes.data ?? []) as unknown as {
    position: number;
    kind: string;
    question: string;
    choices: unknown;
  }[];

  if (rows.length === 0) {
    return { ok: true, hasQuiz: false, questions: [], attempts: [], bestPct: null, passed: false };
  }

  const questions: ClientQuestion[] = [];
  for (const r of rows) {
    const choices = parseChoices(r.choices);
    if (!choices) continue;
    questions.push({
      position: r.position,
      kind: (["mcq", "tf", "scenario"] as const).includes(r.kind as "mcq")
        ? (r.kind as ClientQuestion["kind"])
        : "mcq",
      question: r.question,
      choices,
    });
  }
  if (questions.length === 0) {
    return { ok: true, hasQuiz: false, questions: [], attempts: [], bestPct: null, passed: false };
  }

  const aRes = await supabase
    .from("quiz_attempts")
    .select("attempt_number, score_pct, passed, completed_at")
    .eq("topic_slug", topicSlug)
    .eq("user_id", user.id)
    .order("attempt_number");

  const attempts = (aRes.data ?? []) as unknown as AttemptSummary[];
  const bestPct = attempts.length > 0 ? Math.max(...attempts.map((a) => a.score_pct)) : null;
  const passed = attempts.some((a) => a.passed);

  return { ok: true, hasQuiz: true, questions, attempts, bestPct, passed };
});
