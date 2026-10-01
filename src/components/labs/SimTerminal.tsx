"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { resetSim, runSimCommand } from "@/lib/labs/sim";

type GoalView = { id: string; description: string; done: boolean };

type Line = { kind: "input" | "output" | "error" | "system"; text: string };

/**
 * Terminal UI for built-in simulations. Renders history + a prompt input;
 * every command goes to the runSimCommand server action, which evaluates it
 * against the user's persisted virtual filesystem. No real shell anywhere.
 */
export function SimTerminal({
  slug,
  brief,
  notes,
  initialGoals,
  initialHistory,
  promptUser,
  completed,
}: {
  slug: string;
  brief: string;
  notes: string[];
  initialGoals: GoalView[];
  initialHistory: Line[];
  promptUser: string;
  completed: boolean;
}) {
  const [lines, setLines] = useState<Line[]>(initialHistory);
  const [goals, setGoals] = useState<GoalView[]>(initialGoals);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [isComplete, setIsComplete] = useState(completed);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const push = (kind: Line["kind"], text: string) => setLines((prev) => [...prev, { kind, text }]);

  const run = (raw: string) => {
    const cmd = raw.trim();
    push("input", cmd);
    setInput("");
    if (cmd.length === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await runSimCommand(slug, cmd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      for (const line of res.output) push(line.length > 0 ? "output" : "output", line);
      if (!res.commandOk && res.output.length === 0) push("error", "command failed");
      setGoals(res.goals);
      if (res.allGoalsDone && !isComplete) {
        setIsComplete(true);
        push("system", "All objectives complete — lab marked completed. Nice work.");
      }
    });
  };

  const reset = () => {
    setError(null);
    startTransition(async () => {
      const res = await resetSim(slug);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGoals(res.goals);
      setIsComplete(false);
      setLines([{ kind: "system", text: "Simulation reset — fresh filesystem, same objectives." }]);
      inputRef.current?.focus();
    });
  };

  const doneCount = goals.filter((g) => g.done).length;

  return (
    <div className="space-y-4">
      {/* Objectives */}
      <div className="rounded-xl border border-hairline bg-canvas-raised p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[15px] font-semibold">Objectives</h3>
          <span className="font-mono text-[12px] text-ink-low">
            {doneCount}/{goals.length}
          </span>
        </div>
        <ul className="mt-2.5 space-y-1.5">
          {goals.map((g) => (
            <li key={g.id} className="flex items-start gap-2.5 text-sm">
              <span
                role="checkbox"
                aria-checked={g.done}
                aria-label={`${g.description} — ${g.done ? "complete" : "not complete"}`}
                tabIndex={0}
                className={`mt-0.5 font-mono ${g.done ? "text-ok" : "text-ink-low"}`}
              >
                {g.done ? "[x]" : "[ ]"}
              </span>
              <span className={g.done ? "text-ink-medium line-through decoration-hairline" : "text-ink-high"}>
                {g.description}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Terminal */}
      <div className="overflow-hidden rounded-xl border border-hairline bg-canvas">
        <div className="flex items-center justify-between border-b border-hairline bg-canvas-raised px-4 py-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink-low">simulated shell — nothing here touches a real system</span>
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="font-mono text-[11px] text-ink-medium hover:text-ink-high disabled:opacity-50"
          >
            reset
          </button>
        </div>
        <div
          ref={scrollRef}
          className="h-[380px] overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed"
          role="log"
          aria-label="Simulation terminal output"
        >
          <p className="text-ink-medium">{brief}</p>
          {lines.map((l, i) =>
            l.kind === "input" ? (
              <p key={i} className="mt-1.5 text-accent">
                {`${promptUser}@sim:~$ ${l.text}`}
              </p>
            ) : l.kind === "error" ? (
              <p key={i} className="text-danger">
                {l.text}
              </p>
            ) : l.kind === "system" ? (
              <p key={i} className="mt-1.5 text-ok">
                {l.text}
              </p>
            ) : (
              <p key={i} className="whitespace-pre-wrap text-ink-high">
                {l.text}
              </p>
            ),
          )}
          {pending ? <p className="text-ink-low">…</p> : null}
        </div>
        <div className="border-t border-hairline bg-canvas-raised px-4 py-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(input);
            }}
            className="flex items-center gap-2"
          >
            <span aria-hidden className="font-mono text-[13px] text-accent">
              {`${promptUser}@sim:~$`}
            </span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              aria-label="Type a command"
              className="flex-1 bg-transparent font-mono text-[13px] text-ink-high outline-none placeholder:text-ink-low"
              placeholder={isComplete ? "done — try 'ls', or reset to replay" : "type 'help' to begin"}
            />
          </form>
        </div>
      </div>

      {/* Teaching notes */}
      <div className="rounded-xl border border-hairline bg-canvas-raised p-4">
        <h3 className="font-display text-[15px] font-semibold">How to work the shell</h3>
        <ul className="mt-2 space-y-1.5">
          {notes.map((n) => (
            <li key={n} className="flex items-start gap-2 text-sm text-ink-medium">
              <span aria-hidden className="mt-0.5 text-accent">
                ▹
              </span>
              {n}
            </li>
          ))}
        </ul>
        {error ? (
          <p role="alert" className="mt-3 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
      </div>

      {isComplete ? (
        <div className="rounded-xl border border-ok/30 bg-ok/10 p-4 text-sm text-ok">
          Lab complete — the objective was validated server-side. Time to reflect: what did the denials teach you?
        </div>
      ) : null}
    </div>
  );
}
