"use client";

import { useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { addCustomLab } from "@/lib/labs/actions";
import { LAB_TYPES, type LabType } from "@/lib/labs/engine";

const TYPE_OPTIONS: { value: LabType; label: string }[] = (
  [
    ["external", "Provider lab"],
    ["ctf", "CTF"],
    ["home_lab", "Home lab"],
    ["custom", "Custom lab"],
  ] as const
)
  .filter(([v]) => LAB_TYPES.includes(v))
  .map(([value, label]) => ({ value, label }));

export function AddLabForm({ categories }: { categories: { slug: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<LabType>("external");
  const [provider, setProvider] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await addCustomLab({
        title,
        labType: type,
        provider,
        externalUrl: url,
        categorySlug: category || undefined,
      });
      if (res.ok) {
        setDone(true);
        setTitle("");
        setProvider("");
        setUrl("");
        setCategory("");
      } else {
        setError(res.error ?? "Could not add the lab.");
      }
    });
  };

  const selectClasses =
    "h-9 w-full rounded-lg border border-hairline bg-canvas px-3 text-sm text-ink-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Lab name" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. HackTheBox — Meow" maxLength={160} />
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-ink-high">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as LabType)} className={selectClasses}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <Input label="Provider (optional)" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="TryHackMe, HackTheBox…" maxLength={120} />
        <Input label="Link (optional, https)" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-[13px] font-medium text-ink-high">Category (optional)</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClasses}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={pending || title.trim().length < 2} onClick={submit}>
          {pending ? "Adding…" : "Add lab"}
        </Button>
        {done ? <span className="font-mono text-[12px] text-ok">Added ✓</span> : null}
        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
