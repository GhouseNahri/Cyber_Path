"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { startProject } from "@/lib/projects/actions";

export function StartProjectForm({ ideaSlug, ideaTitle }: { ideaSlug: string; ideaTitle: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  return (
    <div>
      {started ? (
        <span className="font-mono text-[12px] text-ok">Started ✓ — see My projects</span>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await startProject({ ideaSlug });
              if (res.ok) {
                setStarted(true);
              } else {
                setError(res.error ?? "Could not start. Try again.");
              }
            });
          }}
        >
          {pending ? "Starting…" : `Start: ${ideaTitle}`}
        </Button>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
