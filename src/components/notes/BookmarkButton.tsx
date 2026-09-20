"use client";

import { useState, useTransition } from "react";
import { buttonClasses } from "@/components/ui";
import { toggleTopicBookmark } from "@/lib/notes/actions";

type Props = {
  topicSlug: string;
  initialBookmarked: boolean;
};

/** Save-for-later toggle. Optimistic UI with rollback on failure. */
export function BookmarkButton({ topicSlug, initialBookmarked }: Props) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !bookmarked;
    setBookmarked(next);
    startTransition(async () => {
      const result = await toggleTopicBookmark(topicSlug, next);
      if (!result.ok) setBookmarked(!next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={bookmarked}
      className={buttonClasses({ variant: bookmarked ? "secondary" : "ghost", size: "sm" })}
    >
      <svg viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} className="size-4" aria-hidden="true">
        <path
          d="M6 4h12a1 1 0 0 1 1 1v15.2a.6.6 0 0 1-.94.5L12 17l-6.06 3.7a.6.6 0 0 1-.94-.5V5a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      {bookmarked ? "Bookmarked" : "Bookmark"}
    </button>
  );
}
