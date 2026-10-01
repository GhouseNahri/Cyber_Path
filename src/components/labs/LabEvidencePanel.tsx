"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardHeader } from "@/components/ui";
import { saveLabEvidence } from "@/lib/labs/actions";

/** Post-lab skills evidence (L4/L5): the user confirms which of the lab's
 *  mapped skills they actually demonstrated, and can opt each evidence row
 *  into the public portfolio. Only completed labs can save. */
export function LabEvidencePanel({
  userLabId,
  skillOptions,
  initial,
}: {
  userLabId: string;
  skillOptions: { slug: string; name: string }[];
  initial: { accepted_skills: string[]; body: string; visibility: string } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [accepted, setAccepted] = useState<string[]>(initial?.accepted_skills ?? []);
  const [body, setBody] = useState(initial?.body ?? "");
  const [toPortfolio, setToPortfolio] = useState(initial?.visibility === "portfolio");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (slug: string) => {
    setSaved(false);
    setAccepted((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));
  };

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveLabEvidence(userLabId, { acceptedSkills: accepted, body, visibility: toPortfolio ? "portfolio" : "private" });
      if (res.ok) setSaved(true);
      else setError(res.error ?? "Could not save the evidence.");
    });
  };

  return (
    <Card>
      <CardHeader
        title="Skills demonstrated"
        subtitle="Tick only what you actually did here — confirmed skills count toward your skills profile"
      />
      {skillOptions.length > 0 ? (
        <ul className="space-y-2">
          {skillOptions.map((s) => (
            <li key={s.slug}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-hairline bg-canvas px-3 py-2.5 transition-colors hover:border-ink-low">
                <input
                  type="checkbox"
                  checked={accepted.includes(s.slug)}
                  disabled={pending}
                  onChange={() => toggle(s.slug)}
                  className="size-4 accent-accent"
                />
                <span className="text-sm text-ink-high">{s.name}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] leading-relaxed text-ink-medium">
          This lab has no mapped skills yet — your reflection below still counts.
        </p>
      )}
      <label htmlFor="lab-evidence-body" className="mt-3 block">
        <span className="mb-1 block text-[13px] font-medium text-ink-high">Anything to show for it? (optional)</span>
        <textarea
          id="lab-evidence-body"
          value={body}
          rows={3}
          maxLength={5000}
          placeholder="Commands that worked, screenshots to take later, notes you'd show a mentor…"
          onChange={(e) => {
            setBody(e.target.value);
            setSaved(false);
          }}
          className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2.5 text-[13px] leading-relaxed text-ink-high placeholder:text-ink-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
      </label>
      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-hairline bg-canvas px-3 py-2.5 transition-colors hover:border-ink-low">
        <input
          type="checkbox"
          checked={toPortfolio}
          disabled={pending}
          onChange={(e) => {
            setToPortfolio(e.target.checked);
            setSaved(false);
          }}
          className="mt-0.5 size-4 accent-accent"
        />
        <span className="text-[13px] leading-relaxed text-ink-high">
          Show this on my public portfolio
          <span className="mt-0.5 block text-[12px] text-ink-medium">
            Off stays private. On, visitors see the title, this text and the ticked skill names — never your notes,
            reflections or attempt history.
          </span>
        </span>
      </label>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save evidence"}
        </Button>
        {saved ? <span className="font-mono text-[12px] text-ok">Saved ✓</span> : null}
      </div>
    </Card>
  );
}
