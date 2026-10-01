"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { setLabStatus } from "@/lib/labs/actions";
import { LAB_STATUS_LABEL, type LabStatus } from "@/lib/labs/engine";

/** Status actions available from each state (mirrors the engine's edges). */
const NEXT: Record<LabStatus, LabStatus[]> = {
  not_started: ["in_progress"],
  in_progress: ["completed", "abandoned"],
  completed: ["revisit", "abandoned"],
  revisit: ["in_progress", "abandoned"],
  abandoned: ["in_progress"],
};

const ACTION_LABEL: Partial<Record<LabStatus, string>> = {
  in_progress: "Start",
  completed: "Mark complete",
  revisit: "Revisit later",
  abandoned: "Abandon",
};

export function LabStatusControls({
  userLabId,
  status,
  compact = false,
}: {
  userLabId: string;
  status: LabStatus;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<LabStatus>(status);

  const move = (to: LabStatus) => {
    setError(null);
    startTransition(async () => {
      const res = await setLabStatus(userLabId, to);
      if (res.ok) setCurrent(to);
      else setError(res.error ?? "Could not update the lab.");
    });
  };

  const actions = NEXT[current];

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "flex flex-wrap items-center gap-2.5"}>
      {actions.map((to) => (
        <Button
          key={to}
          size="sm"
          variant={to === "completed" ? "primary" : to === "abandoned" ? "ghost" : "secondary"}
          disabled={pending}
          onClick={() => move(to)}
        >
          {pending ? "Saving…" : (ACTION_LABEL[to] ?? LAB_STATUS_LABEL[to])}
        </Button>
      ))}
      <span className="font-mono text-[11px] text-ink-low">{LAB_STATUS_LABEL[current]}</span>
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
