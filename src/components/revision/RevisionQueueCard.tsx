"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, CardHeader, EmptyState, buttonClasses } from "@/components/ui";
import { markReviewed } from "@/lib/revision/actions";
import type { RevisionItem } from "@/lib/revision/queries";

/** One due-review row with a per-row pending state and "next due" feedback. */
function DueRow({ item }: { item: RevisionItem }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const review = () => {
    startTransition(async () => {
      await markReviewed(item.topic_slug);
      router.refresh();
    });
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-2/40 p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink-high">{item.topic_title}</p>
        <p className="mt-0.5 font-mono text-[11px] text-ink-low">
          Review #{item.review_number} · {item.interval_days}-day pass
          {item.overdue_days > 0 ? ` · ${item.overdue_days} day${item.overdue_days === 1 ? "" : "s"} overdue` : " · due today"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={`/roadmap/${item.topic_slug}`}
          className={buttonClasses({ variant: "ghost", size: "sm" })}
        >
          Open
        </a>
        <button type="button" onClick={review} disabled={pending} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          {pending ? "Saving…" : "Mark reviewed"}
        </button>
      </div>
    </li>
  );
}

type Props = {
  due: RevisionItem[];
  upcoming: RevisionItem[];
  graduatedCount: number;
  todayKey: string;
};

/** Dashboard card: topics due for spaced review, with upcoming strip. */
export function RevisionQueueCard({ due, upcoming, graduatedCount, todayKey }: Props) {
  return (
    <Card
      glow={due.length > 0}
    >
      <CardHeader
        title="Revision queue"
        subtitle="Spaced review keeps knowledge from decaying"
        action={
          due.length > 0 ? (
            <Badge tone={due.some((d) => d.overdue_days > 0) ? "warn" : "accent"}>
              {due.length} due today
            </Badge>
          ) : (
            <Badge tone="ok">All clear</Badge>
          )
        }
      />

      {due.length > 0 ? (
        <div className="space-y-3">
          <ul className="space-y-3">
            {due.map((d) => (
              <DueRow key={`${d.topic_slug}-${d.review_number}`} item={d} />
            ))}
          </ul>
          {upcoming.length > 0 ? (
            <p className="font-mono text-[11px] text-ink-low">
              Next up: {upcoming[0]?.topic_title} · {upcoming[0]?.due_day_key}
            </p>
          ) : null}
        </div>
      ) : upcoming.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-medium">
            Nothing due today. {graduatedCount > 0 ? `${graduatedCount} topic${graduatedCount === 1 ? "" : "s"} fully graduated. ` : ""}
            Next:
          </p>
          <ul className="space-y-2">
            {upcoming.map((u) => (
              <li key={`${u.topic_slug}-${u.review_number}`} className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-2/40 px-4 py-3">
                <span className="truncate text-sm text-ink-medium">{u.topic_title}</span>
                <span className="font-mono text-[11px] text-ink-low">
                  {u.due_day_key === todayKey ? "today" : u.due_day_key > todayKey ? `in ${Math.max(1, Math.round((Date.parse(u.due_day_key) - Date.parse(todayKey)) / 86_400_000))}d` : "due"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : graduatedCount > 0 ? (
        <EmptyState
          title="Everything reviewed"
          body={`${graduatedCount} topic${graduatedCount === 1 ? "" : "s"} made it through the full ladder. Nothing due right now.`}
        />
      ) : (
        <EmptyState
          title="Nothing to review yet"
          body="Complete a topic and it enters the spaced schedule — 1, 3, 7, 14 and 30 days out (editable in Settings)."
        />
      )}
    </Card>
  );
}
