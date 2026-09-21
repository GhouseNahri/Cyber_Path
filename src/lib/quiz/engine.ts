/**
 * Pure quiz math and payload validation. The single source of truth for the
 * pass rule; both the submit action (authoritative) and the UI can use it.
 *
 * Scoring happens ONLY server-side: the client never sees answer_index.
 */

export type QuizChoice = { id: string; text: string };

export type ScoredQuestion = {
  position: number;
  kind: string;
  question: string;
  choices: QuizChoice[];
  /** null = unanswered/invalid submission for that question (scored wrong). */
  chosen: string | null;
  correctChoiceId: string;
  correct: boolean;
  explanation: string;
};

export type AttemptScore = {
  correctCount: number;
  total: number;
  scorePct: number;
  passed: boolean;
};

/** Pass threshold: at least 70% (rounded). */
export const PASS_PCT = 70;

/** round(correct / total * 100), then compare to PASS_PCT. */
export function pctScore(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

export function pctPasses(scorePct: number): boolean {
  return scorePct >= PASS_PCT;
}

/**
 * Validate a submitted answers payload: an array of choice ids (or null),
 * same length as the questions, each id either null or present among that
 * question's choices, no duplicates. Returns null when the payload is
 * malformed — the action then rejects rather than guesses.
 */
export function validateAnswers(
  answers: unknown,
  questionCount: number,
  choiceIdSets: ReadonlySet<string>[],
): (string | null)[] | null {
  if (!Array.isArray(answers) || answers.length !== questionCount) return null;
  const out: (string | null)[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < answers.length; i++) {
    const a = answers[i];
    if (a === null || a === undefined) {
      out.push(null);
      continue;
    }
    if (typeof a !== "string") return null;
    if (seen.has(a)) return null; // same choice picked twice
    seen.add(a);
    if (!choiceIdSets[i]?.has(a)) return null; // id not among the choices
    out.push(a);
  }
  return out;
}

/**
 * Score a submission against questions that carry the answer.
 * `answers[i]` is the chosen choice id for questions[i], or null when
 * the question was left unanswered (counts as incorrect).
 */
export function scoreSubmission(
  questions: { choices: QuizChoice[]; answer_index: number }[],
  answers: (string | null)[],
): AttemptScore {
  let correct = 0;
  const total = questions.length;
  for (let i = 0; i < total; i++) {
    const q = questions[i];
    if (!q) continue;
    const chosen = answers[i] ?? null;
    const correctId = q.choices[q.answer_index]?.id;
    if (chosen && correctId && chosen === correctId) correct++;
  }
  const scorePct = pctScore(correct, total);
  return { correctCount: correct, total, scorePct, passed: pctPasses(scorePct) };
}

/** Attempt numbering: next = max(existing) + 1, starting at 1. */
export function nextAttemptNumber(existing: number[]): number {
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}
