"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui";
import type { LibraryFacets, LibraryFilters } from "@/lib/resources/types";

const TYPE_LABELS: Record<string, string> = {
  documentation: "Docs",
  article: "Article",
  video: "Video",
  course: "Course",
  interactive_lab: "Interactive lab",
  ctf: "CTF",
  book: "Book",
  cheat_sheet: "Cheat sheet",
  exercise: "Exercise",
};

const STATUS_LABELS: Record<LibraryFilters["status"], string> = {
  all: "Any status",
  saved: "Saved",
  done: "Done",
  not_started: "Not started",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-ink-low">{label}</span>
      {children}
    </label>
  );
}

const selectClasses =
  "w-full rounded-lg border border-hairline bg-surface-2/60 px-3 py-2 text-sm text-ink-high focus:border-accent focus:outline-none";

export function LibraryFilterBar({
  facets,
  current,
  resultCount,
  total,
}: {
  facets: LibraryFacets;
  current: LibraryFilters;
  resultCount: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  const activeKeys = [
    params.get("topic"),
    params.get("type"),
    params.get("difficulty"),
    params.get("free"),
    params.get("official"),
    params.get("status"),
  ].filter((v) => v !== null && v !== "");

  return (
    <div className={`rounded-2xl border border-hairline bg-surface-1 p-4 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Topic">
          <select
            value={current.topic ?? ""}
            onChange={(e) => setParam("topic", e.target.value || null)}
            className={selectClasses}
          >
            <option value="">All topics</option>
            {facets.topics.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Type">
          <select
            value={current.type ?? ""}
            onChange={(e) => setParam("type", e.target.value || null)}
            className={selectClasses}
          >
            <option value="">All types</option>
            {facets.types.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Difficulty">
          <select
            value={current.difficulty ?? ""}
            onChange={(e) => setParam("difficulty", e.target.value || null)}
            className={selectClasses}
          >
            <option value="">All difficulties</option>
            {facets.difficulties.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Price">
          <select
            value={current.free === null ? "" : current.free ? "free" : "paid"}
            onChange={(e) => setParam("free", e.target.value || null)}
            className={selectClasses}
          >
            <option value="">Free + paid</option>
            <option value="free">Free only</option>
            <option value="paid">Paid only</option>
          </select>
        </Field>

        <Field label="Your status">
          <select
            value={current.status}
            onChange={(e) => setParam("status", e.target.value === "all" ? null : e.target.value)}
            className={selectClasses}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex items-end gap-2 pb-2">
          <input
            type="checkbox"
            checked={current.official}
            onChange={(e) => setParam("official", e.target.checked ? "1" : null)}
            className="size-4 accent-accent"
          />
          <span className="text-[13px] text-ink-medium">Official sources only</span>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-ink-low">
          {resultCount} of {total} resources
          {activeKeys.length > 0 ? ` · ${activeKeys.length} filter${activeKeys.length === 1 ? "" : "s"} active` : ""}
        </p>
        {activeKeys.length > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => startTransition(() => router.push(pathname, { scroll: false }))}>
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
