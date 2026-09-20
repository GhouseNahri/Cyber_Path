"use client";

import { useState, useTransition } from "react";
import { Badge, Card, CardHeader, buttonClasses } from "@/components/ui";
import { saveTopicNote } from "@/lib/notes/actions";

const MAX_BODY = 5000;

type Props = {
  topicSlug: string;
  initialBody: string | null;
  updatedAt?: string | null;
};

/** Journal-style note editor for a topic. One note per topic, always editable. */
export function TopicNotes({ topicSlug, initialBody, updatedAt }: Props) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(initialBody ?? "");
  const [savedBody, setSavedBody] = useState(initialBody ?? "");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(updatedAt ?? null);
  const [pending, startTransition] = useTransition();

  const hasNote = savedBody.length > 0;
  const dirty = body !== savedBody;

  function save(next: string) {
    startTransition(async () => {
      const result = await saveTopicNote(topicSlug, next);
      if (result.ok) {
        setSavedBody(next.trim());
        setBody(next.trim());
        setSavedAt(new Date().toISOString());
        setError(null);
        setEditing(false);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="My notes"
        subtitle="Your understanding, in your words — tied to this topic"
        action={hasNote ? <Badge tone="info">note saved</Badge> : <Badge tone="neutral">empty</Badge>}
      />

      {editing ? (
        <div>
          <label htmlFor="topic-note" className="sr-only">
            Note for this topic
          </label>
          <textarea
            id="topic-note"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
            rows={6}
            maxLength={MAX_BODY}
            placeholder="Key ideas, gotchas, questions to revisit…"
            className="w-full rounded-xl border border-hairline bg-surface-2 px-3 py-2.5 text-sm leading-relaxed text-ink-high placeholder:text-ink-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[11px] text-ink-low">
              {body.length}/{MAX_BODY}
            </span>
            <div className="flex items-center gap-2">
              {error ? (
                <p role="alert" className="text-[13px] text-danger">
                  {error}
                </p>
              ) : null}
              <button
                type="button"
                className={buttonClasses({ variant: "ghost", size: "sm" })}
                onClick={() => {
                  setBody(savedBody);
                  setError(null);
                  setEditing(false);
                }}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={buttonClasses({ variant: "primary", size: "sm" })}
                onClick={() => save(body)}
                disabled={pending}
              >
                {pending ? "Saving…" : "Save note"}
              </button>
            </div>
          </div>
        </div>
      ) : hasNote ? (
        <div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-high">{savedBody}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[11px] text-ink-low">
              {savedAt ? `saved ${new Date(savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={buttonClasses({ variant: "secondary", size: "sm" })}
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              <button
                type="button"
                className={buttonClasses({ variant: "ghost", size: "sm" })}
                onClick={() => save("")}
                disabled={pending}
              >
                {pending ? "Clearing…" : "Clear"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-[13px] leading-relaxed text-ink-medium">
            Write down what clicked and what didn&apos;t — future-you revises from this.
          </p>
          <div className="mt-3">
            <button
              type="button"
              className={buttonClasses({ variant: "secondary", size: "sm" })}
              onClick={() => {
                setBody("");
                setEditing(true);
              }}
            >
              Add a note
            </button>
          </div>
          {error ? (
            <p role="alert" className="mt-2 text-[13px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
      )}
      {dirty && !editing ? null : null}
    </Card>
  );
}
