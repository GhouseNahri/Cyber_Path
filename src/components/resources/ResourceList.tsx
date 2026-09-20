"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ui";
import { setResourceStatus, clearResourceStatus } from "@/lib/resources/actions";
import type { ResourceItem, ResourceStatus } from "@/lib/resources/types";

const TYPE_LABEL: Record<string, string> = {
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

const STATUS_META: Record<ResourceStatus, { label: string; tone: "ok" | "info" | "neutral" }> = {
  done: { label: "Done", tone: "ok" },
  saved: { label: "Saved", tone: "info" },
  skip: { label: "Skipped", tone: "neutral" },
};

function VerificationLine({ item }: { item: ResourceItem }) {
  if (item.last_verified) {
    return <span className="text-[11px] text-ink-low">verified {item.last_verified}</span>;
  }
  return <span className="text-[11px] text-warn">unverified — treat as a lead</span>;
}

export function ResourceCard({ item, showTopic = true }: { item: ResourceItem; showTopic?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ResourceStatus | null>(item.user_status);

  function apply(next: ResourceStatus | null) {
    setError(null);
    startTransition(async () => {
      const res = next === null ? await clearResourceStatus(item.id) : await setResourceStatus(item.id, next);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStatus(next);
      router.refresh();
    });
  }

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-ink-high hover:text-accent hover:underline"
        >
          {item.title}
          <span aria-hidden className="ml-1 inline-block">↗</span>
        </a>
        <span className="font-mono text-[11px] text-ink-low">
          {item.provider} · {TYPE_LABEL[item.type] ?? item.type}
          {item.estimated_minutes ? ` · ~${item.estimated_minutes}m` : ""}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {item.is_official ? <Badge tone="info">official</Badge> : null}
        {item.is_free ? <Badge tone="ok">free</Badge> : <Badge tone="warn">paid</Badge>}
        {item.difficulty ? (
          <Badge tone="neutral">{item.difficulty}</Badge>
        ) : null}
        <VerificationLine item={item} />
        {status ? (
          <Badge tone={STATUS_META[status].tone}>{STATUS_META[status].label}</Badge>
        ) : null}
      </div>

      {showTopic ? (
        <p className="mt-1 font-mono text-[11px] text-ink-low">
          {item.topic_phase_title} → {item.topic_title}
        </p>
      ) : null}

      {item.notes ? <p className="mt-1.5 text-[12px] leading-relaxed text-ink-medium">{item.notes}</p> : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {status === null ? (
          <>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => apply("done")}>
              Done
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => apply("saved")}>
              Save for later
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => apply("skip")}>
              Not for me
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => apply(null)}>
            Clear status
          </Button>
        )}
        {error ? (
          <span role="alert" className="text-[12px] text-danger">
            {error}
          </span>
        ) : null}
      </div>
    </li>
  );
}

export function ResourceList({ items, showTopic = true }: { items: ResourceItem[]; showTopic?: boolean }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-hairline bg-surface-2/30 px-4 py-6 text-center text-[13px] text-ink-medium">
        Nothing matches these filters — loosen one and try again.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-hairline">
      {items.map((r) => (
        <ResourceCard key={r.id} item={r} showTopic={showTopic} />
      ))}
    </ul>
  );
}
