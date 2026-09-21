"use client";

import { useState, useTransition } from "react";
import { Badge, Button, ProgressBar } from "@/components/ui";
import { deleteProject, setProjectStatus, toggleMilestone, updateProjectLinks } from "@/lib/projects/actions";
import { PROJECT_STATUSES, STATUS_LABEL, type ProjectStatus } from "@/lib/projects/engine";
import type { UserProject } from "@/lib/projects/queries";

const TONE: Record<ProjectStatus, "neutral" | "info" | "accent" | "ok"> = {
  idea: "neutral",
  planned: "info",
  building: "accent",
  completed: "ok",
  published: "ok",
};

/** The next forward status, or null when at the top of the ladder. */
function nextStatus(s: ProjectStatus): ProjectStatus | null {
  const i = PROJECT_STATUSES.indexOf(s);
  if (i < 0 || i >= PROJECT_STATUSES.length - 1) return null;
  return PROJECT_STATUSES[i + 1] ?? null;
}

export function ProjectCard({ project }: { project: UserProject }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [github, setGithub] = useState(project.github_url ?? "");
  const [demo, setDemo] = useState(project.demo_url ?? "");
  const [notes, setNotes] = useState(project.notes ?? "");

  const next = nextStatus(project.status);
  const hasMilestones = project.milestones.length > 0;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok && res.error) setError(res.error);
    });
  }

  return (
    <li className="rounded-xl border border-hairline bg-surface-2/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-ink-high">{project.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={TONE[project.status]}>{STATUS_LABEL[project.status]}</Badge>
            {project.completed_at ? (
              <span className="font-mono text-[11px] text-ink-low">done {project.completed_at.slice(0, 10)}</span>
            ) : null}
            {project.published_at ? (
              <span className="font-mono text-[11px] text-ink-low">published {project.published_at.slice(0, 10)}</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {next ? (
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() => run(() => setProjectStatus(project.id, next))}
            >
              Mark {STATUS_LABEL[next].toLowerCase()}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => setEditing((v) => !v)}>
            {editing ? "Close" : "Edit"}
          </Button>
        </div>
      </div>

      {hasMilestones ? (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-low">Milestones</p>
            <p className="font-mono text-[11px] text-ink-low">{project.progressPct}%</p>
          </div>
          <ProgressBar value={project.progressPct} label={`${project.title} progress`} size="sm" />
          <ul className="mt-3 space-y-1.5">
            {project.milestones.map((m, i) => {
              const done = project.milestones_done.includes(i);
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={pending}
                    aria-pressed={done}
                    onClick={() => run(() => toggleMilestone(project.id, i, project.milestones.length))}
                    className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                      done
                        ? "border-ok/30 bg-ok/[0.06] text-ink-medium line-through decoration-ok/60"
                        : "border-hairline bg-surface/40 text-ink-medium hover:border-accent/30 hover:text-ink-high"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border ${
                        done ? "border-ok bg-ok/20 text-ok" : "border-ink-low/50"
                      }`}
                    >
                      {done ? "✓" : ""}
                    </span>
                    {m}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {project.github_url || project.demo_url ? (
        <div className="mt-3 flex flex-wrap gap-3 text-[13px]">
          {project.github_url ? (
            <a
              href={project.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
            >
              GitHub ↗
            </a>
          ) : null}
          {project.demo_url ? (
            <a
              href={project.demo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
            >
              Live demo ↗
            </a>
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <div className="mt-4 space-y-3 border-t border-hairline pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-ink-medium">GitHub URL (https)</span>
              <input
                type="url"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="https://github.com/you/repo"
                className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-high placeholder:text-ink-low focus-visible:outline-2 focus-visible:outline-accent"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-ink-medium">Demo URL (https)</span>
              <input
                type="url"
                value={demo}
                onChange={(e) => setDemo(e.target.value)}
                placeholder="https://your-demo.example"
                className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-high placeholder:text-ink-low focus-visible:outline-2 focus-visible:outline-accent"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink-medium">
              Notes — decisions, evidence, what you learned
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={5000}
              className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink-high placeholder:text-ink-low focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <Button variant="danger" size="sm" disabled={pending} onClick={() => run(() => deleteProject(project.id))}>
              Delete project
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await updateProjectLinks(project.id, {
                    github_url: github,
                    demo_url: demo,
                    notes,
                  });
                  if (res.ok) setEditing(false);
                  return res;
                })
              }
            >
              Save
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger/[0.07] px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}
