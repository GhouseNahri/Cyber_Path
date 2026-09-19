"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ProgressBar } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { EXPERIENCE_OPTIONS, ROLE_OPTIONS, STYLE_OPTIONS, TIME_OPTIONS } from "./options";

type Answers = {
  experience_level: string;
  daily_goal_minutes: number;
  target_roles: string[];
  learning_style: string;
};

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({
    experience_level: "",
    daily_goal_minutes: 45,
    target_roles: [],
    learning_style: "balanced",
  });

  const total = 4;

  function toggleRole(role: string) {
    setAnswers((a) => {
      const has = a.target_roles.includes(role);
      const next = has ? a.target_roles.filter((r) => r !== role) : [...a.target_roles, role];
      return { ...a, target_roles: next.slice(0, 3) };
    });
  }

  async function persist(onboardingCompleted: boolean) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Session expired — please sign in again.");

    const { error: err } = await supabase
      .from("profiles")
      .update({
        experience_level: answers.experience_level || "beginner",
        daily_goal_minutes: answers.daily_goal_minutes,
        target_roles: answers.target_roles,
        learning_style: answers.learning_style,
        timezone:
          typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC",
        onboarding_completed: onboardingCompleted,
      })
      .eq("id", user.id);

    if (err) throw err;
  }

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await persist(true);
      router.refresh();
      router.push("/");
    } catch (e) {
      setError(friendlyAuthError(e));
      setSaving(false);
    }
  }

  async function skip() {
    setSaving(true);
    setError(null);
    try {
      await persist(true); // skipping = don't ask again; defaults stay editable in Settings
      router.refresh();
      router.push("/");
    } catch (e) {
      setError(friendlyAuthError(e));
      setSaving(false);
    }
  }

  const canContinue =
    (step === 0 && answers.experience_level !== "") ||
    (step === 1 && answers.daily_goal_minutes > 0) ||
    (step === 2 && answers.target_roles.length > 0) ||
    step === 3;

  return (
    <div className="surface-card surface-glow p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-4">
        <ProgressBar value={(step / total) * 100} label={`Onboarding step ${step + 1} of ${total}`} />
        <span className="shrink-0 text-xs font-medium tabular-nums text-ink-medium">
          {step + 1} / {total}
        </span>
      </div>

      {step === 0 && (
        <fieldset>
          <legend className="font-display text-lg font-semibold text-ink-high">
            What&apos;s your current experience?
          </legend>
          <div className="mt-4 space-y-2.5">
            {EXPERIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAnswers((a) => ({ ...a, experience_level: opt.value }))}
                aria-pressed={answers.experience_level === opt.value}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  answers.experience_level === opt.value
                    ? "border-accent/60 bg-accent/10"
                    : "border-hairline bg-surface-2/60 hover:border-hairline-strong"
                }`}
              >
                <span className="block text-sm font-medium text-ink-high">{opt.label}</span>
                <span className="mt-0.5 block text-[13px] text-ink-medium">{opt.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {step === 1 && (
        <fieldset>
          <legend className="font-display text-lg font-semibold text-ink-high">How much time per day?</legend>
          <p className="mt-1 text-[13px] text-ink-medium">
            Daily missions are sized to fit. Be honest — consistency beats ambition.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {TIME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAnswers((a) => ({ ...a, daily_goal_minutes: opt.value }))}
                aria-pressed={answers.daily_goal_minutes === opt.value}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  answers.daily_goal_minutes === opt.value
                    ? "border-accent/60 bg-accent/10"
                    : "border-hairline bg-surface-2/60 hover:border-hairline-strong"
                }`}
              >
                <span className="block text-sm font-medium text-ink-high">{opt.label}</span>
                <span className="mt-0.5 block text-[13px] text-ink-medium">{opt.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {step === 2 && (
        <fieldset>
          <legend className="font-display text-lg font-semibold text-ink-high">
            Which areas interest you? <span className="text-ink-medium">(up to 3)</span>
          </legend>
          <p className="mt-1 text-[13px] text-ink-medium">
            Shapes your recommended branches — nothing is locked out.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((role) => {
              const selected = answers.target_roles.includes(role);
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  aria-pressed={selected}
                  className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    selected
                      ? "border-accent/60 bg-accent/15 text-accent-soft"
                      : "border-hairline bg-surface-2/60 text-ink-medium hover:border-hairline-strong hover:text-ink-high"
                  }`}
                >
                  {role}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {step === 3 && (
        <fieldset>
          <legend className="font-display text-lg font-semibold text-ink-high">How do you like to learn?</legend>
          <div className="mt-4 space-y-2.5">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAnswers((a) => ({ ...a, learning_style: opt.value }))}
                aria-pressed={answers.learning_style === opt.value}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  answers.learning_style === opt.value
                    ? "border-accent/60 bg-accent/10"
                    : "border-hairline bg-surface-2/60 hover:border-hairline-strong"
                }`}
              >
                <span className="block text-sm font-medium text-ink-high">{opt.label}</span>
                <span className="mt-0.5 block text-[13px] text-ink-medium">{opt.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-7 flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)} disabled={saving}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={skip} disabled={saving}>
            Skip for now
          </Button>
          {step < total - 1 ? (
            <Button size="sm" onClick={() => setStep((s) => s + 1)} disabled={!canContinue || saving}>
              Continue
            </Button>
          ) : (
            <Button size="sm" onClick={finish} disabled={saving}>
              {saving ? "Saving…" : "Start learning"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
