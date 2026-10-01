"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui/Input";
import { resetProgress, type ResetSummary } from "@/lib/settings/resetProgress";

const CONFIRM_TEXT = "RESET";

type Stage = "closed" | "scope" | "confirm" | "busy" | "done" | "error";

const CORE_LIST = [
  "Roadmap progress — topic status, stages and confidence ratings",
  "Labs — tracker, completions, attempts, evidence and simulations",
  "Daily tasks — today's mission and all generated history",
  "Study sessions — history, durations and counts",
  "Streaks — computed from sessions/tasks, so they restart at zero",
  "Missed-day reports and their reasons",
  "Quiz attempts and weak-topic analysis",
  "Spaced-repetition (revision) schedule — re-seeded automatically",
];

const OPTIONAL_LIST = [
  { key: "resetProjects", label: "Projects tracker", what: "your project entries (GitHub/demo links stay on GitHub)" },
  { key: "resetNotes", label: "Topic notes", what: "notes you wrote on topics" },
  { key: "resetBookmarks", label: "Bookmarks", what: "saved/bookmarked topics" },
  { key: "resetResources", label: "Resource statuses", what: "saved/done/skip marks on resources" },
] as const;

type OptionalKey = (typeof OPTIONAL_LIST)[number]["key"];

const SUMMARY_ROWS: { key: keyof ResetSummary; label: string }[] = [
  { key: "topic_progress", label: "topic progress rows" },
  { key: "labs", label: "lab tracker rows (with attempts + evidence)" },
  { key: "lab_sim_states", label: "saved simulation states" },
  { key: "daily_tasks", label: "daily tasks" },
  { key: "study_sessions", label: "study sessions" },
  { key: "missed_days", label: "missed days" },
  { key: "quiz_attempts", label: "quiz attempts" },
  { key: "topic_reviews", label: "revision entries" },
  { key: "projects", label: "projects" },
  { key: "notes", label: "notes" },
  { key: "bookmarks", label: "bookmarks" },
  { key: "resource_status", label: "resource statuses" },
];

/** Settings → Danger zone: staged, confirmable reset of learning progress. */
export function DangerZone() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("closed");
  const [opts, setOpts] = useState<Record<OptionalKey, boolean>>({
    resetProjects: false,
    resetNotes: false,
    resetBookmarks: false,
    resetResources: false,
  });
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ResetSummary | null>(null);

  // Escape closes the dialog (except while a request is in flight).
  useEffect(() => {
    if (stage === "closed") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && stage !== "busy") setStage("closed");
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [stage]);

  const optionalSelected = Object.values(opts).some(Boolean);

  function openScope() {
    setError(null);
    setConfirmText("");
    setStage("scope");
  }

  function cancel() {
    if (stage === "busy") return; // in-flight request cannot be cancelled
    setStage("closed");
    setError(null);
  }

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    if (confirmText !== CONFIRM_TEXT || stage === "busy") return;
    setStage("busy");
    setError(null);
    const res = await resetProgress(opts);
    if (res.ok) {
      setSummary(res.summary ?? null);
      setStage("done");
      router.refresh(); // server components re-render from fresh DB state
    } else {
      setError(res.error);
      setStage("error");
    }
  }

  return (
    <div>
      {stage === "closed" && !summary ? (
        <div className="rounded-xl border border-danger/30 bg-danger/[0.06] p-5">
          <p className="font-display text-base font-semibold text-danger">Danger zone</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-medium">
            Reset your learning progress and start the roadmap fresh. Your account, login and
            settings are not deleted.
          </p>
          <Button variant="danger" size="sm" className="mt-4" onClick={openScope}>
            Reset learning progress
          </Button>
        </div>
      ) : null}

      {stage !== "closed" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
        >
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-hairline bg-surface-1 p-6 shadow-lift">
            {stage === "scope" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setStage("confirm");
                }}
              >
                <h3 id="reset-dialog-title" className="font-display text-lg font-semibold text-ink-high">
                  Reset learning progress
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-medium">This permanently clears:</p>
                <ul className="mt-2 space-y-1 text-[13px] text-ink-medium">
                  {CORE_LIST.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span aria-hidden="true" className="text-danger">✕</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 text-sm font-medium text-ink-high">Also include (optional):</p>
                <div className="mt-2 space-y-2">
                  {OPTIONAL_LIST.map((o) => (
                    <label
                      key={o.key}
                      className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-hairline bg-surface-2/50 p-3 text-[13px] text-ink-high hover:border-accent/40"
                    >
                      <input
                        type="checkbox"
                        checked={opts[o.key]}
                        onChange={(e) => setOpts({ ...opts, [o.key]: e.target.checked })}
                        className="mt-0.5 size-4 accent-danger"
                      />
                      <span>
                        <span className="font-medium">{o.label}</span>
                        <span className="block text-xs text-ink-medium">{o.what}</span>
                      </span>
                    </label>
                  ))}
                </div>

                <p className="mt-4 rounded-lg border border-hairline bg-surface-2/60 p-3 text-xs leading-relaxed text-ink-medium">
                  Never deleted: your account and login, profile and onboarding choices, theme,
                  GitHub connection, your public-portfolio setting, and all roadmap/lab content
                  (shared by everyone).
                </p>

                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={cancel}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="danger">
                    Continue
                  </Button>
                </div>
              </form>
            ) : null}

            {stage === "confirm" || stage === "busy" ? (
              <form onSubmit={onConfirm}>
                <h3 id="reset-dialog-title" className="font-display text-lg font-semibold text-ink-high">
                  Confirm reset
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-medium">
                  {optionalSelected ? "You included optional data. " : null}
                  Type <span className="font-mono font-semibold text-danger">{CONFIRM_TEXT}</span> to confirm.
                </p>
                <Input
                  label={`Type "${CONFIRM_TEXT}" to confirm`}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-4"
                />
                {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" variant="ghost" disabled={stage === "busy"} onClick={() => setStage("scope")}>
                    Back
                  </Button>
                  <Button type="submit" variant="danger" disabled={confirmText !== CONFIRM_TEXT || stage === "busy"}>
                    {stage === "busy" ? "Resetting…" : "Reset everything selected"}
                  </Button>
                </div>
              </form>
            ) : null}

            {stage === "done" ? (
              <div>
                <h3 id="reset-dialog-title" className="font-display text-lg font-semibold text-ok">
                  Progress reset
                </h3>
                <p className="mt-2 text-sm text-ink-medium">
                  Your learning progress is cleared. The dashboard now reflects a fresh start.
                </p>
                {summary ? (
                  <ul className="mt-3 space-y-1 font-mono text-xs text-ink-medium">
                    {SUMMARY_ROWS.filter((r) => (summary[r.key] ?? 0) > 0).map((r) => (
                      <li key={r.key}>
                        {summary[r.key]} {r.label}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-5 flex justify-end">
                  <Button onClick={cancel}>Back to settings</Button>
                </div>
              </div>
            ) : null}

            {stage === "error" ? (
              <div>
                <h3 id="reset-dialog-title" className="font-display text-lg font-semibold text-danger">
                  Reset failed
                </h3>
                <p className="mt-2 text-sm text-ink-medium">{error}</p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={cancel}>
                    Cancel
                  </Button>
                  <Button type="button" variant="danger" onClick={() => setStage("confirm")}>
                    Try again
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
