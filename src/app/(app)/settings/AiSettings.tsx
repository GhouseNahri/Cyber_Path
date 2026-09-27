"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { updateAiPermissions, type AiPermissionsUpdate } from "@/lib/ai/actions";
import type { AiPermissions } from "@/lib/ai/context";

const LEVELS = [
  { value: "beginner", label: "Beginner — explains jargon" },
  { value: "intermediate", label: "Intermediate — skips basics" },
  { value: "advanced", label: "Advanced — terse and technical" },
] as const;

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border border-hairline bg-surface-2/40 p-3 ${disabled ? "opacity-60" : "hover:border-accent/40"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-accent"
      />
      <span>
        <span className="block text-[13px] font-medium text-ink-high">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-medium">{description}</span>
      </span>
    </label>
  );
}

/** Settings → AI assistant: permissions, response level, history. */
export function AiSettings({ initial }: { initial: AiPermissions }) {
  const router = useRouter();
  const [perms, setPerms] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(false);

  async function save(update: AiPermissionsUpdate) {
    const optimistic = { ...perms, ...update };
    setPerms(optimistic);
    setSaving(true);
    setError(null);
    const res = await updateAiPermissions(update);
    setSaving(false);
    if (res.ok) {
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
      router.refresh();
    } else {
      setPerms(perms); // roll back on failure
      setError(res.error);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {perms.assistant_enabled ? <Badge tone="ok">Enabled</Badge> : <Badge tone="neutral">Disabled</Badge>}
        {saving ? <span className="text-xs text-ink-low">Saving…</span> : null}
        {savedTick ? <span className="text-xs text-ok">Saved</span> : null}
      </div>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

      <div className="mt-3 space-y-2">
        <Toggle
          label="AI assistant"
          description="Master switch. Hides the floating assistant everywhere when off."
          checked={perms.assistant_enabled}
          onChange={(v) => void save({ assistant_enabled: v })}
          disabled={saving}
        />
        <Toggle
          label="Use roadmap context"
          description="The AI can see your phases, current topic and completion state to ground answers like “what should I learn next?”."
          checked={perms.use_roadmap_context}
          onChange={(v) => void save({ use_roadmap_context: v })}
          disabled={saving || !perms.assistant_enabled}
        />
        <Toggle
          label="Use learning progress"
          description="The AI can see your streak, activity summary and topics due for revision."
          checked={perms.use_progress_context}
          onChange={(v) => void save({ use_progress_context: v })}
          disabled={saving || !perms.assistant_enabled}
        />
        <Toggle
          label="Use connected GitHub repositories"
          description="Coming with the GitHub project-analysis milestone. Nothing is shared until you explicitly enable a repository."
          checked={perms.use_github_context}
          onChange={(v) => void save({ use_github_context: v })}
          disabled
        />
        <Toggle
          label="Save conversation history"
          description="Off = chats vanish when you close the panel; nothing is stored. On = you can revisit and delete chats anytime."
          checked={perms.history_enabled}
          onChange={(v) => void save({ history_enabled: v })}
          disabled={saving || !perms.assistant_enabled}
        />
      </div>

      <fieldset className="mt-4" disabled={!perms.assistant_enabled}>
        <legend className="text-[13px] font-medium text-ink-high">Response level</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => void save({ response_level: l.value })}
              className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                perms.response_level === l.value
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-hairline bg-surface-2/40 text-ink-medium hover:border-accent/30 hover:text-ink-high"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </fieldset>

      <p className="mt-4 rounded-lg border border-hairline bg-surface-2/60 p-3 text-xs leading-relaxed text-ink-medium">
        The AI only ever sees what you allow above, plus what you type. Keys stay server-side;
        nothing AI-related is stored in your browser.
      </p>
    </div>
  );
}
