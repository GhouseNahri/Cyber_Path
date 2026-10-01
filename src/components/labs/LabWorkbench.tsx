"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardHeader } from "@/components/ui";
import { logLabTime, revealHint, saveLabNotes, toggleLabTask } from "@/lib/labs/actions";
import type { LabHint } from "@/lib/labs/engine";

export function LabWorkbench({
  userLabId,
  tasks,
  tasksDone,
  hints,
  hintsRevealed,
  minutesSpent,
  notes,
}: {
  userLabId: string;
  tasks: { id: string; position: number; title: string; detail: string | null }[];
  tasksDone: number[];
  hints: LabHint[];
  hintsRevealed: number;
  minutesSpent: number;
  notes: string;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<number[]>(tasksDone);
  const [revealed, setRevealed] = useState(hintsRevealed);
  const [minutes, setMinutes] = useState(minutesSpent);
  const [noteText, setNoteText] = useState(notes);
  const [savedNotes, setSavedNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTask = (index: number) => {
    setError(null);
    const next = done.includes(index) ? done.filter((i) => i !== index) : [...done, index];
    setDone(next);
    startTransition(async () => {
      const res = await toggleLabTask(userLabId, index, tasks.length);
      if (!res.ok) {
        setDone(done); // revert on failure
        setError(res.error ?? "Could not update the task.");
      }
    });
  };

  const reveal = () => {
    setError(null);
    const next = Math.min(revealed + 1, hints.length);
    setRevealed(next);
    startTransition(async () => {
      const res = await revealHint(userLabId, next);
      if (!res.ok) {
        setRevealed(revealed);
        setError(res.error ?? "Could not reveal the hint.");
      }
    });
  };

  const logTime = (m: number) => {
    setError(null);
    setMinutes((v) => v + m);
    startTransition(async () => {
      const res = await logLabTime(userLabId, m);
      if (!res.ok) {
        setMinutes((v) => Math.max(0, v - m));
        setError(res.error ?? "Could not log time.");
      }
    });
  };

  const saveNotes = () => {
    setError(null);
    setSavedNotes(false);
    startTransition(async () => {
      const res = await saveLabNotes(userLabId, noteText);
      if (res.ok) setSavedNotes(true);
      else setError(res.error ?? "Could not save notes.");
    });
  };

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      {tasks.length > 0 ? (
        <Card>
          <CardHeader
            title="Tasks"
            subtitle={`${done.length}/${tasks.length} done — checkboxes save as you work`}
          />
          <ul className="space-y-2">
            {tasks.map((t, i) => (
              <li key={t.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-hairline bg-canvas px-3 py-2.5 transition-colors hover:border-ink-low">
                  <input
                    type="checkbox"
                    checked={done.includes(i)}
                    disabled={pending}
                    onChange={() => toggleTask(i)}
                    className="mt-0.5 size-4 accent-accent"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink-high">
                      {String(i + 1).padStart(2, "0")}. {t.title}
                    </span>
                    {t.detail ? <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-medium">{t.detail}</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {hints.length > 0 ? (
        <Card>
          <CardHeader title="Hints" subtitle={`${revealed}/${hints.length} revealed — tiered, so try before you peek`} />
          <div className="space-y-2">
            {hints.slice(0, revealed).map((h) => (
              <div key={h.tier} className="rounded-lg border border-hairline bg-surface-2 px-3 py-2.5">
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink-low">Hint {h.tier}</span>
                <p className="mt-1 font-mono text-[13px] leading-relaxed text-ink-high">{h.text}</p>
              </div>
            ))}
            {revealed < hints.length ? (
              <Button size="sm" variant="secondary" disabled={pending} onClick={reveal}>
                Reveal hint {revealed + 1}
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Practical time" subtitle={`${minutes} min logged — be honest, it feeds analytics`} />
        <div className="flex flex-wrap items-center gap-2">
          {[15, 30, 60].map((m) => (
            <Button key={m} size="sm" variant="secondary" disabled={pending} onClick={() => logTime(m)}>
              +{m}m
            </Button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Working notes" subtitle="Private — commands that worked, dead ends, evidence" />
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={6}
          maxLength={20000}
          placeholder="What you ran, what broke, what you found…"
          className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2.5 font-mono text-[13px] leading-relaxed text-ink-high placeholder:text-ink-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" disabled={pending} onClick={saveNotes}>
            {pending ? "Saving…" : "Save notes"}
          </Button>
          {savedNotes ? <span className="font-mono text-[12px] text-ok">Saved ✓</span> : null}
        </div>
      </Card>
    </div>
  );
}
