"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { toggleCareerPath } from "@/lib/career/actions";

export function SelectPathButton({
  slug,
  selected,
  size = "sm",
}: {
  slug: string;
  selected: boolean;
  size?: "sm" | "md";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState(selected);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        variant={optimistic ? "secondary" : "primary"}
        size={size}
        disabled={pending}
        onClick={() => {
          setError(null);
          setOptimistic((v) => !v);
          startTransition(async () => {
            const res = await toggleCareerPath(slug);
            if (!res.ok) {
              setOptimistic(selected); // roll back
              setError(res.error);
            } else {
              setOptimistic(res.selected);
            }
          });
        }}
      >
        {optimistic ? "✓ Selected — remove" : "Select this path"}
      </Button>
      {error ? (
        <p role="alert" className="text-[12px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
