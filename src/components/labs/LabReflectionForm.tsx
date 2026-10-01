"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardHeader } from "@/components/ui";
import { saveLabReflection } from "@/lib/labs/actions";

export type LabReflection = { did: string; learned: string; confused: string; differently: string };

const FIELDS: { key: keyof LabReflection; label: string; placeholder: string; rows: number }[] = [
  {
    key: "did",
    label: "What did you do?",
    placeholder: "The commands you ran, the environment you worked in, what you actually built or found…",
    rows: 3,
  },
  {
    key: "learned",
    label: "What did you learn?",
    placeholder: "One idea you'll keep — in your own words…",
    rows: 3,
  },
  {
    key: "confused",
    label: "What confused you?",
    placeholder: "Anything that didn't click — honest confusion is useful for review…",
    rows: 2,
  },
  {
    key: "differently",
    label: "What would you do differently?",
    placeholder: "What you'd try first next time…",
    rows: 2,
  },
];

/** Structured post-lab reflection (L4). Private to the user — it feeds
 *  recommendations and review, never the portfolio. */
export function LabReflectionForm({
  userLabId,
  initial,
}: {
  userLabId: string;
  initial: LabReflection | null;
}) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<LabReflection>(
    initial ?? { did: "", learned: "", confused: "", differently: "" },
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveLabReflection(userLabId, values);
      if (res.ok) setSaved(true);
      else setError(res.error ?? "Could not save the reflection.");
    });
  };

  return (
    <Card>
      <CardHeader
        title="Reflection"
        subtitle="Four short answers — private, and they shape what you review next"
      />
      <div className="space-y-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-high">{f.label}</span>
            <textarea
              value={values[f.key]}
              rows={f.rows}
              maxLength={2000}
              placeholder={f.placeholder}
              onChange={(e) => {
                setValues((v) => ({ ...v, [f.key]: e.target.value }));
                setSaved(false);
              }}
              className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2.5 text-[13px] leading-relaxed text-ink-high placeholder:text-ink-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save reflection"}
        </Button>
        {saved ? <span className="font-mono text-[12px] text-ok">Saved ✓</span> : null}
      </div>
    </Card>
  );
}
