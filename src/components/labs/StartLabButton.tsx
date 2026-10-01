"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { startLab } from "@/lib/labs/actions";

export function StartLabButton({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  if (started) {
    return <span className="font-mono text-[12px] text-ok">Started ✓ — your tracker is on the right</span>;
  }

  return (
    <div>
      <Button
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await startLab(slug);
            if (res.ok) setStarted(true);
            else setError(res.error ?? "Could not start the lab.");
          });
        }}
      >
        {pending ? "Starting…" : "Start this lab"}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
