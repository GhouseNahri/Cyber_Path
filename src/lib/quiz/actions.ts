"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setStage } from "@/lib/roadmap/actions";
import { nextAttemptNumber, scoreSubmission, validateAnswers } from "./engine";
import type { QuizChoice } from "./engine";

export type SubmitResult =
  | {
      ok: true;
      passed: boolean;
      scorePct: number;
      correctCount: number;
      total: number;
      attemptNumber: number;
      /** Per-question correctness + explanations for the results view. */
      review: { position: number; correct: boolean; correctChoiceId: string; chosen: string | null; explanation: string }[];
    }
  | { ok: false; error: string };

type QuestionRow = {
  position: number;
  kind: string;
  question: string;
  choices: unknown;
  answer_index: number;
  explanation: string;
};

/**
 * Score a quiz attempt. Authoritative scoring happens here, server-side:
 * questions are loaded WITH answers, the payload is validated, the score is
 * computed against the live question table, and only then is an attempt row
 * inserted (owner-only RLS). On a pass, the topic's Test stage is marked via
 * the existing roadmap action - so completion and revision scheduling flow
 * through the one real path. Returns per-question review data either way.
 */
export async function submitQuizAttempt(topicSlug: string, answers: unknown): Promise<SubmitResult> {
  if (typeof topicSlug !== "string" || topicSlug.length === 0 || topicSlug.length > 120) {
    return { ok: false, error: "Unknown topic." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired - sign in again." };

  // Load questions WITH the answer key (server-side only).
  const qRes = await supabase
    .from("quiz_questions")
    .select("position, kind, question, choices, answer_index")
    .eq("topic_slug", topicSlug)
    .order("position");

  const rows = (qRes.data ?? []) as unknown as QuestionRow[];
  if (qRes.error || rows.length === 0) {
    return { ok: false, error: "This topic has no quiz yet." };
  }

  // Parse + validate choices first (guards answer_index).
  const parsed: { choices: QuizChoice[]; answer_index: number; position: number; explanation: string }[] = [];
  for (const r of rows) {
    if (!Array.isArray(r.choices) || r.choices.length === 0) {
      return { ok: false, error: "Quiz data is malformed - try again later." };
    }
    const choices: QuizChoice[] = [];
    for (const c of r.choices) {
      const o = c as Record<string, unknown>;
      if (typeof o?.id !== "string" || typeof o?.text !== "string") {
        return { ok: false, error: "Quiz data is malformed - try again later." };
      }
      choices.push({ id: o.id, text: o.text });
    }
    const idx = r.answer_index;
    if (!Number.isInteger(idx) || idx < 0 || idx >= choices.length) {
      return { ok: false, error: "Quiz data is malformed - try again later." };
    }
    parsed.push({ choices, answer_index: idx, position: r.position, explanation: r.explanation });
  }

  // Validate the submitted payload against these exact questions.
  const choiceIdSets = parsed.map((p) => new Set(p.choices.map((c) => c.id)));
  const valid = validateAnswers(answers, parsed.length, choiceIdSets);
  if (!valid) {
    return { ok: false, error: "That submission does not match this quiz. Reload the page and try again." };
  }

  // Score against the live answer key.
  const scored = scoreSubmission(
    parsed.map((p) => ({ choices: p.choices, answer_index: p.answer_index })),
    valid,
  );

  // Attempt numbering: max+1 (unique constraint guards races).
  const aRes = await supabase
    .from("quiz_attempts")
    .select("attempt_number")
    .eq("topic_slug", topicSlug)
    .eq("user_id", user.id);
  const existing = ((aRes.data ?? []) as unknown as { attempt_number: number }[]).map((r) => r.attempt_number);
  const attemptNumber = nextAttemptNumber(existing);

  const { error: insErr } = await supabase.from("quiz_attempts").insert({
    user_id: user.id,
    topic_slug: topicSlug,
    attempt_number: attemptNumber,
    score_pct: scored.scorePct,
    passed: scored.passed,
    answers: valid,
  });
  if (insErr) {
    // Unique violation from a concurrent attempt: report cleanly, no retry loop.
    if (insErr.code === "23505") {
      return { ok: false, error: "That attempt was already recorded. Reload to see your result." };
    }
    return { ok: false, error: "Could not save the attempt. Try again in a moment." };
  }

  // On a pass, mark the Test stage through the existing roadmap path.
  if (scored.passed) {
    const res = await setStage(topicSlug, "test", true);
    if (!res.ok) {
      return {
        ok: true,
        passed: scored.passed,
        scorePct: scored.scorePct,
        correctCount: scored.correctCount,
        total: scored.total,
        attemptNumber,
        review: parsed.map((p, i) => ({
          position: p.position,
          correct: valid[i] === p.choices[p.answer_index]?.id,
          correctChoiceId: p.choices[p.answer_index]?.id ?? "",
          chosen: valid[i] ?? null,
          explanation: p.explanation,
        })),
      };
    }
    revalidatePath("/roadmap");
    revalidatePath(`/roadmap/${topicSlug}`);
    revalidatePath("/");
  }

  return {
    ok: true,
    passed: scored.passed,
    scorePct: scored.scorePct,
    correctCount: scored.correctCount,
    total: scored.total,
    attemptNumber,
    review: parsed.map((p, i) => ({
      position: p.position,
      correct: valid[i] === p.choices[p.answer_index]?.id,
      correctChoiceId: p.choices[p.answer_index]?.id ?? "",
      chosen: valid[i] ?? null,
      explanation: p.explanation,
    })),
  };
}
