"use client";

import { useState, useTransition } from "react";
import { Badge, Button } from "@/components/ui";
import { linkProjectRepo } from "@/lib/github/actions";
import type { GithubRepoLite } from "@/lib/github/mapping";

type ProjectOpt = { id: string; title: string; github_url: string | null };

export function RepoGrid({ repos }: { repos: GithubRepoLite[] }) {
  if (repos.length === 0) {
    return (
      <p className="text-[13px] text-ink-low">
        No public repositories found. They will appear here after your next connect/refresh.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {repos.map((r) => (
        <li key={r.id} className="rounded-xl border border-hairline bg-surface-2/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="min-w-0 text-[14px] font-medium text-ink-high hover:text-accent hover:underline">
              {r.name} ↗
            </a>
            <div className="flex items-center gap-1.5">
              {r.isSecurity ? <Badge tone="accent">security</Badge> : null}
              {r.isFork ? <Badge tone="neutral">fork</Badge> : null}
            </div>
          </div>
          {r.description ? <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-medium">{r.description}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink-low">
            {r.language ? <span>{r.language}</span> : null}
            {r.stars > 0 ? <span>★ {r.stars}</span> : null}
            {r.pushedAt ? <span>pushed {r.pushedAt.slice(0, 10)}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProjectLinker({ projects }: { projects: ProjectOpt[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okId, setOkId] = useState<string | null>(null);

  if (projects.length === 0) {
    return (
      <p className="text-[13px] text-ink-low">
        Start a project first — then link its repository here so finished work points at real code.
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {projects.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-2/40 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink-high">{p.title}</p>
            {p.github_url ? (
              <a href={p.github_url} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-accent hover:underline">
                {p.github_url.replace("https://github.com/", "")} ↗
              </a>
            ) : (
              <p className="text-[11px] text-ink-low">no repo linked</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {p.github_url ? (
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(p.id, "")}>
                Unlink
              </Button>
            ) : null}
            <RepoPicker disabled={pending} onPick={(url) => run(p.id, url)} />
          </div>
        </li>
      ))}
      {okId ? <li className="text-[12px] text-ok">Repo linked ✓</li> : null}
      {error ? (
        <li role="alert" className="rounded-lg border border-danger/30 bg-danger/[0.07] px-3 py-2 text-[13px] text-danger">
          {error}
        </li>
      ) : null}
    </ul>
  );

  function run(projectId: string, url: string) {
    setError(null);
    setOkId(null);
    startTransition(async () => {
      const res = await linkProjectRepo(projectId, url);
      if (res.ok) setOkId(projectId);
      else setError(res.error);
    });
  }
}

function RepoPicker({ disabled, onPick }: { disabled: boolean; onPick: (url: string) => void }) {
  const [url, setUrl] = useState("");
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="url"
        value={url}
        disabled={disabled}
        placeholder="https://github.com/you/repo"
        onChange={(e) => setUrl(e.target.value)}
        className="w-52 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-[12px] text-ink-high placeholder:text-ink-low focus-visible:outline-2 focus-visible:outline-accent"
      />
      <Button variant="secondary" size="sm" disabled={disabled || url.trim().length === 0} onClick={() => { onPick(url.trim()); setUrl(""); }}>
        Link
      </Button>
    </span>
  );
}
