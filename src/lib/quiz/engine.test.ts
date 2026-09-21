import { describe, expect, it } from "vitest";
import {
  nextAttemptNumber,
  pctPasses,
  pctScore,
  scoreSubmission,
  validateAnswers,
  type QuizChoice,
} from "./engine";

const ch = (id: string): QuizChoice => ({ id, text: `choice ${id}` });
const q3 = {
  choices: [ch("a"), ch("b"), ch("c"), ch("d")],
  answer_index: 2,
};

describe("pctScore / pctPasses", () => {
  it("rounds correctly and applies the 70% rule", () => {
    expect(pctScore(0, 0)).toBe(0);
    expect(pctScore(2, 3)).toBe(67);
    expect(pctScore(3, 3)).toBe(100);
    expect(pctScore(7, 10)).toBe(70);
    expect(pctScore(6, 10)).toBe(60);
    expect(pctPasses(67)).toBe(false);
    expect(pctPasses(70)).toBe(true);
    expect(pctPasses(100)).toBe(true);
  });
});

describe("validateAnswers", () => {
  const sets = [new Set(["a", "b"]), new Set(["yes", "no"]), new Set(["a", "b", "c"])];
  it("accepts valid submissions incl. unanswered", () => {
    expect(validateAnswers(["a", null, "c"], 3, sets)).toEqual(["a", null, "c"]);
    expect(validateAnswers([null, null, null], 3, sets)).toEqual([null, null, null]);
  });
  it("allows the same id on different questions (ids are per-question local)", () => {
    expect(validateAnswers(["a", "yes", "a"], 3, sets)).toEqual(["a", "yes", "a"]);
  });
  it("treats undefined entries as unanswered", () => {
    expect(validateAnswers(["a", undefined, "b"], 3, sets)).toEqual(["a", null, "b"]);
  });
  it("rejects wrong length, foreign ids, non-strings", () => {
    expect(validateAnswers(["a"], 3, sets)).toBeNull();
    expect(validateAnswers(["a", "yes", "z"], 3, sets)).toBeNull();
    expect(validateAnswers([1, "yes", "c"], 3, sets)).toBeNull();
    expect(validateAnswers("a,yes,c", 3, sets)).toBeNull();
  });
});

describe("scoreSubmission", () => {
  it("scores exact matches only; unanswered is wrong", () => {
    expect(scoreSubmission([q3, q3, q3], ["c", "a", null])).toEqual({
      correctCount: 1,
      total: 3,
      scorePct: 33,
      passed: false,
    });
    expect(scoreSubmission([q3, q3, q3], ["c", "c", "c"]).passed).toBe(true);
    expect(scoreSubmission([q3, q3, q3], ["a", "a", "a"]).scorePct).toBe(0);
  });
});

describe("nextAttemptNumber", () => {
  it("starts at 1 and increments past the max", () => {
    expect(nextAttemptNumber([])).toBe(1);
    expect(nextAttemptNumber([1])).toBe(2);
    expect(nextAttemptNumber([1, 5, 2])).toBe(6);
  });
});
