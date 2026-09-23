"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import type { Profile } from "@/lib/profile";

const TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Singapore",
  "Australia/Sydney",
];

const STUDY_TIMES = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
];

const STYLES = [
  { value: "practical", label: "Hands-on first" },
  { value: "balanced", label: "Balanced" },
  { value: "theory", label: "Theory first" },
];

export function SettingsForm({ profile, email }: { profile: Profile; email: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const [timezone, setTimezone] = useState(profile.timezone);
  const [dailyGoal, setDailyGoal] = useState(String(profile.daily_goal_minutes));
  const [studyTime, setStudyTime] = useState(profile.preferred_study_time ?? "evening");
  const [learningStyle, setLearningStyle] = useState(profile.learning_style ?? "balanced");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("idle");

    const goal = Number(dailyGoal);
    if (displayName.trim().length < 2) return setError("Name needs at least 2 characters.");
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username.trim()))
      return setError("Username must be 3–24 characters: letters, numbers, underscores.");
    if (!Number.isInteger(goal) || goal < 5 || goal > 480)
      return setError("Daily goal must be between 5 and 480 minutes.");

    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expired — please sign in again.");

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          username: username.trim().toLowerCase(),
          timezone,
          daily_goal_minutes: goal,
          preferred_study_time: studyTime,
          learning_style: learningStyle,
        })
        .eq("id", user.id);
      if (error) throw error;

      // Keep auth metadata (used by the user chip) in sync with the profile.
      // Username is synced too so the auth->profile trigger stays consistent.
      await supabase.auth.updateUser({
        data: { display_name: displayName.trim(), username: username.trim().toLowerCase() },
      });

      setStatus("saved");
      router.refresh();
    } catch (err) {
      setError(friendlyAuthError(err));
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          name="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={busy}
          required
        />
        <Input
          label="Username"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={busy}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tz" className="mb-1.5 block text-[13px] font-medium text-ink-high">
            Timezone
          </label>
          <select
            id="tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={busy}
            className="block h-11 w-full rounded-xl border border-hairline bg-surface-2/70 px-3 text-sm text-ink-high"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Daily goal (minutes)"
          name="daily-goal"
          type="number"
          min={5}
          max={480}
          step={5}
          value={dailyGoal}
          onChange={(e) => setDailyGoal(e.target.value)}
          disabled={busy}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-1.5 block text-[13px] font-medium text-ink-high">Preferred study time</legend>
          <div className="grid grid-cols-3 gap-2">
            {STUDY_TIMES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStudyTime(opt.value)}
                aria-pressed={studyTime === opt.value}
                className={`flex-1 rounded-xl border px-2 py-2.5 text-[13px] font-medium transition-colors ${
                  studyTime === opt.value
                    ? "border-accent/60 bg-accent/10 text-accent-soft"
                    : "border-hairline bg-surface-2/60 text-ink-medium hover:text-ink-high"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 block text-[13px] font-medium text-ink-high">Learning style</legend>
          <div className="grid grid-cols-3 gap-2">
            {STYLES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLearningStyle(opt.value)}
                aria-pressed={learningStyle === opt.value}
                className={`flex-1 rounded-xl border px-2 py-2.5 text-[13px] font-medium transition-colors ${
                  learningStyle === opt.value
                    ? "border-accent/60 bg-accent/10 text-accent-soft"
                    : "border-hairline bg-surface-2/60 text-ink-medium hover:text-ink-high"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      {status === "saved" ? (
        <p role="status" className="rounded-lg border border-ok/30 bg-ok/10 px-3.5 py-2.5 text-[13px] text-ok">
          Saved. Your dashboard and missions will use these preferences.
        </p>
        ) : null}

      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-xs text-ink-low">{email}</span>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
